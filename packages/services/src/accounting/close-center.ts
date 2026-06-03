/**
 * Financial close control center — read-only readiness checks for monthly close.
 */

import {
  accountingPeriods,
  and,
  bankStatementLines,
  bankStatements,
  count,
  db,
  eq,
  goodsReceiptNotes,
  gte,
  inArray,
  invoices,
  isNull,
  journalEntries,
  lte,
  manualSalesClosings,
  or,
  payrolls,
  purchaseInvoices,
  purchaseOrders,
  shifts,
  sql,
  stockMovements,
  stockOpnameSessions,
  taxInvoices,
  withholdingTaxes,
} from '@erp/db';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import type { SQL } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { requirePermission } from '../iam';

export const GetFinancialCloseCenterInputSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/),
  locationId: z.string().min(1).optional(),
});

export type GetFinancialCloseCenterInput = z.infer<typeof GetFinancialCloseCenterInputSchema>;

export type FinancialCloseStatus = 'ready' | 'warning' | 'blocked';

export type FinancialCloseItemId =
  | 'period'
  | 'journals'
  | 'pos'
  | 'bankRecon'
  | 'inventory'
  | 'apAr'
  | 'tax'
  | 'payroll';

export interface FinancialCloseChecklistItem {
  id: FinancialCloseItemId;
  status: FinancialCloseStatus;
  href: string;
  counts: Record<string, number>;
  meta?: Record<string, string>;
}

export interface FinancialCloseCenterResult {
  periodCode: string;
  locationId: string | null;
  period: {
    id: string | null;
    status: string | null;
    startDate: string;
    endDate: string;
  };
  status: FinancialCloseStatus;
  readinessPercent: number;
  summary: {
    ready: number;
    warning: number;
    blocked: number;
    total: number;
  };
  checklist: FinancialCloseChecklistItem[];
}

type MonthBounds = {
  startDate: string;
  endDate: string;
  startAt: Date;
  endAt: Date;
};

export async function getFinancialCloseCenter(
  input: GetFinancialCloseCenterInput,
  ctx: AuditContext,
): Promise<Result<FinancialCloseCenterResult>> {
  const parsed = GetFinancialCloseCenterInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.closeCenter.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }

  const { periodCode } = parsed.data;
  const locationId = parsed.data.locationId ?? ctx.locationId;
  const permission = await requirePermission(
    ctx.userId,
    'accounting.view',
    locationId ? { locationId } : undefined,
  );
  if (!permission.ok) return permission;

  return tryCatch(
    async () => {
      const period = await db
        .select({
          id: accountingPeriods.id,
          status: accountingPeriods.status,
          startDate: accountingPeriods.startDate,
          endDate: accountingPeriods.endDate,
        })
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.tenantId, ctx.tenantId),
            eq(accountingPeriods.code, periodCode),
            isNull(accountingPeriods.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      const fallbackBounds = monthBounds(periodCode);
      const bounds: MonthBounds = period
        ? boundsFromDates(String(period.startDate), String(period.endDate))
        : fallbackBounds;

      const checklist = await buildChecklist({
        tenantId: ctx.tenantId,
        locationId: locationId || null,
        periodCode,
        period,
        bounds,
      });

      const summary = checklist.reduce(
        (acc, item) => {
          acc[item.status] += 1;
          return acc;
        },
        { ready: 0, warning: 0, blocked: 0, total: checklist.length },
      );
      const status: FinancialCloseStatus =
        summary.blocked > 0 ? 'blocked' : summary.warning > 0 ? 'warning' : 'ready';
      const readinessPercent =
        summary.total === 0 ? 0 : Math.round((summary.ready / summary.total) * 100);

      return {
        periodCode,
        locationId: locationId || null,
        period: {
          id: period?.id ?? null,
          status: period?.status ?? null,
          startDate: bounds.startDate,
          endDate: bounds.endDate,
        },
        status,
        readinessPercent,
        summary,
        checklist,
      };
    },
    (e) => AppError.internal('accounting.closeCenter.fetchFailed', e),
  );
}

