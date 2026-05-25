/**
 * AI drafts (Phase 3) — T-0172.
 *
 * Covers the draft → confirm → commit pipeline that protects against
 * client tampering between the assistant's proposal and the user's
 * approval. The real services (`createManualSalesClosing`, `logComplaint`)
 * are mocked so the tests stay focused on the dispatch + permission
 * logic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface SelectStep {
  rows: unknown[];
}

let selectQueue: SelectStep[] = [];
const inserts: Array<{ table: string; values: unknown }> = [];
const updates: Array<{ set: unknown }> = [];

function nextSelectRows(): unknown[] {
  return selectQueue.shift()?.rows ?? [];
}

function tableName(table: unknown): string {
  return String(
    (table as { _: { name?: string } })?._?.name ?? (table as { name?: string })?.name ?? 'unknown',
  );
}

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const chain: {
          where: () => typeof chain;
          orderBy: () => typeof chain;
          limit: () => Promise<unknown[]>;
          offset: () => typeof chain;
          then: (resolve: (value: unknown[]) => void) => void;
        } = {
          where: () => chain,
          orderBy: () => chain,
          limit: () => Promise.resolve(nextSelectRows()),
          offset: () => chain,
          then: (resolve) => resolve(nextSelectRows()),
        };
        return chain;
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserts.push({ table: tableName(table), values });
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (set: unknown) => {
        updates.push({ set });
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
  },
  and: () => undefined,
  eq: () => undefined,
  isNull: () => undefined,
}));

// Permission gate — controlled per test via canMock. Both `can` and
// `requirePermission` go through the same flag so a single
// `canMock.mockResolvedValueOnce(false)` covers both code paths.
const canMock = vi.fn(async () => true);
vi.mock('../src/iam', () => ({
  requirePermission: async (...args: unknown[]) => {
    const allowed = await canMock(...(args as []));
    return allowed
      ? { ok: true as const, value: undefined }
      : { ok: false as const, error: { messageKey: 'common.errors.forbidden', code: 'FORBIDDEN' } };
  },
  can: (...args: unknown[]) => canMock(...(args as [])),
}));

// Stub the underlying services so we don't import the entire POS module.
const createManualSalesMock = vi.fn();
vi.mock('../src/pos', () => ({
  createManualSalesClosing: (...args: unknown[]) => createManualSalesMock(...args),
}));
const logComplaintMock = vi.fn();
vi.mock('../src/crm', () => ({
  logComplaint: (...args: unknown[]) => logComplaintMock(...args),
}));

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: 'loc-1' };

beforeEach(() => {
  selectQueue = [];
  inserts.length = 0;
  updates.length = 0;
  canMock.mockReset();
  canMock.mockResolvedValue(true);
  createManualSalesMock.mockReset();
  logComplaintMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createDraft', () => {
  it('persists a draft row plus an audit row', async () => {
    const { createDraft } = await import('../src/ai/drafts');
    const { id, expiresAt } = await createDraft({
      sessionId: 's1',
      kind: 'manual_sale',
      summary: 'Tes draft',
      payload: { foo: 'bar' },
      ctx,
    });

    expect(id).toBeTruthy();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // One row to ai_action_drafts + one row to audit_log = 2 inserts.
    expect(inserts.length).toBe(2);
    const draftInsert = inserts.find(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        'kind' in (i.values as Record<string, unknown>),
    );
    expect(draftInsert).toBeDefined();
    expect((draftInsert?.values as { kind: string }).kind).toBe('manual_sale');

    const auditInsert = inserts.find(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_action_draft',
    );
    expect(auditInsert).toBeDefined();
    expect((auditInsert?.values as { action: string }).action).toBe('submit');
  });
});

describe('commitDraft', () => {
  it('refuses commit when the caller lacks the target permission', async () => {
    canMock.mockResolvedValueOnce(false); // requirePermission re-check returns false
    selectQueue = [
      {
        rows: [
          {
            id: 'd1',
            sessionId: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            locationId: 'loc-1',
            kind: 'manual_sale',
            summary: 'Tes',
            payload: { locationId: 'loc-1' },
            status: 'pending',
            resultRef: null,
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
            consumedBy: null,
            createdAt: new Date(),
          },
        ],
      },
    ];

    const { commitDraft } = await import('../src/ai/drafts');
    const result = await commitDraft('d1', ctx);
    expect(result.ok).toBe(false);
    // The real service must not run when permission was denied.
    expect(createManualSalesMock).not.toHaveBeenCalled();
  });

  it('commits a manual_sale draft and dispatches to createManualSalesClosing', async () => {
    selectQueue = [
      {
        rows: [
          {
            id: 'd2',
            sessionId: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            locationId: 'loc-1',
            kind: 'manual_sale',
            summary: 'Tes commit',
            payload: { locationId: 'loc-1', salesDate: '2026-05-25' },
            status: 'pending',
            resultRef: null,
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
            consumedBy: null,
            createdAt: new Date(),
          },
        ],
      },
    ];
    createManualSalesMock.mockResolvedValueOnce({ ok: true, value: { id: 'msc-99' } });

    const { commitDraft } = await import('../src/ai/drafts');
    const result = await commitDraft('d2', ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe('manual_sale');
      expect(result.value.resultRef).toBe('msc-99');
    }

    // Status update happens via db.update; audit row written too.
    expect(updates.length).toBeGreaterThan(0);
    expect((updates[0]?.set as { status?: string }).status === 'committed').toBe(true);
    const auditRows = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_action_draft' &&
        (i.values as { action?: string }).action === 'approve',
    );
    expect(auditRows.length).toBe(1);
  });

  it('refuses expired drafts and surfaces the matching error', async () => {
    selectQueue = [
      {
        rows: [
          {
            id: 'd3',
            sessionId: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            locationId: 'loc-1',
            kind: 'manual_sale',
            summary: 'Tes',
            payload: {},
            status: 'pending',
            resultRef: null,
            expiresAt: new Date(Date.now() - 1_000),
            consumedAt: null,
            consumedBy: null,
            createdAt: new Date(),
          },
        ],
        // cancelDraft re-fetches inside the flow → second row read.
      },
      {
        rows: [
          {
            id: 'd3',
            sessionId: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            locationId: 'loc-1',
            kind: 'manual_sale',
            summary: 'Tes',
            payload: {},
            status: 'pending',
            resultRef: null,
            expiresAt: new Date(Date.now() - 1_000),
            consumedAt: null,
            consumedBy: null,
            createdAt: new Date(),
          },
        ],
      },
    ];

    const { commitDraft } = await import('../src/ai/drafts');
    const result = await commitDraft('d3', ctx);
    expect(result.ok).toBe(false);
    expect(createManualSalesMock).not.toHaveBeenCalled();
  });
});
