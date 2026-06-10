/**
 * Public REST API v1 — Aroadri Tea ERP.
 *
 * Mounted on the running Hono HTTP server (`apps/mcp/src/http-server.ts`) at
 * `/api/v1`. Third-party integrators authenticate with a Bearer API token
 * (same `api_tokens` infra as MCP). Every request flows through the exact same
 * permission engine (`can`) and service layer as the ERP UI — the API never
 * touches the database for business reads except thin master-data queries.
 *
 * Middleware chain per request: Bearer auth → rate limit (per token) → handler
 * (which checks permission via `can`) → fire-and-forget audit. Errors use a
 * uniform `{ error: { code, message } }` envelope with stable codes.
 *
 * See ADR-0017 and docs/runbook/public-api-onboarding.md.
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { stockLevels } from '@erp/db/schema/inventory';
import { can } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { type TokenUser, hashToken, verifyToken } from '../../auth';

type Vars = { user: TokenUser; tokenHash: string };

const RATE_LIMIT = Number.parseInt(process.env.PUBLIC_API_RATE_LIMIT ?? '120', 10);
const RATE_WINDOW_MS = 60_000;

// --- Uniform error / json helpers ---

type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

/** Deep-replace bigint → string so JSON.stringify never throws on money. */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function jsonResponse(data: unknown, status: number, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data, bigintReplacer), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function apiError(code: ErrorCode, message: string, extraHeaders?: Record<string, string>) {
  return jsonResponse({ error: { code, message } }, STATUS[code], extraHeaders);
}

function parsePagination(c: { req: { query: (k: string) => string | undefined } }) {
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const rawSize = Number.parseInt(c.req.query('pageSize') ?? '50', 10) || 50;
  const pageSize = Math.min(200, Math.max(1, rawSize));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

// --- Rate limiter (in-memory fixed window, per token; no Redis) ---

const buckets = new Map<string, { count: number; windowStart: number }>();

function rateLimit(tokenHash: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(tokenHash);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    buckets.set(tokenHash, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((bucket.windowStart + RATE_WINDOW_MS - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

// --- Audit (fire-and-forget, source = public_api) ---

function auditAccess(user: TokenUser, method: string, path: string, status: number): void {
  db.insert(auditLog)
    .values({
      id: generateId(),
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'api_access',
      entityType: 'public_api',
      entityId: `${method} ${path}`,
      before: null,
      after: { status },
      metadata: { source: 'public_api', locale: user.locale },
    })
    .catch(() => {});
}

// --- App + middleware ---

export const apiV1 = new Hono<{ Variables: Vars }>();

// CORS: bearer-token auth (no cookies), so a wildcard origin is safe and lets
// browser-based clients and the Scalar "try it" panel call the API.
apiV1.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  c.header('Access-Control-Max-Age', '600');
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  return next();
});

// Auth + rate limit.
apiV1.use('*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return apiError('UNAUTHENTICATED', 'Missing Bearer token in Authorization header.');
  }
  const rawToken = (match[1] ?? '').trim();
  const user = await verifyToken(rawToken);
  if (!user) {
    return apiError('UNAUTHENTICATED', 'Invalid or expired API token.');
  }

  const tokenHash = hashToken(rawToken);
  const limited = rateLimit(tokenHash);
  if (!limited.ok) {
    return apiError('RATE_LIMITED', 'Too many requests. Slow down.', {
      'Retry-After': String(limited.retryAfter),
    });
  }

  c.set('user', user);
  c.set('tokenHash', tokenHash);
  await next();

  // Audit after the handler resolves (status known).
  auditAccess(user, c.req.method, c.req.path, c.res.status);
});

// --- Routes ---

apiV1.get('/products', async (c) => {
  const user = c.get('user');
  const allowed = await can(user.userId, 'inventory.view', {});
  if (!allowed) return apiError('FORBIDDEN', 'Permission denied: inventory.view');

  const { page, pageSize, limit, offset } = parsePagination(c);
  const { listProducts } = await import('@erp/services/inventory');
  const result = await listProducts(
    {
      isActive: true,
      limit,
      offset,
      search: c.req.query('search'),
      categoryId: c.req.query('categoryId'),
    },
    { userId: user.userId, tenantId: user.tenantId, locationId: '' },
  );
  if (!result.ok) return apiError('INTERNAL', 'Failed to list products.');
  return jsonResponse(
    { data: result.value.items, page, pageSize, total: result.value.total },
    200,
  );
});

apiV1.get('/stock', async (c) => {
  const user = c.get('user');
  const locationId = c.req.query('locationId');
  if (!locationId) return apiError('VALIDATION_ERROR', 'locationId query parameter is required.');

  const allowed = await can(user.userId, 'inventory.view', { locationId });
  if (!allowed) return apiError('FORBIDDEN', 'Permission denied: inventory.view');

  const { page, pageSize, limit, offset } = parsePagination(c);
  const productId = c.req.query('productId');
  const where = and(
    eq(stockLevels.tenantId, user.tenantId),
    eq(stockLevels.locationId, locationId),
    productId ? eq(stockLevels.productId, productId) : undefined,
  );

  const [rows, countRows] = await Promise.all([
    db.select().from(stockLevels).where(where).limit(limit).offset(offset),
    db.select({ n: sql<number>`cast(count(*) as int)` }).from(stockLevels).where(where),
  ]);

  return jsonResponse(
    { data: rows, page, pageSize, total: countRows[0]?.n ?? 0 },
    200,
  );
});

apiV1.get('/reports/daily-summary', async (c) => {
  const user = c.get('user');
  const locationId = c.req.query('locationId');
  const date = c.req.query('date');
  if (!locationId) return apiError('VALIDATION_ERROR', 'locationId query parameter is required.');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return apiError('VALIDATION_ERROR', 'date query parameter (YYYY-MM-DD) is required.');
  }

  const allowed = await can(user.userId, 'reporting.view', { locationId });
  if (!allowed) return apiError('FORBIDDEN', 'Permission denied: reporting.view');

  const { getDailySummary } = await import('@erp/services/reporting');
  const result = await getDailySummary(
    { locationId, startDate: date, endDate: date },
    { userId: user.userId, tenantId: user.tenantId, locationId },
  );
  if (!result.ok) return apiError('INTERNAL', 'Failed to build daily summary.');
  return jsonResponse(result.value, 200);
});

// OpenAPI spec (public, no auth — but still rate-limited via the chain above is
// undesirable; serve it before auth by registering on a separate sub-path).
export { buildOpenApiDocument } from './openapi-document';
