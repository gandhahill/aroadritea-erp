/**
 * reporting.cashFlow - SD §21.2
 *
 * Generates a cash-flow movement report from posted journal entries.
 * Direct cash movements are derived from cash-equivalent account lines.
 *
 * Permission: accounting.view
 */

import { db } from '@erp/db';
import { accounts, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, inArray, lt, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { requirePermission } from '../iam';

const DEFAULT_CASH_ACCOUNT_CODES = ['1-1100', '1-1200', '1-1300', '1-1400'];

export interface CashFlowInput {
  /** Start date (inclusive). Format: YYYY-MM-DD. */
  from: string;
  /** End date (inclusive). Format: YYYY-MM-DD. */
  to: string;
  /** Optional location filter. NULL = consolidated. */
  locationId?: string;
  /**
   * Optional cash-equivalent COA codes.
   * Defaults to Aroadri Tea cash-equivalent COA bootstrap accounts.
   */
  cashAccountCodes?: string[];
}

export type CashFlowDirection = 'inflow' | 'outflow';
export type CashFlowKind = 'operating' | 'investing' | 'financing';

export interface CashFlowMovement {
  postingDate: string;
  journalNumber: string;
  journalDescription: string;
  referenceType: string | null;
  referenceId: string | null;
  direction: CashFlowDirection;
  amount: bigint;
}

export interface CashFlowSection {
  label: string;
  kind: CashFlowKind;
  inflow: bigint;
  outflow: bigint;
  net: bigint;
  movements: CashFlowMovement[];
}

export interface CashFlowResult {
  from: string;
  to: string;
  locationId: string | null;
  cashAccountCodes: string[];
  beginningCash: bigint;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netIncrease: bigint;
  endingCash: bigint;
  isPreliminary: boolean;
}

type MovementRow = {
  journalEntryId: string;
  postingDate: string;
  journalNumber: string;
  journalDescription: string;
  referenceType: string | null;
  referenceId: string | null;
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountType: string;
  accountSubtype: string;
  debit: bigint;
  credit: bigint;
};

export async function cashFlow(
  input: CashFlowInput,
  ctx: AuditContext,
): Promise<Result<CashFlowResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    input.locationId ? 'accounting.view' : 'reporting.consolidated',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  if (input.from > input.to) {
    return err(AppError.validation('reporting.cashFlow.invalidDateRange'));
  }

  return tryCatch(
    async () => {
      const requestedCashCodes =
        input.cashAccountCodes?.map((code) => code.trim()).filter(Boolean) ??
        DEFAULT_CASH_ACCOUNT_CODES;

      const cashAccounts = await db
        .select({
          id: accounts.id,
          code: accounts.code,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, ctx.tenantId),
            eq(accounts.isActive, true),
            eq(accounts.isPostable, true),
            inArray(accounts.code, requestedCashCodes),
          ),
        );

      if (cashAccounts.length === 0) {
        throw AppError.validation('reporting.cashFlow.noCashAccounts', {
          cashAccountCodes: requestedCashCodes,
        });
      }

      const cashAccountIds = cashAccounts.map((account) => account.id);
      const cashAccountIdSet = new Set(cashAccountIds);
      const cashAccountCodes = cashAccounts.map((account) => account.code).sort();

      const openingConditions = buildJournalLineConditions(ctx, input.locationId, [
        lt(journalEntries.postingDate, input.from),
        inArray(journalLines.accountId, cashAccountIds),
      ]);

      const openingRows = await db
        .select({
          debit: journalLines.debit,
          credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...openingConditions));

      const beginningCash = openingRows.reduce(
        (sum, row) => sum + BigInt(row.debit) - BigInt(row.credit),
        0n,
      );

      const movementConditions = buildJournalLineConditions(ctx, input.locationId, [
        gte(journalEntries.postingDate, input.from),
        lte(journalEntries.postingDate, input.to),
      ]);

      const movementRows: MovementRow[] = await db
        .select({
          journalEntryId: journalEntries.id,
          postingDate: journalEntries.postingDate,
          journalNumber: journalEntries.number,
          journalDescription: journalEntries.description,
          referenceType: journalEntries.referenceType,
          referenceId: journalEntries.referenceId,
          lineNo: journalLines.lineNo,
          accountId: accounts.id,
          accountCode: accounts.code,
          accountType: accounts.type,
          accountSubtype: accounts.subtype,
          debit: journalLines.debit,
          credit: journalLines.credit,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
        .where(and(...movementConditions))
        .orderBy(journalEntries.postingDate, journalEntries.number, journalLines.lineNo);

      const sections: Record<CashFlowKind, CashFlowSection> = {
        operating: makeSection('Operating Activities', 'operating'),
        investing: makeSection('Investing Activities', 'investing'),
        financing: makeSection('Financing Activities', 'financing'),
      };

      const grouped = groupByJournal(movementRows);
      for (const rows of grouped.values()) {
        const cashChange = rows.reduce((sum, row) => {
          if (!cashAccountIdSet.has(row.accountId)) return sum;
          return sum + BigInt(row.debit) - BigInt(row.credit);
        }, 0n);

        if (cashChange === 0n) continue;

        const first = rows[0];
        if (!first) continue;

        const kind = classifyMovement(rows.filter((row) => !cashAccountIdSet.has(row.accountId)));
        const amount = cashChange < 0n ? -cashChange : cashChange;
        const direction: CashFlowDirection = cashChange > 0n ? 'inflow' : 'outflow';

        addMovement(sections[kind], {
          postingDate: first.postingDate,
          journalNumber: first.journalNumber,
          journalDescription: first.journalDescription,
          referenceType: first.referenceType,
          referenceId: first.referenceId,
          direction,
          amount,
        });
      }

      const netIncrease = sections.operating.net + sections.investing.net + sections.financing.net;

      return {
        from: input.from,
        to: input.to,
        locationId: input.locationId ?? null,
        cashAccountCodes,
        beginningCash,
        operating: sections.operating,
        investing: sections.investing,
        financing: sections.financing,
        netIncrease,
        endingCash: beginningCash + netIncrease,
        isPreliminary: false,
      };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('reporting.cashFlow.failed', e)),
  );
}

function buildJournalLineConditions(
  ctx: AuditContext,
  locationId: string | undefined,
  extra: SQL[],
): SQL[] {
  const conditions: SQL[] = [
    eq(journalEntries.tenantId, ctx.tenantId),
    eq(journalEntries.status, 'posted'),
    ...extra,
  ];

  if (locationId) {
    conditions.push(eq(journalLines.locationId, locationId));
  }

  return conditions;
}

function makeSection(label: string, kind: CashFlowKind): CashFlowSection {
  return {
    label,
    kind,
    inflow: 0n,
    outflow: 0n,
    net: 0n,
    movements: [],
  };
}

function groupByJournal(rows: MovementRow[]): Map<string, MovementRow[]> {
  const grouped = new Map<string, MovementRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.journalEntryId) ?? [];
    existing.push(row);
    grouped.set(row.journalEntryId, existing);
  }
  return grouped;
}

function classifyMovement(counterpartRows: MovementRow[]): CashFlowKind {
  if (counterpartRows.some((row) => isInvestingAccount(row))) {
    return 'investing';
  }

  if (counterpartRows.some((row) => isFinancingAccount(row))) {
    return 'financing';
  }

  return 'operating';
}

function isInvestingAccount(row: MovementRow): boolean {
  return row.accountSubtype === 'fixed_asset' || row.accountCode.startsWith('1-2');
}

function isFinancingAccount(row: MovementRow): boolean {
  return row.accountType === 'equity' || row.accountSubtype === 'long_term_liability';
}

function addMovement(section: CashFlowSection, movement: CashFlowMovement) {
  section.movements.push(movement);
  if (movement.direction === 'inflow') {
    section.inflow += movement.amount;
  } else {
    section.outflow += movement.amount;
  }
  section.net = section.inflow - section.outflow;
}
