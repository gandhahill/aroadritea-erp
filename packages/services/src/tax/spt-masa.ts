import { db } from '@erp/db';
import {
  invoices,
  journalEntries,
  journalLines,
  taxInvoices,
  taxRates,
} from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

export interface SptMasaSummary {
  periodId: string;
  totalPpnOut: bigint;
  totalPpnIn: bigint;
  netPayable: bigint; // positive = underpaid (kurang bayar), negative = overpaid (lebih bayar)
}

export interface VatLedgerRow {
  journalLineId: string;
  postingDate: string;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  partnerName: string;
  dpp: bigint;
  ppn: bigint;
  nsfp?: string; // If available
}

export async function calculateSptMasa(
  periodId: string,
  ctx: AuditContext,
): Promise<Result<SptMasaSummary>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.view');
      if (!perm.ok) throw perm.error;

      // PPN_OUT is usually a credit on the PPN_OUT account.
      // PPN_IN is usually a debit on the PPN_IN account.
      // We rely on taxCode from journalLines.
      const rows = await db
        .select({
          taxCode: journalLines.taxCode,
          totalDebit: sql<bigint>`SUM(${journalLines.debit})`.mapWith(BigInt),
          totalCredit: sql<bigint>`SUM(${journalLines.credit})`.mapWith(BigInt),
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(
          and(
            eq(journalEntries.tenantId, ctx.tenantId),
            eq(journalEntries.periodId, periodId),
            eq(journalEntries.status, 'posted'),
            sql`${journalLines.taxCode} IN ('PPN_OUT', 'PPN_IN')`,
          ),
        )
        .groupBy(journalLines.taxCode);

      let totalPpnOut = 0n;
      let totalPpnIn = 0n;

      for (const row of rows) {
        if (row.taxCode === 'PPN_OUT') {
          // Output VAT is a liability, increases with Credit, decreases with Debit (e.g. returns)
          totalPpnOut = row.totalCredit - row.totalDebit;
        } else if (row.taxCode === 'PPN_IN') {
          // Input VAT is an asset, increases with Debit, decreases with Credit
          totalPpnIn = row.totalDebit - row.totalCredit;
        }
      }

      return {
        periodId,
        totalPpnOut,
        totalPpnIn,
        netPayable: totalPpnOut - totalPpnIn,
      };
    },
    (e) => AppError.internal('tax.sptMasa.calculationFailed', e),
  );
}

export async function getVatLedger(
  periodId: string,
  type: 'in' | 'out',
  ctx: AuditContext,
): Promise<Result<VatLedgerRow[]>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.view');
      if (!perm.ok) throw perm.error;

      const targetTaxCode = type === 'out' ? 'PPN_OUT' : 'PPN_IN';

      const rateRows = await db
        .select({ rateBps: taxRates.rateBps })
        .from(taxRates)
        .where(
          and(
            eq(taxRates.tenantId, ctx.tenantId),
            eq(taxRates.code, targetTaxCode),
            eq(taxRates.isActive, true),
          ),
        )
        .limit(1);
      if (!rateRows[0]) {
        throw AppError.businessRule('tax.sptMasa.rateNotFound', { taxCode: targetTaxCode });
      }
      // rateBps e.g. 1100 = 11% effective VAT (2025 non-lux: 12% x DPP 11/12).
      // Keep full precision in BigInt numerator.
      // DPP = ppn * 10000 / rateBps (avoids loss of sub-integer rates like 1050 bps).
      const rateBpsBigInt = BigInt(rateRows[0].rateBps);

      const rows = await db
        .select({
          lineId: journalLines.id,
          postingDate: journalEntries.postingDate,
          referenceType: journalEntries.referenceType,
          referenceId: journalEntries.referenceId,
          description: journalLines.description,
          debit: journalLines.debit,
          credit: journalLines.credit,
          // Get partner name from the invoice if reference is sales/purchase
          invoicePartnerName: invoices.partnerName,
          // Get NSFP if it's an output tax invoice
          nsfp: taxInvoices.nsfp,
          // Try to get DPP from invoice subtotal, or estimate it
          invoiceSubtotal: invoices.subtotal,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .leftJoin(
          invoices,
          and(
            eq(journalEntries.referenceId, invoices.id),
            sql`${journalEntries.referenceType} IN ('sales', 'purchase')`,
          ),
        )
        .leftJoin(taxInvoices, eq(invoices.id, taxInvoices.invoiceId))
        .where(
          and(
            eq(journalEntries.tenantId, ctx.tenantId),
            eq(journalEntries.periodId, periodId),
            eq(journalEntries.status, 'posted'),
            eq(journalLines.taxCode, targetTaxCode),
          ),
        )
        .orderBy(desc(journalEntries.postingDate));

      const ledger: VatLedgerRow[] = rows.map((r) => {
        const ppn = type === 'out' ? r.credit - r.debit : r.debit - r.credit;

        // If we have invoiceSubtotal, use it as DPP. Otherwise, back-calculate from PPN.
        // Formula: DPP = ppn * 10000 / rateBps (guard against zero rate).
        const dpp = r.invoiceSubtotal
          ? r.invoiceSubtotal
          : rateBpsBigInt > 0n
            ? (ppn * 10000n) / rateBpsBigInt
            : 0n;

        return {
          journalLineId: r.lineId,
          postingDate: r.postingDate,
          referenceType: r.referenceType,
          referenceId: r.referenceId,
          description: r.description,
          partnerName: r.invoicePartnerName ?? 'Unknown / Retail',
          dpp,
          ppn,
          nsfp: r.nsfp ?? undefined,
        };
      });

      return ledger;
    },
    (e) => AppError.internal('tax.sptMasa.ledgerFailed', e),
  );
}

export async function exportSptMasaCsv(
  periodId: string,
  ctx: AuditContext,
): Promise<Result<string>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.export');
      if (!perm.ok) throw perm.error;

      const outLedger = await getVatLedger(periodId, 'out', ctx);
      const inLedger = await getVatLedger(periodId, 'in', ctx);

      if (!outLedger.ok) throw outLedger.error;
      if (!inLedger.ok) throw inLedger.error;

      let csv = 'TYPE,DATE,REFERENCE,DESCRIPTION,PARTNER,NSFP,DPP,PPN\n';

      for (const row of outLedger.value) {
        csv += `OUT,${row.postingDate},${row.referenceId ?? ''},"${row.description?.replace(/"/g, '""') ?? ''}","${row.partnerName}",${row.nsfp ?? ''},${row.dpp.toString()},${row.ppn.toString()}\n`;
      }
      for (const row of inLedger.value) {
        csv += `IN,${row.postingDate},${row.referenceId ?? ''},"${row.description?.replace(/"/g, '""') ?? ''}","${row.partnerName}",${row.nsfp ?? ''},${row.dpp.toString()},${row.ppn.toString()}\n`;
      }

      return csv;
    },
    (e) => AppError.internal('tax.sptMasa.exportFailed', e),
  );
}
