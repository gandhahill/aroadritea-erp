/**
 * Tests for reporting services — T-0020
 *
 * Tests trialBalance, balanceSheet, profitLoss.
 * Uses mock DB that returns pre-configured journal line aggregates.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- DB Mock ---
let queryCallIndex = 0;
let queryResults: unknown[][] = [];

vi.mock('@erp/db', () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => {
          const idx = queryCallIndex++;
          return queryResults[idx] ?? [];
        },
        innerJoin: (..._jArgs: unknown[]) => ({
          where: (..._wArgs: unknown[]) => ({
            groupBy: (..._gArgs: unknown[]) => {
              const idx = queryCallIndex++;
              return queryResults[idx] ?? [];
            },
          }),
        }),
      }),
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

import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../src/iam';
import { balanceSheet } from '../src/reporting/balance-sheet';
import { profitLoss } from '../src/reporting/profit-loss';
// --- Import after mocks ---
import { trialBalance } from '../src/reporting/trial-balance';

const requirePermissionMock = vi.mocked(requirePermission);

function makeCtx(): AuditContext {
  return { userId: 'user-001', tenantId: 'default', locationId: 'loc-mli', ipAddress: '127.0.0.1' };
}

// --- Account fixtures ---
const ACCOUNTS = [
  {
    id: 'acc-cash',
    code: '1-1010',
    name: { id: 'Kas', en: 'Cash', zh: '现金' },
    type: 'asset',
    subtype: 'current_asset',
    normalBalance: 'debit',
  },
  {
    id: 'acc-ar',
    code: '1-1020',
    name: { id: 'Piutang', en: 'AR', zh: '应收账款' },
    type: 'asset',
    subtype: 'current_asset',
    normalBalance: 'debit',
  },
  {
    id: 'acc-equipment',
    code: '1-4400',
    name: { id: 'Peralatan', en: 'Equipment', zh: '设备' },
    type: 'asset',
    subtype: 'fixed_asset',
    normalBalance: 'debit',
  },
  {
    id: 'acc-ap',
    code: '2-1010',
    name: { id: 'Utang', en: 'AP', zh: '应付账款' },
    type: 'liability',
    subtype: 'current_liability',
    normalBalance: 'credit',
  },
  {
    id: 'acc-loan',
    code: '2-2200',
    name: { id: 'Pinjaman Bank', en: 'Bank Loan', zh: '银行贷款' },
    type: 'liability',
    subtype: 'long_term_liability',
    normalBalance: 'credit',
  },
  {
    id: 'acc-equity',
    code: '3-1010',
    name: { id: 'Modal', en: 'Equity', zh: '权益' },
    type: 'equity',
    subtype: 'equity',
    normalBalance: 'credit',
  },
  {
    id: 'acc-sales',
    code: '4-1000',
    name: { id: 'Penjualan', en: 'Sales', zh: '销售' },
    type: 'income',
    subtype: 'revenue',
    normalBalance: 'credit',
  },
  {
    id: 'acc-interest-income',
    code: '7-1100',
    name: { id: 'Pendapatan Bunga', en: 'Interest Income', zh: '利息收入' },
    type: 'income',
    subtype: 'other_income',
    normalBalance: 'credit',
  },
  {
    id: 'acc-cogs',
    code: '5-1000',
    name: { id: 'HPP', en: 'COGS', zh: '销售成本' },
    type: 'cogs',
    subtype: 'cogs',
    normalBalance: 'debit',
  },
  {
    id: 'acc-rent',
    code: '6-1010',
    name: { id: 'Sewa', en: 'Rent', zh: '租金' },
    type: 'expense',
    subtype: 'operating',
    normalBalance: 'debit',
  },
  {
    id: 'acc-salary',
    code: '6-1020',
    name: { id: 'Gaji', en: 'Salary', zh: '工资' },
    type: 'expense',
    subtype: 'operating',
    normalBalance: 'debit',
  },
  {
    id: 'acc-interest-exp',
    code: '7-2100',
    name: { id: 'Beban Bunga', en: 'Interest Expense', zh: '利息费用' },
    type: 'expense',
    subtype: 'non_operating',
    normalBalance: 'debit',
  },
  {
    id: 'acc-income-tax',
    code: '7-4100',
    name: { id: 'Beban PPh', en: 'Income Tax Expense', zh: '所得税费用' },
    type: 'expense',
    subtype: 'income_tax',
    normalBalance: 'debit',
  },
];

function resetMocks() {
  queryCallIndex = 0;
  queryResults = [];
}

// ================================================================
// TRIAL BALANCE
// ================================================================

describe('trialBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should aggregate posted journal lines per account', async () => {
    // Query 1: journal aggregates (joined lines + entries)
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '100000', totalCredit: '20000' },
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '80000' },
      ],
      ACCOUNTS, // Query 2: account details
    ];

    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines).toHaveLength(2);

      const cashLine = result.value.lines.find((l) => l.accountCode === '1-1010');
      expect(cashLine).toBeDefined();
      expect(cashLine!.totalDebit).toBe(100000n);
      expect(cashLine!.totalCredit).toBe(20000n);
      // Cash is debit-normal: balance = debit - credit = 80000
      expect(cashLine!.balance).toBe(80000n);

      const salesLine = result.value.lines.find((l) => l.accountCode === '4-1000');
      expect(salesLine).toBeDefined();
      // Sales is credit-normal: balance = credit - debit = 80000
      expect(salesLine!.balance).toBe(80000n);
    }
  });

  it('should compute grand totals', async () => {
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '50000', totalCredit: '0' },
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '50000' },
      ],
      ACCOUNTS,
    ];

    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalDebit).toBe(50000n);
      expect(result.value.totalCredit).toBe(50000n);
    }
  });

  it('should return empty lines when no posted journals', async () => {
    queryResults = [
      [], // no aggregates
      ACCOUNTS,
    ];

    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines).toHaveLength(0);
      expect(result.value.totalDebit).toBe(0n);
      expect(result.value.totalCredit).toBe(0n);
    }
  });

  it('should include asOf and locationId in result', async () => {
    queryResults = [[], ACCOUNTS];

    const result = await trialBalance({ asOf: '2026-12-31', locationId: 'loc-mli' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.asOf).toBe('2026-12-31');
      expect(result.value.locationId).toBe('loc-mli');
    }
    expect(requirePermissionMock).toHaveBeenCalledWith('user-001', 'accounting.view', {
      locationId: 'loc-mli',
    });
  });

  it('should mark report preliminary when an accounting period is closing', async () => {
    queryResults = [[], ACCOUNTS, [{ id: 'period-2026-05' }]];

    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isPreliminary).toBe(true);
    }
  });

  it('should sort lines by account code', async () => {
    queryResults = [
      [
        { accountId: 'acc-salary', totalDebit: '3000', totalCredit: '0' },
        { accountId: 'acc-cash', totalDebit: '5000', totalCredit: '0' },
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '8000' },
      ],
      ACCOUNTS,
    ];

    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const codes = result.value.lines.map((l) => l.accountCode);
      expect(codes).toEqual(['1-1010', '2-1010', '6-1020']);
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await trialBalance({ asOf: '2026-05-31' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

// ================================================================
// BALANCE SHEET
// ================================================================

describe('balanceSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should group accounts into Assets, Liabilities, Equity', async () => {
    // balanceSheet calls trialBalance internally, which makes 2 queries
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '100000', totalCredit: '0' },
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '40000' },
        { accountId: 'acc-equity', totalDebit: '0', totalCredit: '60000' },
      ],
      ACCOUNTS,
    ];

    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assets.total).toBe(100000n);
      expect(result.value.liabilities.total).toBe(40000n);
      expect(result.value.equity.total).toBe(60000n);
    }
  });

  it('should compute retained earnings from P&L accounts', async () => {
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '200000', totalCredit: '0' },
        { accountId: 'acc-equity', totalDebit: '0', totalCredit: '100000' },
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '150000' },
        { accountId: 'acc-cogs', totalDebit: '30000', totalCredit: '0' },
        { accountId: 'acc-rent', totalDebit: '20000', totalCredit: '0' },
      ],
      ACCOUNTS,
    ];

    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // retained = income(150k) - cogs(30k) - expense(20k) = 100k
      expect(result.value.retainedEarnings).toBe(100000n);
      // total equity with retained = equity(100k) + retained(100k) = 200k
      expect(result.value.totalEquityWithRetained).toBe(200000n);
    }
  });

  it('should verify accounting equation', async () => {
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '50000', totalCredit: '0' },
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '20000' },
        { accountId: 'acc-equity', totalDebit: '0', totalCredit: '30000' },
      ],
      ACCOUNTS,
    ];

    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Assets(50k) = Liabilities(20k) + Equity(30k) + Retained(0) = 50k
      expect(result.value.isBalanced).toBe(true);
      expect(result.value.assets.total).toBe(result.value.totalLiabilitiesAndEquity);
    }
  });

  it('should detect unbalanced state', async () => {
    // This should not happen in practice, but we test detection
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '100000', totalCredit: '0' },
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '50000' },
        // Missing equity → unbalanced
      ],
      ACCOUNTS,
    ];

    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isBalanced).toBe(false);
    }
  });

  it('should split assets and liabilities into current vs non-current (SAK EP Bab 4)', async () => {
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '100000', totalCredit: '0' }, // current asset
        { accountId: 'acc-equipment', totalDebit: '60000', totalCredit: '0' }, // non-current asset
        { accountId: 'acc-ap', totalDebit: '0', totalCredit: '40000' }, // current liability
        { accountId: 'acc-loan', totalDebit: '0', totalCredit: '50000' }, // non-current liability
        { accountId: 'acc-equity', totalDebit: '0', totalCredit: '70000' },
      ],
      ACCOUNTS,
    ];

    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.assets.total).toBe(160000n);
      expect(result.value.currentAssets.total).toBe(100000n);
      expect(result.value.nonCurrentAssets.total).toBe(60000n);

      expect(result.value.liabilities.total).toBe(90000n);
      expect(result.value.currentLiabilities.total).toBe(40000n);
      expect(result.value.nonCurrentLiabilities.total).toBe(50000n);
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await balanceSheet({ asOf: '2026-05-31' }, makeCtx());
    expect(result.ok).toBe(false);
  });
});

// ================================================================
// PROFIT & LOSS
// ================================================================

describe('profitLoss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
    resetMocks();
  });

  it('should compute revenue, cogs, expenses, and net income', async () => {
    queryResults = [
      [
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '500000' },
        { accountId: 'acc-cogs', totalDebit: '200000', totalCredit: '0' },
        { accountId: 'acc-rent', totalDebit: '50000', totalCredit: '0' },
        { accountId: 'acc-salary', totalDebit: '100000', totalCredit: '0' },
      ],
      ACCOUNTS,
    ];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenue.total).toBe(500000n);
      expect(result.value.cogs.total).toBe(200000n);
      expect(result.value.grossProfit).toBe(300000n); // 500k - 200k
      expect(result.value.expenses.total).toBe(150000n); // 50k + 100k
      expect(result.value.netIncome).toBe(150000n); // 300k - 150k
    }
  });

  it('should exclude balance sheet accounts', async () => {
    queryResults = [
      [
        { accountId: 'acc-cash', totalDebit: '100000', totalCredit: '0' }, // asset — excluded
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '100000' },
      ],
      ACCOUNTS,
    ];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenue.total).toBe(100000n);
      // No expenses, no cogs
      expect(result.value.netIncome).toBe(100000n);
    }
  });

  it('should handle net loss (expenses > revenue)', async () => {
    queryResults = [
      [
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '50000' },
        { accountId: 'acc-rent', totalDebit: '80000', totalCredit: '0' },
      ],
      ACCOUNTS,
    ];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.netIncome).toBe(-30000n); // Loss
    }
  });

  it('should return empty sections when no P&L activity', async () => {
    queryResults = [[], ACCOUNTS];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenue.lines).toHaveLength(0);
      expect(result.value.cogs.lines).toHaveLength(0);
      expect(result.value.expenses.lines).toHaveLength(0);
      expect(result.value.netIncome).toBe(0n);
    }
  });

  it('should include date range and location in result', async () => {
    queryResults = [[], ACCOUNTS];

    const result = await profitLoss(
      { from: '2026-01-01', to: '2026-12-31', locationId: 'loc-mli' },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.from).toBe('2026-01-01');
      expect(result.value.to).toBe('2026-12-31');
      expect(result.value.locationId).toBe('loc-mli');
    }
    expect(requirePermissionMock).toHaveBeenCalledWith('user-001', 'accounting.view', {
      locationId: 'loc-mli',
    });
  });

  it('should sort lines by account code', async () => {
    queryResults = [
      [
        { accountId: 'acc-salary', totalDebit: '100000', totalCredit: '0' },
        { accountId: 'acc-rent', totalDebit: '50000', totalCredit: '0' },
      ],
      ACCOUNTS,
    ];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      const codes = result.value.expenses.lines.map((l) => l.accountCode);
      expect(codes).toEqual(['6-1010', '6-1020']);
    }
  });

  it('should separate other income, finance costs, and income tax (SAK EP Bab 5)', async () => {
    queryResults = [
      [
        { accountId: 'acc-sales', totalDebit: '0', totalCredit: '500000' },
        { accountId: 'acc-cogs', totalDebit: '200000', totalCredit: '0' },
        { accountId: 'acc-rent', totalDebit: '50000', totalCredit: '0' },
        { accountId: 'acc-salary', totalDebit: '30000', totalCredit: '0' },
        { accountId: 'acc-interest-income', totalDebit: '0', totalCredit: '10000' },
        { accountId: 'acc-interest-exp', totalDebit: '5000', totalCredit: '0' },
        { accountId: 'acc-income-tax', totalDebit: '15000', totalCredit: '0' },
      ],
      ACCOUNTS,
    ];

    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Operating revenue excludes interest income
      expect(result.value.revenue.total).toBe(500000n);
      expect(result.value.otherIncome.total).toBe(10000n);
      // Operating expenses exclude finance costs and income tax
      expect(result.value.expenses.total).toBe(80000n); // rent 50k + salary 30k
      expect(result.value.financeCosts.total).toBe(5000n);
      expect(result.value.incomeTaxExpense.total).toBe(15000n);

      expect(result.value.grossProfit).toBe(300000n);
      expect(result.value.operatingProfit).toBe(220000n); // 300k - 80k
      expect(result.value.profitBeforeTax).toBe(225000n); // 220k + 10k - 5k
      expect(result.value.netIncome).toBe(210000n); // 225k - 15k
    }
  });

  it('should reject without permission', async () => {
    mockPermissionResult = false;
    const result = await profitLoss({ from: '2026-05-01', to: '2026-05-31' }, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});
