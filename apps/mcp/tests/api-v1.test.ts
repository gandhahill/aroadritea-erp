/**
 * Contract tests for the public REST API v1 — T-0293 (F8.2).
 *
 * Exercises the shared middleware chain (Bearer auth → rate limit → permission)
 * and the OpenAPI document. DB-backed reads are stubbed at the service boundary;
 * the goal is the API contract (status codes + envelope), not service internals.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Low rate limit so the burst test is cheap. Read at module load, so set first.
process.env.PUBLIC_API_RATE_LIMIT = '3';

let mockUser: { userId: string; tenantId: string; locale: string } | null = {
  userId: 'u1',
  tenantId: 't1',
  locale: 'id',
};
let mockCan = true;

vi.mock('../src/auth', () => ({
  // identity hash so each raw token maps to its own rate-limit bucket
  hashToken: (t: string) => t,
  verifyToken: vi.fn(async (raw: string) => (raw === 'bad' ? null : mockUser)),
}));

vi.mock('@erp/services/iam', () => ({
  can: vi.fn(async () => mockCan),
}));

vi.mock('@erp/services/inventory', () => ({
  listProducts: vi.fn(async () => ({
    ok: true,
    value: { items: [{ id: 'p1', sku: 'SKU1', variantPriceMin: '10000' }], total: 1 },
  })),
}));

vi.mock('@erp/services/reporting', () => ({
  getDailySummary: vi.fn(async () => ({ ok: true, value: { total: '0' } })),
}));

vi.mock('@erp/db', () => ({
  db: {
    // auditAccess fire-and-forget
    insert: () => ({ values: () => Promise.resolve() }),
  },
}));

const { apiV1 } = await import('../src/api/v1');
const { buildOpenApiDocument } = await import('../src/api/v1/openapi-document');

function authed(path: string, token = 'good') {
  return apiV1.request(path, { headers: { Authorization: `Bearer ${token}` } });
}

describe('OpenAPI document', () => {
  it('is OpenAPI 3.1 with the documented paths and bearer security', () => {
    const doc = buildOpenApiDocument('https://mcp.example.com') as Record<string, unknown>;
    expect(doc.openapi).toBe('3.1.0');
    const paths = doc.paths as Record<string, unknown>;
    expect(paths['/api/v1/products']).toBeDefined();
    expect(paths['/api/v1/stock']).toBeDefined();
    expect(paths['/api/v1/reports/daily-summary']).toBeDefined();
    const components = doc.components as { securitySchemes: Record<string, unknown> };
    expect(components.securitySchemes.bearerAuth).toBeDefined();
    expect((doc.servers as Array<{ url: string }>)[0].url).toBe('https://mcp.example.com');
  });
});

describe('public API v1 auth + middleware', () => {
  beforeEach(() => {
    mockUser = { userId: 'u1', tenantId: 't1', locale: 'id' };
    mockCan = true;
  });

  it('401 when Authorization header is missing', async () => {
    const res = await apiV1.request('/products');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('401 when the token is invalid', async () => {
    const res = await authed('/products', 'bad');
    expect(res.status).toBe(401);
  });

  it('403 when the caller lacks the permission', async () => {
    mockCan = false;
    const res = await authed('/products', 'noperm');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('200 with a product page on the happy path', async () => {
    const res = await authed('/products', 'happy');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.data[0].id).toBe('p1');
  });

  it('400 when stock locationId is missing', async () => {
    const res = await authed('/stock', 'stock-tok');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when daily-summary date is missing', async () => {
    const res = await authed('/reports/daily-summary?locationId=loc1', 'ds-tok');
    expect(res.status).toBe(400);
  });

  it('429 after exceeding the per-token rate limit', async () => {
    const token = 'burst-token';
    // limit = 3 → first 3 pass, 4th is rate limited
    for (let i = 0; i < 3; i++) {
      const ok = await authed('/products', token);
      expect(ok.status).toBe(200);
    }
    const limited = await authed('/products', token);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
  });
});
