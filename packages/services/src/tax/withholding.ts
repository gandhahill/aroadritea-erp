import { db } from '@erp/db';
import { partners, taxRates, withholdingTaxes } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import type { BupotExportOptions } from './bupot21';

export const GenerateBupotInputSchema = z.object({
  vendorId: z.string().uuid(),
  taxCode: z.string(), // e.g. 'PPH23'
  incomeType: z.string(), // e.g. '04' for jasa
  dpp: z.coerce.bigint().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  issueDate: z.string().date(),
  paymentId: z.string().uuid().optional(),
});

export type GenerateBupotInput = z.infer<typeof GenerateBupotInputSchema>;

/**
 * Withholding tax codes that incur the statutory 100%-higher rate when the
 * income recipient has no NPWP (UU PPh Pasal 23 ayat 1a). Final-tax codes
 * (PPh 4(2), PPh Final UMKM) are excluded — they carry no NPWP surcharge.
 */
const NO_NPWP_SURCHARGE_CODES = new Set(['PPH23']);

export async function calculateWithholding(
  dpp: bigint,
  taxCode: string,
  tenantId: string,
  opts: { hasNpwp?: boolean } = {},
): Promise<Result<{ taxAmount: bigint; rateBps: number; surchargeApplied: boolean }>> {
  return tryCatch(
    async () => {
      const [rate] = await db
        .select({ rateBps: taxRates.rateBps })
        .from(taxRates)
        .where(
          and(
            eq(taxRates.tenantId, tenantId),
            eq(taxRates.code, taxCode),
            eq(taxRates.isActive, true),
          ),
        )
        .limit(1);

      if (!rate) {
        throw AppError.notFound('tax.withholding.taxCodeNotFound', { taxCode });
      }

      // No-NPWP surcharge: double the rate for applicable codes when the
      // recipient has no NPWP. `hasNpwp` defaults to true (no surcharge).
      const surchargeApplied =
        opts.hasNpwp === false && NO_NPWP_SURCHARGE_CODES.has(taxCode.toUpperCase());
      const effectiveRateBps = surchargeApplied ? rate.rateBps * 2 : rate.rateBps;

      const taxAmount = (dpp * BigInt(effectiveRateBps)) / 10000n;
      return { taxAmount, rateBps: effectiveRateBps, surchargeApplied };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.withholding.calculationFailed', e);
    },
  );
}

export async function generateBuktiPotong(
  input: GenerateBupotInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; bupotNumber: string }>> {
  const parsed = GenerateBupotInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('tax.withholding.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
      if (!perm.ok) throw perm.error;

      // Resolve vendor NPWP for the no-NPWP withholding surcharge (UU PPh 23(1a)).
      const [vendor] = await db
        .select({ npwp: partners.npwp })
        .from(partners)
        .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.id, data.vendorId)))
        .limit(1);
      const hasNpwp = !!vendor?.npwp && vendor.npwp.replace(/\D/g, '').length > 0;

      const calcRes = await calculateWithholding(data.dpp, data.taxCode, ctx.tenantId, { hasNpwp });
      if (!calcRes.ok) throw calcRes.error;

      // Generate bupot number: BPT-YYYY-MM-0001
      // We do a simple sequence generation using count for the period
      const existing = await db
        .select({ id: withholdingTaxes.id })
        .from(withholdingTaxes)
        .where(
          and(
            eq(withholdingTaxes.tenantId, ctx.tenantId),
            eq(withholdingTaxes.period, data.period),
          ),
        );

      const seq = (existing.length + 1).toString().padStart(4, '0');
      const bupotNumber = `BPT-${data.period}-${seq}`;
      const id = generateId();

      await db.insert(withholdingTaxes).values({
        id,
        tenantId: ctx.tenantId,
        bupotNumber,
        vendorId: data.vendorId,
        taxCode: data.taxCode,
        incomeType: data.incomeType,
        dpp: data.dpp,
        taxAmount: calcRes.value.taxAmount,
        period: data.period,
        issueDate: data.issueDate,
        paymentId: data.paymentId ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'withholding_tax',
        entityId: id,
        before: null,
        after: {
          bupotNumber,
          vendorId: data.vendorId,
          taxAmount: calcRes.value.taxAmount.toString(),
        },
        ctx,
      });

      return { id, bupotNumber };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.withholding.generationFailed', e);
    },
  );
}

export interface BupotSummaryRow {
  id: string;
  bupotNumber: string;
  vendorName: string;
  taxCode: string;
  incomeType: string;
  dpp: string;
  taxAmount: string;
  period: string;
  issueDate: string;
}

export async function listBuktiPotong(
  period: string,
  ctx: AuditContext,
): Promise<Result<BupotSummaryRow[]>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.view');
      if (!perm.ok) throw perm.error;

      const rows = await db
        .select({
          id: withholdingTaxes.id,
          bupotNumber: withholdingTaxes.bupotNumber,
          vendorName: partners.name,
          taxCode: withholdingTaxes.taxCode,
          incomeType: withholdingTaxes.incomeType,
          dpp: withholdingTaxes.dpp,
          taxAmount: withholdingTaxes.taxAmount,
          period: withholdingTaxes.period,
          issueDate: withholdingTaxes.issueDate,
        })
        .from(withholdingTaxes)
        .leftJoin(partners, eq(partners.id, withholdingTaxes.vendorId))
        .where(
          and(
            eq(withholdingTaxes.tenantId, ctx.tenantId),
            period ? eq(withholdingTaxes.period, period) : undefined,
          ),
        )
        .orderBy(desc(withholdingTaxes.issueDate), desc(withholdingTaxes.bupotNumber));

      return rows.map((r) => ({
        ...r,
        vendorName: r.vendorName ?? 'Unknown Vendor',
        dpp: r.dpp.toString(),
        taxAmount: r.taxAmount.toString(),
        issueDate: String(r.issueDate),
      }));
    },
    (e) => AppError.internal('tax.withholding.listFailed', e),
  );
}