async function buildChecklist({
  tenantId,
  locationId,
  periodCode,
  period,
  bounds,
}: {
  tenantId: string;
  locationId: string | null;
  periodCode: string;
  period: { id: string; status: string; startDate: string; endDate: string } | null;
  bounds: MonthBounds;
}): Promise<FinancialCloseChecklistItem[]> {
  const locationFilter = locationId ? eq(journalEntries.locationId, locationId) : undefined;
  const journalPeriodFilter = period
    ? eq(journalEntries.periodId, period.id)
    : and(gte(journalEntries.postingDate, bounds.startDate), lte(journalEntries.postingDate, bounds.endDate));

  const [
    draftJournals,
    unbalancedJournals,
    postedJournals,
    openShifts,
    totalManualClosings,
    unpostedManualClosings,
    totalStatements,
    unreconciledStatements,
    unmatchedBankLines,
    pendingOpname,
    approvedMonthlyOpname,
    stockMovementsWithoutCost,
    draftSalesInvoices,
    openSalesInvoices,
    draftPurchaseInvoices,
    openPurchaseInvoices,
    draftTaxInvoices,
    totalTaxInvoices,
    totalWithholdingTaxes,
    payrollRuns,
    payrollBlockingRuns,
  ] = await Promise.all([
    countRows(journalEntries, [
      eq(journalEntries.tenantId, tenantId),
      journalPeriodFilter,
      locationFilter,
      eq(journalEntries.status, 'draft'),
      isNull(journalEntries.deletedAt),
    ]),
    countRows(journalEntries, [
      eq(journalEntries.tenantId, tenantId),
      journalPeriodFilter,
      locationFilter,
      sql`${journalEntries.totalDebit} <> ${journalEntries.totalCredit}`,
      isNull(journalEntries.deletedAt),
    ]),
    countRows(journalEntries, [
      eq(journalEntries.tenantId, tenantId),
      journalPeriodFilter,
      locationFilter,
      eq(journalEntries.status, 'posted'),
      isNull(journalEntries.deletedAt),
    ]),
    countRows(shifts, [
      eq(shifts.tenantId, tenantId),
      locationId ? eq(shifts.locationId, locationId) : undefined,
      eq(shifts.status, 'open'),
      lte(shifts.openedAt, bounds.endAt),
      isNull(shifts.deletedAt),
    ]),
    countRows(manualSalesClosings, [
      eq(manualSalesClosings.tenantId, tenantId),
      locationId ? eq(manualSalesClosings.locationId, locationId) : undefined,
      gte(manualSalesClosings.salesDate, bounds.startDate),
      lte(manualSalesClosings.salesDate, bounds.endDate),
      isNull(manualSalesClosings.deletedAt),
    ]),
    countRows(manualSalesClosings, [
      eq(manualSalesClosings.tenantId, tenantId),
      locationId ? eq(manualSalesClosings.locationId, locationId) : undefined,
      gte(manualSalesClosings.salesDate, bounds.startDate),
      lte(manualSalesClosings.salesDate, bounds.endDate),
      or(
        sql`${manualSalesClosings.status} NOT IN ('posted', 'voided')`,
        isNull(manualSalesClosings.journalEntryId),
      ),
      isNull(manualSalesClosings.deletedAt),
    ]),
    countRows(bankStatements, [
      eq(bankStatements.tenantId, tenantId),
      locationId ? eq(bankStatements.locationId, locationId) : undefined,
      gte(bankStatements.statementDate, bounds.startDate),
      lte(bankStatements.statementDate, bounds.endDate),
      isNull(bankStatements.deletedAt),
    ]),
    countRows(bankStatements, [
      eq(bankStatements.tenantId, tenantId),
      locationId ? eq(bankStatements.locationId, locationId) : undefined,
      gte(bankStatements.statementDate, bounds.startDate),
      lte(bankStatements.statementDate, bounds.endDate),
      inArray(bankStatements.status, ['draft', 'in_progress']),
      isNull(bankStatements.deletedAt),
    ]),
    countUnmatchedBankLines(tenantId, locationId, bounds),
    countRows(stockOpnameSessions, [
      eq(stockOpnameSessions.tenantId, tenantId),
      locationId ? eq(stockOpnameSessions.locationId, locationId) : undefined,
      eq(stockOpnameSessions.periodCode, periodCode),
      inArray(stockOpnameSessions.status, ['draft', 'in_progress', 'submitted']),
      isNull(stockOpnameSessions.deletedAt),
    ]),
    countRows(stockOpnameSessions, [
      eq(stockOpnameSessions.tenantId, tenantId),
      locationId ? eq(stockOpnameSessions.locationId, locationId) : undefined,
      eq(stockOpnameSessions.periodCode, periodCode),
      eq(stockOpnameSessions.kind, 'monthly'),
      eq(stockOpnameSessions.status, 'approved'),
      isNull(stockOpnameSessions.deletedAt),
    ]),
    countRows(stockMovements, [
      eq(stockMovements.tenantId, tenantId),
      locationId ? eq(stockMovements.locationId, locationId) : undefined,
      gte(stockMovements.occurredAt, bounds.startAt),
      lte(stockMovements.occurredAt, bounds.endAt),
      inArray(stockMovements.reason, ['purchase', 'opening', 'adjustment', 'production', 'transfer_in']),
      sql`${stockMovements.qtyDelta}::numeric > 0`,
      isNull(stockMovements.unitCost),
      isNull(stockMovements.deletedAt),
    ]),
    countRows(invoices, [
      eq(invoices.tenantId, tenantId),
      locationId ? eq(invoices.locationId, locationId) : undefined,
      eq(invoices.type, 'sales'),
      eq(invoices.status, 'draft'),
      gte(invoices.date, bounds.startDate),
      lte(invoices.date, bounds.endDate),
      isNull(invoices.deletedAt),
    ]),
    countRows(invoices, [
      eq(invoices.tenantId, tenantId),
      locationId ? eq(invoices.locationId, locationId) : undefined,
      eq(invoices.type, 'sales'),
      inArray(invoices.status, ['posted', 'partial']),
      gte(invoices.date, bounds.startDate),
      lte(invoices.date, bounds.endDate),
      sql`${invoices.amountPaid} < ${invoices.total}`,
      isNull(invoices.deletedAt),
    ]),
    countPurchaseInvoices(tenantId, locationId, bounds, 'draft'),
    countPurchaseInvoices(tenantId, locationId, bounds, 'verified', true),
    countRows(taxInvoices, [
      eq(taxInvoices.tenantId, tenantId),
      eq(taxInvoices.taxPeriod, periodCode),
      eq(taxInvoices.status, 'draft'),
      isNull(taxInvoices.deletedAt),
    ]),
    countRows(taxInvoices, [
      eq(taxInvoices.tenantId, tenantId),
      eq(taxInvoices.taxPeriod, periodCode),
      isNull(taxInvoices.deletedAt),
    ]),
    countRows(withholdingTaxes, [
      eq(withholdingTaxes.tenantId, tenantId),
      eq(withholdingTaxes.period, periodCode),
      isNull(withholdingTaxes.deletedAt),
    ]),
    countRows(payrolls, [
      eq(payrolls.tenantId, tenantId),
      locationId ? eq(payrolls.locationId, locationId) : undefined,
      eq(payrolls.periodCode, periodCode),
      isNull(payrolls.deletedAt),
    ]),
    countRows(payrolls, [
      eq(payrolls.tenantId, tenantId),
      locationId ? eq(payrolls.locationId, locationId) : undefined,
      eq(payrolls.periodCode, periodCode),
      sql`${payrolls.status} NOT IN ('paid', 'cancelled')`,
      isNull(payrolls.deletedAt),
    ]),
  ]);

  const items: FinancialCloseChecklistItem[] = [
    {
      id: 'period',
      status: period ? 'ready' : 'blocked',
      href: '/accounting/periods',
      counts: {
        periodFound: period ? 1 : 0,
      },
      meta: period
        ? {
            periodStatus: period.status,
          }
        : undefined,
    },
    {
      id: 'journals',
      status: draftJournals > 0 || unbalancedJournals > 0 ? 'blocked' : 'ready',
      href: `/accounting/journals?periodCode=${periodCode}${locationId ? `&locationId=${locationId}` : ''}`,
      counts: {
        draftJournals,
        unbalancedJournals,
        postedJournals,
      },
    },
    {
      id: 'pos',
      status:
        openShifts > 0 || unpostedManualClosings > 0
          ? 'blocked'
          : totalManualClosings === 0
            ? 'warning'
            : 'ready',
      href: `/pos/manual-sales?periodCode=${periodCode}${locationId ? `&locationId=${locationId}` : ''}`,
      counts: {
        openShifts,
        unpostedManualClosings,
        totalManualClosings,
      },
    },
    {
      id: 'bankRecon',
      status:
        unreconciledStatements > 0 || unmatchedBankLines > 0
          ? 'blocked'
          : totalStatements === 0
            ? 'warning'
            : 'ready',
      href: '/accounting/bank-recon',
      counts: {
        unreconciledStatements,
        unmatchedBankLines,
        totalStatements,
      },
    },
    {
      id: 'inventory',
      status:
        pendingOpname > 0
          ? 'blocked'
          : approvedMonthlyOpname === 0 || stockMovementsWithoutCost > 0
            ? 'warning'
            : 'ready',
      href: `/inventory/opname?periodCode=${periodCode}${locationId ? `&locationId=${locationId}` : ''}`,
      counts: {
        pendingOpname,
        approvedMonthlyOpname,
        stockMovementsWithoutCost,
      },
    },
    {
      id: 'apAr',
      status:
        draftSalesInvoices > 0 || draftPurchaseInvoices > 0
          ? 'blocked'
          : openSalesInvoices > 0 || openPurchaseInvoices > 0
            ? 'warning'
            : 'ready',
      href: `/accounting/payables?periodCode=${periodCode}`,
      counts: {
        draftSalesInvoices,
        openSalesInvoices,
        draftPurchaseInvoices,
        openPurchaseInvoices,
      },
    },
    {
      id: 'tax',
      status: draftTaxInvoices > 0 ? 'blocked' : 'ready',
      href: `/tax/spt?period=${periodCode}`,
      counts: {
        draftTaxInvoices,
        taxInvoices: totalTaxInvoices,
        withholdingTaxes: totalWithholdingTaxes,
      },
    },
    {
      id: 'payroll',
      status:
        payrollBlockingRuns > 0 ? 'blocked' : payrollRuns === 0 ? 'warning' : 'ready',
      href: `/hr/payroll?periodCode=${periodCode}${locationId ? `&locationId=${locationId}` : ''}`,
      counts: {
        payrollRuns,
        payrollBlockingRuns,
      },
    },
  ];

  return items;
}

