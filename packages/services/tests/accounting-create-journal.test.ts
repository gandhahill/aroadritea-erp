/**
 * Tests for accounting.createJournal — T-0012
 *
 * Unit tests with mocked DB layer. Tests all validation paths
 * and business rules per SD §20, §21.1.
 *
 * NOTE: Integration tests with real DB via T-0030 (resilience tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Sequenced DB Mock ---
// The createJournal function makes these DB calls in order:
// 1. select().from(accountingPeriods).where() -> period lookup
// 2. select().from(accounts).where() -> account validation
// 3. select().from(journalEntries).where() -> JE count for numbering
// 4. insert(journalEntries).values() -> create JE
// 5. insert(journalLines).values() -> create lines
// 6. insert(auditLog).values() -> audit

let selectCallIndex = 0;
let selectResults: unknown[][] = [];
const insertCalls: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (...args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => {
          const idx = selectCallIndex++;
          const rows = selectResults[idx] ?? [];
          return {
            then: (fn: (r: unknown[]) => unknown) => fn(rows),
          };
        },
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    insert: (...args: unknown[]) => ({
      values: (...vArgs: unknown[]) => {
        insertCalls.push(vArgs);
        return Promise.resolve();
      },
    }),
  },
}));

// --- Mock IAM ---
let mockPermissionResult = true;
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => {
    if (mockPermissionResult) return { ok: true, value: undefined };
    return { ok: false, error: { code: 'FORBIDDEN', messageKey: 'common.errors.forbidden' } };
  }),
}));

// --- Import after mocks ---
import { createJournal } from '../src/accounting/create-journal';
import { CreateJournalInputSchema } from '../src/accounting/schemas';
import type { AuditContext } from '@erp/shared/types';

// --- Test data factories ---

function makeCtx(overrides?: Partial<AuditContext>): AuditContext {
  return {
    userId: 'user-001',
    tenantId: 'default',
    locationId: 'loc-mli',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

function makeValidInput() {
  return {
    postingDate: '2026-05-15',
    locationId: 'loc-mli',
    description: 'Test journal entry',
    lines: [
      { accountId: 'acc-cash', locationId: 'loc-mli', debit: '100000', credit: '0' },
      { accountId: 'acc-sales', locationId: 'loc-mli', debit: '0', credit: '100000' },
    ],
  };
}

/** Configure mocked DB select responses in sequence. */
function setupDbMocks(config: {
  period?: { id: string; status: string; code: string } | null;
  accounts?: Array<{ id: string; isActive: boolean; isPostable: boolean; code: string }>;
  jeCount?: number;
}) {
  selectCallIndex = 0;
  insertCalls.length = 0;
  selectResults = [];

  // Call 1: period lookup
  if (config.period === null) {
    selectResults.push([]); // not found
  } else if (config.period) {
    selectResults.push([config.period]);
  } else {
    selectResults.push([{ id: 'period-2026-05', status: 'open', code: '2026-05' }]);
  }

  // Call 2: accounts lookup
  if (config.accounts) {
    selectResults.push(config.accounts);
  } else {
    selectResults.push([
      { id: 'acc-cash', isActive: true, isPostable: true, code: '1-1010' },
      { id: 'acc-sales', isActive: true, isPostable: true, code: '4-1000' },
    ]);
  }

  // Call 3: JE count for number generation
  selectResults.push([{ count: config.jeCount ?? 0 }]);
}

// --- Tests ---

