/**
 * Reporting Server Actions — fetches financial reports for UI.
 * SD §21.2: Reporting output pages.
 */

'use server';

import { trialBalance as tbService } from '@erp/services/reporting';
import { balanceSheet as bsService } from '@erp/services/reporting';
import { profitLoss as plService } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';

function makeCtx(tenantId: string): AuditContext {
  return {
    userId: 'system',
    tenantId,
    locationId: '',
    ipAddress: '127.0.0.1',
  };
}

export async function fetchTrialBalance(tenantId: string, asOf: string, locationId?: string) {
  const result = await tbService({ asOf, locationId }, makeCtx(tenantId));
  if (!result.ok) return null;

  return {
    ...result.value,
    totalDebit: String(result.value.totalDebit),
    totalCredit: String(result.value.totalCredit),
    lines: result.value.lines.map((l) => ({
      ...l,
      totalDebit: String(l.totalDebit),
      totalCredit: String(l.totalCredit),
      balance: String(l.balance),
    })),
  };
}

export async function fetchBalanceSheet(tenantId: string, asOf: string, locationId?: string) {
  const result = await bsService({ asOf, locationId }, makeCtx(tenantId));
  if (!result.ok) return null;

  const serializeSection = (s: typeof result.value.assets) => ({
    label: s.label,
    total: String(s.total),
    accounts: s.accounts.map((a) => ({
      ...a,
      balance: String(a.balance),
    })),
  });

  return {
    asOf: result.value.asOf,
    locationId: result.value.locationId,
    assets: serializeSection(result.value.assets),
    liabilities: serializeSection(result.value.liabilities),
    equity: serializeSection(result.value.equity),
    retainedEarnings: String(result.value.retainedEarnings),
    totalEquityWithRetained: String(result.value.totalEquityWithRetained),
    totalLiabilitiesAndEquity: String(result.value.totalLiabilitiesAndEquity),
    isBalanced: result.value.isBalanced,
    isPreliminary: result.value.isPreliminary,
  };
}

export async function fetchProfitLoss(tenantId: string, from: string, to: string, locationId?: string) {
  const result = await plService({ from, to, locationId }, makeCtx(tenantId));
  if (!result.ok) return null;

  const serializeSection = (s: typeof result.value.revenue) => ({
    label: s.label,
    total: String(s.total),
    lines: s.lines.map((l) => ({
      ...l,
      balance: String(l.balance),
    })),
  });

  return {
    from: result.value.from,
    to: result.value.to,
    locationId: result.value.locationId,
    revenue: serializeSection(result.value.revenue),
    cogs: serializeSection(result.value.cogs),
    grossProfit: String(result.value.grossProfit),
    expenses: serializeSection(result.value.expenses),
    netIncome: String(result.value.netIncome),
    isPreliminary: result.value.isPreliminary,
  };
}