async function countPurchaseInvoices(
  tenantId: string,
  locationId: string | null,
  bounds: MonthBounds,
  status: string,
  unpaidOnly = false,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(purchaseInvoices)
    .leftJoin(purchaseOrders, eq(purchaseInvoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(goodsReceiptNotes, eq(purchaseInvoices.grnId, goodsReceiptNotes.id))
    .where(
      and(
        eq(purchaseInvoices.tenantId, tenantId),
        eq(purchaseInvoices.status, status),
        gte(purchaseInvoices.invoiceDate, bounds.startDate),
        lte(purchaseInvoices.invoiceDate, bounds.endDate),
        locationId
          ? or(eq(purchaseOrders.locationId, locationId), eq(goodsReceiptNotes.locationId, locationId))
          : undefined,
        unpaidOnly ? sql`${purchaseInvoices.paidAmount} < ${purchaseInvoices.grandTotal}` : undefined,
        isNull(purchaseInvoices.deletedAt),
      ),
    );
  return Number(rows[0]?.value ?? 0);
}

async function countUnmatchedBankLines(
  tenantId: string,
  locationId: string | null,
  bounds: MonthBounds,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(bankStatementLines)
    .innerJoin(bankStatements, eq(bankStatementLines.statementId, bankStatements.id))
    .where(
      and(
        eq(bankStatements.tenantId, tenantId),
        locationId ? eq(bankStatements.locationId, locationId) : undefined,
        gte(bankStatements.statementDate, bounds.startDate),
        lte(bankStatements.statementDate, bounds.endDate),
        eq(bankStatementLines.matchStatus, 'unmatched'),
        isNull(bankStatements.deletedAt),
        isNull(bankStatementLines.deletedAt),
      ),
    );
  return Number(rows[0]?.value ?? 0);
}

async function countRows(
  table: AnyPgTable,
  conditions: Array<SQL | undefined>,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(table)
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}

function monthBounds(periodCode: string): MonthBounds {
  const [yearText, monthText] = periodCode.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const startDate = `${periodCode}-01`;
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return boundsFromDates(startDate, endDate);
}

function boundsFromDates(startDate: string, endDate: string): MonthBounds {
  return {
    startDate,
    endDate,
    startAt: new Date(`${startDate}T00:00:00.000+07:00`),
    endAt: new Date(`${endDate}T23:59:59.999+07:00`),
  };
}
