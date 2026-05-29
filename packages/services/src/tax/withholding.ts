import { db } from '@erp/db';
import { taxRates, withholdingTaxes, partners } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

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

export async function calculateWithholding(
  dpp: bigint,
  taxCode: string,
): Promise<Result<{ taxAmount: bigint; rateBps: number }>> {
  return tryCatch(
    async () => {
      const [rate] = await db
        .select({ rateBps: taxRates.rateBps })
        .from(taxRates)
        .where(eq(taxRates.code, taxCode))
        .limit(1);

      if (!rate) {
        throw AppError.notFound('tax.withholding.taxCodeNotFound', { taxCode });
      }

      const taxAmount = (dpp * BigInt(rate.rateBps)) / 10000n;
      return { taxAmount, rateBps: rate.rateBps };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.withholding.calculationFailed', e);
    }
  );
}

export async function generateBuktiPotong(
  input: GenerateBupotInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; bupotNumber: string }>> {
  const parsed = GenerateBupotInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('tax.withholding.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
      if (!perm.ok) throw perm.error;

      const calcRes = await calculateWithholding(data.dpp, data.taxCode);
      if (!calcRes.ok) throw calcRes.error;

      // Generate bupot number: BPT-YYYY-MM-0001
      // We do a simple sequence generation using count for the period
      const existing = await db
        .select({ id: withholdingTaxes.id })
        .from(withholdingTaxes)
        .where(
          and(
            eq(withholdingTaxes.tenantId, ctx.tenantId),
            eq(withholdingTaxes.period, data.period)
          )
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
        after: { bupotNumber, vendorId: data.vendorId, taxAmount: calcRes.value.taxAmount.toString() },
        ctx,
      });

      return { id, bupotNumber };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.withholding.generationFailed', e);
    }
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
            period ? eq(withholdingTaxes.period, period) : undefined
          )
        )
        .orderBy(desc(withholdingTaxes.issueDate), desc(withholdingTaxes.bupotNumber));

      return rows.map(r => ({
        ...r,
        vendorName: r.vendorName ?? 'Unknown Vendor',
        dpp: r.dpp.toString(),
        taxAmount: r.taxAmount.toString(),
        issueDate: String(r.issueDate),
      }));
    },
    (e) => AppError.internal('tax.withholding.listFailed', e)
  );
}