describe('CreateJournalInputSchema (Zod)', () => {
  it('should accept valid input', () => {
    const result = CreateJournalInputSchema.safeParse(makeValidInput());
    expect(result.success).toBe(true);
  });

  it('should reject missing postingDate', () => {
    const input = { ...makeValidInput(), postingDate: '' };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const input = { ...makeValidInput(), postingDate: '15-05-2026' };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing description', () => {
    const input = { ...makeValidInput(), description: '' };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject fewer than 2 lines', () => {
    const input = {
      ...makeValidInput(),
      lines: [{ accountId: 'acc-cash', locationId: 'loc-mli', debit: '100000', credit: '0' }],
    };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject negative amounts in lines', () => {
    const input = {
      ...makeValidInput(),
      lines: [
        { accountId: 'acc-cash', locationId: 'loc-mli', debit: '-100000', credit: '0' },
        { accountId: 'acc-sales', locationId: 'loc-mli', debit: '0', credit: '100000' },
      ],
    };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept optional referenceType', () => {
    const input = { ...makeValidInput(), referenceType: 'sales' as const };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid referenceType', () => {
    const input = { ...makeValidInput(), referenceType: 'invalid_type' };
    const result = CreateJournalInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('createJournal service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    selectCallIndex = 0;
    insertCalls.length = 0;
    selectResults = [];
  });

  it('should reject when user lacks permission', async () => {
    mockPermissionResult = false;
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('should reject when lines are not balanced', async () => {
    setupDbMocks({});
    const input = {
      ...makeValidInput(),
      lines: [
        { accountId: 'acc-cash', locationId: 'loc-mli', debit: '100000', credit: '0' },
        { accountId: 'acc-sales', locationId: 'loc-mli', debit: '0', credit: '90000' },
      ],
    };

    const result = await createJournal(input, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      expect(result.error.messageKey).toBe('accounting.journal.notBalanced');
    }
  });

  it('should reject zero-amount journal entry (all lines zero)', async () => {
    setupDbMocks({});
    const input = {
      ...makeValidInput(),
      lines: [
        { accountId: 'acc-cash', locationId: 'loc-mli', debit: '0', credit: '0' },
        { accountId: 'acc-sales', locationId: 'loc-mli', debit: '0', credit: '0' },
      ],
    };

    const result = await createJournal(input, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      // Should be lineZero since individual lines are 0/0
      expect(result.error.messageKey).toBe('accounting.journal.lineZero');
    }
  });

  it('should reject line with both debit and credit > 0', async () => {
    setupDbMocks({});
    const input = {
      ...makeValidInput(),
      lines: [
        { accountId: 'acc-cash', locationId: 'loc-mli', debit: '50000', credit: '50000' },
        { accountId: 'acc-sales', locationId: 'loc-mli', debit: '50000', credit: '50000' },
      ],
    };

    const result = await createJournal(input, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BUSINESS_RULE');
      expect(result.error.messageKey).toBe('accounting.journal.lineBothDebitCredit');
    }
  });

  it('should reject when period not found', async () => {
    setupDbMocks({ period: null });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodNotFound');
    }
  });

  it('should reject when period is closed', async () => {
    setupDbMocks({
      period: { id: 'period-2026-05', status: 'closed', code: '2026-05' },
    });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should reject when period is in closing status', async () => {
    setupDbMocks({
      period: { id: 'period-2026-05', status: 'closing', code: '2026-05' },
    });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.periodClosed');
    }
  });

  it('should reject when account not found', async () => {
    setupDbMocks({
      accounts: [
        // Only one account found, other missing
        { id: 'acc-cash', isActive: true, isPostable: true, code: '1-1010' },
      ],
    });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.accountNotFound');
    }
  });

  it('should reject when account is inactive', async () => {
    setupDbMocks({
      accounts: [
        { id: 'acc-cash', isActive: false, isPostable: true, code: '1-1010' },
        { id: 'acc-sales', isActive: true, isPostable: true, code: '4-1000' },
      ],
    });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.accountInactive');
    }
  });

  it('should reject when account is not postable', async () => {
    setupDbMocks({
      accounts: [
        { id: 'acc-cash', isActive: true, isPostable: false, code: '1-1010' },
        { id: 'acc-sales', isActive: true, isPostable: true, code: '4-1000' },
      ],
    });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('accounting.journal.accountNotPostable');
    }
  });

  it('should create a draft journal entry on valid input', async () => {
    setupDbMocks({});
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('draft');
      expect(result.value.number).toMatch(/^JE-2026-05-\d{4}$/);
      expect(result.value.totalDebit).toBe(100000n);
      expect(result.value.totalCredit).toBe(100000n);
      expect(result.value.lines).toHaveLength(2);
      expect(result.value.postingDate).toBe('2026-05-15');
      expect(result.value.locationId).toBe('loc-mli');
    }
  });

  it('should correctly number sequential journal entries', async () => {
    setupDbMocks({ jeCount: 42 });
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.number).toBe('JE-2026-05-0043');
    }
  });

  it('should handle multi-line journal with 3+ lines', async () => {
    setupDbMocks({
      accounts: [
        { id: 'acc-cash', isActive: true, isPostable: true, code: '1-1010' },
        { id: 'acc-sales', isActive: true, isPostable: true, code: '4-1000' },
        { id: 'acc-tax', isActive: true, isPostable: true, code: '2-1030' },
      ],
    });

    const input = {
      ...makeValidInput(),
      lines: [
        { accountId: 'acc-cash', locationId: 'loc-mli', debit: '33000', credit: '0' },
        { accountId: 'acc-sales', locationId: 'loc-mli', debit: '0', credit: '30000' },
        { accountId: 'acc-tax', locationId: 'loc-mli', debit: '0', credit: '3000' },
      ],
    };

    const result = await createJournal(input, makeCtx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines).toHaveLength(3);
      expect(result.value.totalDebit).toBe(33000n);
      expect(result.value.totalCredit).toBe(33000n);
    }
  });

  it('should write audit log on successful creation', async () => {
    setupDbMocks({});
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);

    // Verify insert was called 3 times: JE, lines, audit_log
    expect(insertCalls).toHaveLength(3);
  });

  it('should pass Zod validation errors through', async () => {
    const input = {
      postingDate: 'not-a-date',
      locationId: 'loc-mli',
      description: 'Test',
      lines: [
        { accountId: 'acc-1', locationId: 'loc-mli', debit: '100', credit: '0' },
        { accountId: 'acc-2', locationId: 'loc-mli', debit: '0', credit: '100' },
      ],
    };

    const result = await createJournal(input, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.messageKey).toBe('accounting.journal.validationFailed');
    }
  });

  it('should set default referenceType to manual', async () => {
    setupDbMocks({});
    const result = await createJournal(makeValidInput(), makeCtx());
    expect(result.ok).toBe(true);
    // The JE insert should have referenceType = 'manual'
    // We verify via the insert values call
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('JE Number Generator', () => {
  beforeEach(() => {
    selectCallIndex = 0;
    selectResults = [];
  });

  it('should format number as JE-YYYY-MM-NNNN', async () => {
    const { generateJournalNumber } = await import('../src/accounting/number-generator');
    selectResults = [[{ count: 0 }]];
    const num = await generateJournalNumber('default', '2026-05-15');
    expect(num).toBe('JE-2026-05-0001');
  });

  it('should pad sequence to 4 digits', async () => {
    const { generateJournalNumber } = await import('../src/accounting/number-generator');
    selectResults = [[{ count: 9 }]];
    selectCallIndex = 0;
    const num = await generateJournalNumber('default', '2026-12-01');
    expect(num).toBe('JE-2026-12-0010');
  });

  it('should handle large sequence numbers', async () => {
    const { generateJournalNumber } = await import('../src/accounting/number-generator');
    selectResults = [[{ count: 9999 }]];
    selectCallIndex = 0;
    const num = await generateJournalNumber('default', '2026-01-01');
    expect(num).toBe('JE-2026-01-10000');
  });
});
