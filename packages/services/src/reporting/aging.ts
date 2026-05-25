/**
 * reporting.aging — T-0174.
 *
 * Aging report for receivables (AR, default account `1-1500` Piutang
 * Usaha) and payables (AP, default account `2-1100` Utang Usaha).
 *
 * Source: posted `journal_lines` against the selected account, grouped
 * by partner. Bucket = today − (dueDate ?? postingDate).
 *
 * Permission: `accounting.view`.
 */

import { db } from '@erp/db';
import {
  accounts,
  journalEntries,
  journalLines,
  partners,
} from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

export type AgingKind = 'AR' | 'AP';

export interface AgingInput {
  kind: AgingKind;
  /** YYYY-MM-DD — "today" anchor for bucket arithmetic. */
  asOf: string;
  /** Optional location filter; otherwise consolidated. */
  locationId?: string;
  /** Override the default account code (`1-1500` / `2-1100`). */
  accountCode?: string;
}

export interface AgingBuckets {
  current: string; // 0-30 days
  bucket_31_60: string;
  bucket_61_90: string;
  bucket_over_90: string;
  total: string;
}

export interface AgingPartnerRow {
  partnerId: string | null;
  partnerName: string;
  buckets: AgingBuckets;
  /** Number of open journal lines for this partner. */
  lineCount: number;
}

export interface AgingLineDetail {
  journalLineId: string;
  journalNumber: string;
  postingDate: string;
  dueDate: string | null;
  daysOverdue: number;
  amount: string; // signed: positive = outstanding in this kind
  bucket: keyof Omit<AgingBuckets, 'total'>;
  description: string | null;
}

export interface AgingResult {
  kind: AgingKind;
  asOf: string;
  locationId: string | null;
  accountCode: string;
  partners: AgingPartnerRow[];
  totals: AgingBuckets;
  /** Flat list of every line so the UI can render a drill-down. */
  details: AgingLineDetail[];
}

const DEFAULT_ACCOUNT: Record<AgingKind, string> = {
  AR: '1-1500',
  AP: '2-1100',
};

function bucketFromDays(daysOverdue: number): keyof Omit<AgingBuckets, 'total'> {
  if (daysOverdue <= 30) return 'current';
  if (daysOverdue <= 60) return 'bucket_31_60';
  if (daysOverdue <= 90) return 'bucket_61_90';
  return 'bucket_over_90';
}

function emptyBuckets(): AgingBuckets {
  return {
    current: '0',
    bucket_31_60: '0',
    bucket_61_90: '0',
    bucket_over_90: '0',
    total: '0',
  };
}

function add(target: AgingBuckets, key: keyof AgingBuckets, value: bigint): void {
  target[key] = (BigInt(target[key]) + value).toString();
}

export async function aging(input: AgingInput, ctx: AuditContext): Promise<Result<AgingResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    'accounting.view',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const accountCode = input.accountCode ?? DEFAULT_ACCOUNT[input.kind];

      const [account] = await db
        .select({ id: accounts.id, code: accounts.code, name: accounts.name })
        .from(accounts)
        .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.code, accountCode)))
        .limit(1);
      if (!account) {
        throw AppError.notFound('reporting.aging.accountNotFound', { code: accountCode });
      }

      const conditions = [
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.postingDate, input.asOf),
        eq(journalLines.accountId, account.id),
      ];
      if (input.locationId) conditions.push(eq(journalLines.locationId, input.locationId));

      const rows = await db
        .select({
          journalLineId: journalLines.id,
          journalEntryId: journalLines.journalEntryId,
          journalNumber: journalEntries.number,
          partnerId: journalLines.partnerId,
          postingDate: journalEntries.postingDate,
          dueDate: journalLines.dueDate,
          debit: journalLines.debit,
          credit: journalLines.credit,
          description: journalLines.description,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(...conditions));

      // Partner lookup so we can show readable names (encrypted email
      // not surfaced — `partners.name` is plain).
      const partnerIds = Array.from(new Set(rows.map((r) => r.partnerId).filter(Boolean) as string[]));
      const partnerRows = partnerIds.length
        ? await db
            .select({ id: partners.id, name: partners.name })
            .from(partners)
            .where(and(eq(partners.tenantId, ctx.tenantId)))
        : [];
      // partners.name is plain text — no decryption needed.
      const partnerMap = new Map(partnerRows.map((p) => [p.id, p.name] as const));

      const asOfMs = new Date(`${input.asOf}T00:00:00+07:00`).getTime();
      const perPartner = new Map<string, AgingPartnerRow>();
      const details: AgingLineDetail[] = [];
      const totals = emptyBuckets();

      for (const row of rows) {
        // AR: outstanding = debit - credit. AP: outstanding = credit - debit.
        const amount =
          input.kind === 'AR'
            ? BigInt(row.debit) - BigInt(row.credit)
            : BigInt(row.credit) - BigInt(row.debit);

        // Skip lines where the partner has been fully settled (or never
        // had a balance to begin with).
        if (amount === 0n) continue;
        // Negative balance means the partner owes us nothing (or even
        // has credit). Skip — the aging report focuses on what is open.
        if (amount < 0n) continue;

        const anchor = row.dueDate ?? row.postingDate;
        const anchorMs = new Date(`${anchor}T00:00:00+07:00`).getTime();
        const daysOverdue = Math.max(0, Math.floor((asOfMs - anchorMs) / (1000 * 60 * 60 * 24)));
        const bucket = bucketFromDays(daysOverdue);

        const key = row.partnerId ?? '__none__';
        const existing = perPartner.get(key) ?? {
          partnerId: row.partnerId,
          partnerName: row.partnerId
            ? (partnerMap.get(row.partnerId) ?? row.partnerId)
            : '(tanpa partner)',
          buckets: emptyBuckets(),
          lineCount: 0,
        };
        add(existing.buckets, bucket, amount);
        add(existing.buckets, 'total', amount);
        existing.lineCount += 1;
        perPartner.set(key, existing);

        add(totals, bucket, amount);
        add(totals, 'total', amount);

        details.push({
          journalLineId: row.journalLineId,
          journalNumber: row.journalNumber,
          postingDate: row.postingDate,
          dueDate: row.dueDate,
          daysOverdue,
          amount: amount.toString(),
          bucket,
          description: row.description,
        });
      }

      // Sort partners by total descending so the largest debtors / creditors
      // surface first.
      const partnersSorted = Array.from(perPartner.values()).sort((a, b) =>
        BigInt(b.buckets.total) > BigInt(a.buckets.total)
          ? 1
          : BigInt(b.buckets.total) < BigInt(a.buckets.total)
            ? -1
            : 0,
      );

      // Detail rows sorted oldest first so the UI shows worst offenders.
      details.sort((a, b) => b.daysOverdue - a.daysOverdue);

      return {
        kind: input.kind,
        asOf: input.asOf,
        locationId: input.locationId ?? null,
        accountCode,
        partners: partnersSorted,
        totals,
        details,
      };
    },
    (e) =>
      e instanceof AppError ? e : AppError.internal('reporting.aging.failed', e),
  );
}