// ─── Export Bukti Potong Unifikasi (Coretax BPU bulk XML) ────────────────────

function digitsOnlyOr(value: string | null | undefined, fallback: string): string {
  const d = (value ?? '').replace(/\D/g, '');
  return d.length > 0 ? d : fallback;
}

/**
 * Export period withholdings (PPh 23 etc.) as a Coretax Bukti Potong Unifikasi
 * bulk-import XML (`<BpuBulk>`), per the DJP BPU template.
 *
 * Coretax recomputes tax = TaxBase × Rate%, so Rate is derived from the stored
 * taxAmount/dpp. TaxObjectCode passes through when already a full DJP code
 * (NN-NNN-NN); otherwise falls back to 24-104-06 (PPh 23 jasa lain) for review.
 * Withholder TIN comes from company settings (`company.npwp`).
 */
export async function exportBupotUnifikasiXml(
  period: string,
  ctx: AuditContext,
  opts: BupotExportOptions = {},
): Promise<Result<string>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.export');
      if (!perm.ok) throw perm.error;

      const overrideObjectCode = opts.taxObjectCode?.trim();
      const documentType = opts.document?.trim() || 'Invoice';
      const rateDecimals =
        opts.rateDecimals === undefined || !Number.isFinite(opts.rateDecimals)
          ? 4
          : Math.max(0, Math.min(8, Math.trunc(opts.rateDecimals)));

      if (!/^\d{4}-\d{2}$/.test(period)) {
        throw AppError.validation('tax.bupotUnifikasi.invalidPeriod', { period });
      }
      const taxYear = Number(period.slice(0, 4));
      const taxMonth = Number(period.slice(5, 7));

      const [npwpRow] = await db
        .select({ value: cmsSettings.value })
        .from(cmsSettings)
        .where(and(eq(cmsSettings.tenantId, ctx.tenantId), eq(cmsSettings.key, 'company.npwp')))
        .limit(1);
      const tin = digitsOnlyOr(npwpRow?.value ? String(npwpRow.value) : '', '0000000000000000');

      const rows = await db
        .select({
          bupotNumber: withholdingTaxes.bupotNumber,
          incomeType: withholdingTaxes.incomeType,
          dpp: withholdingTaxes.dpp,
          taxAmount: withholdingTaxes.taxAmount,
          issueDate: withholdingTaxes.issueDate,
          vendorNpwp: partners.npwp,
        })
        .from(withholdingTaxes)
        .leftJoin(partners, eq(partners.id, withholdingTaxes.vendorId))
        .where(
          and(eq(withholdingTaxes.tenantId, ctx.tenantId), eq(withholdingTaxes.period, period)),
        );

      if (rows.length === 0) {
        throw AppError.businessRule('tax.bupotUnifikasi.noData', { period });
      }

      const bpuRows = rows
        .map((r) => {
          const counterpartTin = digitsOnlyOr(r.vendorNpwp ?? '', '0000000000000000');
          const objectCode =
            overrideObjectCode ||
            (/^\d{2}-\d{3}-\d{2}$/.test(r.incomeType) ? r.incomeType : '24-104-06');
          const taxBase = (r.dpp ?? 0n).toString();
          const rate =
            r.dpp && r.dpp > 0n
              ? (Number((r.taxAmount * 10000n) / r.dpp) / 100).toFixed(rateDecimals)
              : '0';
          const docDate = String(r.issueDate);
          const docNumber = (r.bupotNumber ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return [
            '    <Bpu>',
            `      <TaxPeriodMonth>${taxMonth}</TaxPeriodMonth>`,
            `      <TaxPeriodYear>${taxYear}</TaxPeriodYear>`,
            `      <CounterpartTin>${counterpartTin}</CounterpartTin>`,
            '      <IDPlaceOfBusinessActivityOfIncomeRecipient>000000</IDPlaceOfBusinessActivityOfIncomeRecipient>',
            '      <TaxCertificate>N/A</TaxCertificate>',
            `      <TaxObjectCode>${objectCode}</TaxObjectCode>`,
            `      <TaxBase>${taxBase}</TaxBase>`,
            `      <Rate>${rate}</Rate>`,
            `      <Document>${documentType}</Document>`,
            `      <DocumentNumber>${docNumber}</DocumentNumber>`,
            `      <DocumentDate>${docDate}</DocumentDate>`,
            '      <IDPlaceOfBusinessActivity>000000</IDPlaceOfBusinessActivity>',
            '      <GovTreasurerOpt>N/A</GovTreasurerOpt>',
            '      <SP2DNumber />',
            `      <WithholdingDate>${docDate}</WithholdingDate>`,
            '    </Bpu>',
          ].join('\n');
        })
        .join('\n');

      return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<BpuBulk xsi:noNamespaceSchemaLocation="schema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
        `  <TIN>${tin}</TIN>`,
        '  <ListOfBpu>',
        bpuRows,
        '  </ListOfBpu>',
        '</BpuBulk>',
      ].join('\n');
    },
    (e) => (e instanceof AppError ? e : AppError.internal('tax.bupotUnifikasi.exportFailed', e)),
  );
}
