/**
 * Tests for disciplinary service — T-0104
 *
 * Service: disciplinary-actions (SP1/SP2/SP3 workflow)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let _selIdx = 0;
let _selResults: unknown[][] = [];
const _updates: unknown[][] = [];
let _insertData: unknown[] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const makeQuery = () => {
          const slot = _selIdx++;
          const q = {
            then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot] ?? []),
            orderBy: makeQuery,
            limit: () => ({
              then: (fn: (r: unknown[]) => unknown) => fn(_selResults[slot] ?? []),
            }),
          };
          return q;
        };
        // from().where() and from().orderBy() each get own chain
        return { where: makeQuery, orderBy: makeQuery };
      },
    }),
    insert: () => ({
      values: (data: unknown) => {
        _insertData.push(data);
        return Promise.resolve({});
      },
    }),
    update: () => ({
      set: (data: unknown) => ({
        where: () => {
          _updates.push(data);
          // Support both `.where(...)` and `.where(...).returning(...)`
          // call shapes — the latter is needed for claim-first updates
          // that confirm a row was actually affected.
          const result: any = Promise.resolve([{ id: 'mock-id' }]);
          result.returning = () => Promise.resolve([{ id: 'mock-id' }]);
          return result;
        },
      }),
    }),
  },
}));

vi.mock('../src/iam/permission-engine', () => ({
  can: vi.fn(() => Promise.resolve(true)),
  invalidatePermissionCache: vi.fn(),
}));

vi.mock('@erp/shared/errors', () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      public details?: Record<string, unknown>,
    ) {
      super(code);
    }
    static notFound(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
    static internal(code: string, e?: unknown) {
      return new this(code, { error: String(e) });
    }
    static validation(code: string, details?: Record<string, unknown>) {
      return new this(code, details);
    }
  },
}));

import type { AuditContext } from '@erp/shared/types';
import {
  acknowledgeDisciplinaryAction,
  attachDocument,
  createDisciplinaryAction,
  listDisciplinaryActions,
} from '../src/hr/disciplinary-service.js';

function ctxt() {
  return { userId: 'user-1', tenantId: 'tenant-1', locationId: 'loc-1' } as AuditContext;
}

function disRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'da-1',
    tenantId: 'tenant-1',
    locationId: 'loc-1',
    employeeId: 'emp-1',
    level: 'SP1',
    reason: 'Terlambat 3x tanpa izin',
    incidentDate: new Date(),
    status: 'issued',
    issuedBy: 'user-1',
    attachmentUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  _selIdx = 0;
  _selResults = [];
  _updates.length = 0;
  _insertData = [];
  vi.clearAllMocks();
});

// ─── createDisciplinaryAction ──────────────────────────────────────────────

describe('createDisciplinaryAction', () => {
  it('inserts a disciplinary record with status issued', async () => {
    const result = await createDisciplinaryAction(
      {
        employeeId: 'emp-1',
        level: 'SP1',
        reason: 'Terlambat 3x tanpa izin',
        incidentDate: new Date().toISOString(),
      },
      ctxt(),
    );
    expect(result.ok).toBe(true);
    // Two inserts: 1) disciplinary_actions row, 2) audit_log row.
    expect(_insertData.length).toBe(2);
    const row = _insertData[0] as Record<string, unknown>;
    expect(row.employeeId).toBe('emp-1');
    expect(row.level).toBe('SP1');
    expect(row.status).toBe('issued');
    expect(row.issuedBy).toBe('user-1');
  });

  it('sets attachmentUrl when provided', async () => {
    await createDisciplinaryAction(
      {
        employeeId: 'emp-1',
        level: 'SP2',
        reason: 'Tidak datang tanpa kabar 2 hari',
        incidentDate: new Date().toISOString(),
        attachmentUrl: 'https://storage.example.com/sp2.pdf',
      },
      ctxt(),
    );
    expect(_insertData.length).toBe(2);
    const row = _insertData[0] as Record<string, unknown>;
    expect(row.attachmentUrl).toBe('https://storage.example.com/sp2.pdf');
  });

  it('creates SP3', async () => {
    await createDisciplinaryAction(
      {
        employeeId: 'emp-1',
        level: 'SP3',
        reason: 'Melakukan pencurian bahan baku',
        incidentDate: new Date().toISOString(),
      },
      ctxt(),
    );
    const row = _insertData[0] as Record<string, unknown>;
    expect(row.level).toBe('SP3');
  });

  it('validation fails for reason < 10 chars', async () => {
    const result = await createDisciplinaryAction(
      {
        employeeId: 'emp-1',
        level: 'SP1',
        reason: 'pendek',
        incidentDate: new Date().toISOString(),
      },
      ctxt(),
    );
    expect(result.ok).toBe(false);
  });
});

// ─── acknowledgeDisciplinaryAction ─────────────────────────────────────────

describe('acknowledgeDisciplinaryAction', () => {
  it('updates status to acknowledged', async () => {
    _selResults = [[disRow({ status: 'issued' })]];
    const result = await acknowledgeDisciplinaryAction({ disciplinaryId: 'da-1' }, ctxt());
    expect(result.ok).toBe(true);
    expect(_updates.length).toBe(1);
    const updateData = _updates[0] as Record<string, unknown>;
    expect(updateData.status).toBe('acknowledged');
    expect(updateData.acknowledgedBy).toBe('user-1');
  });

  it('not found', async () => {
    _selResults = [[]];
    const result = await acknowledgeDisciplinaryAction({ disciplinaryId: 'x' }, ctxt());
    expect(result.ok).toBe(false);
  });
});

// ─── listDisciplinaryActions ────────────────────────────────────────────────

describe('listDisciplinaryActions', () => {
  it('returns rows for tenant', async () => {
    _selResults = [[disRow({ level: 'SP1' }), disRow({ id: 'da-2', level: 'SP2' })]];
    const result = await listDisciplinaryActions({ limit: 50 }, ctxt());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.value)).toBe(true);
    }
  });

  it('not found → empty list', async () => {
    _selResults = [[]];
    const result = await listDisciplinaryActions({ limit: 50 }, ctxt());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(0);
    }
  });
});

// ─── attachDocument ─────────────────────────────────────────────────────────

describe('attachDocument', () => {
  it('updates attachmentUrl on existing action', async () => {
    _selResults = [[disRow()]];
    const result = await attachDocument(
      {
        disciplinaryId: 'da-1',
        attachmentUrl: 'https://storage.example.com/sp1.pdf',
      },
      ctxt(),
    );
    expect(result.ok).toBe(true);
    expect(_updates.length).toBe(1);
    const updateData = _updates[0] as Record<string, unknown>;
    expect(updateData.attachmentUrl).toBe('https://storage.example.com/sp1.pdf');
  });

  it('not found → error', async () => {
    _selResults = [[]];
    const result = await attachDocument(
      {
        disciplinaryId: 'x',
        attachmentUrl: 'https://storage.example.com/doc.pdf',
      },
      ctxt(),
    );
    expect(result.ok).toBe(false);
  });

  it('invalid URL → validation error', async () => {
    const result = await attachDocument(
      {
        disciplinaryId: 'da-1',
        attachmentUrl: 'not-a-url',
      },
      ctxt(),
    );
    expect(result.ok).toBe(false);
  });
});
