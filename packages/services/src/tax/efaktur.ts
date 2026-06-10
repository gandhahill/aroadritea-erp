import { db } from '@erp/db';
import { nsfpBlocks, taxInvoices } from '@erp/db/schema/accounting';
import { invoiceLines, invoices } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

type InvoiceLineExportRow = typeof invoiceLines.$inferSelect;

// ─── Register NSFP Block ─────────────────────────────────────────────────────

export const RegisterNsfpBlockSchema = z.object({
  startNsfp: z.string().min(13).max(20),
  endNsfp: z.string().min(13).max(20),
  issueDate: z.string().date(), // YYYY-MM-DD
});

export type RegisterNsfpBlockInput = z.infer<typeof RegisterNsfpBlockSchema>;

function escapeCsvField(value: unknown): string {
  return String(value ?? '').replace(/"/g, '""');
}

export async function registerNsfpBlock(
  input: RegisterNsfpBlockInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = RegisterNsfpBlockSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('tax.efaktur.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  // Clean non-numeric chars
  const startNum = data.startNsfp.replace(/\D/g, '');
  const endNum = data.endNsfp.replace(/\D/g, '');

  if (startNum.length !== endNum.length || startNum.length < 13) {
    return err(AppError.businessRule('tax.efaktur.invalidLength', { length: startNum.length }));
  }

  if (BigInt(startNum) > BigInt(endNum)) {
    return err(AppError.businessRule('tax.efaktur.startGreaterThanEnd'));
  }

  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
      if (!perm.ok) throw perm.error;

      // Check for overlap
      const existingBlocks = await db
        .select()
        .from(nsfpBlocks)
        .where(eq(nsfpBlocks.tenantId, ctx.tenantId));

      const newStart = BigInt(startNum);
      const newEnd = BigInt(endNum);

      for (const block of existingBlocks) {
        const bStart = BigInt(block.startNsfp.replace(/\D/g, ''));
        const bEnd = BigInt(block.endNsfp.replace(/\D/g, ''));

        if (newStart <= bEnd && newEnd >= bStart) {
          throw AppError.conflict('tax.efaktur.overlap', {
            existingStart: block.startNsfp,
            existingEnd: block.endNsfp,
          });
        }
      }

      const id = generateId();
      await db.insert(nsfpBlocks).values({
        id,
        tenantId: ctx.tenantId,
        startNsfp: startNum,
        endNsfp: endNum,
        lastUsedNsfp: null,
        issueDate: data.issueDate,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'nsfp_block',
        entityId: id,
        before: null,
        after: {
          startNsfp: startNum,
          endNsfp: endNum,
          issueDate: data.issueDate,
        },
        ctx,
      });

      return { id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.efaktur.registerFailed', e);
    },
  );
}

// ─── Generate Tax Invoice ────────────────────────────────────────────────────

/**
 * Given a sales invoice, finds the next NSFP and creates a tax invoice.
 */
export async function generateTaxInvoice(
  invoiceId: string,
  ctx: AuditContext,
): Promise<Result<{ nsfp: string; id: string }>> {
  return tryCatch(
    async () => {
      // 1. Get the invoice
      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)))
        .limit(1);

      if (!inv) {
        throw AppError.notFound('accounting.invoice.notFound', { invoiceId });
      }
      if (inv.type !== 'sales') {
        throw AppError.businessRule('tax.efaktur.onlySalesInvoices');
      }

      // Check if already generated
      const [existing] = await db
        .select()
        .from(taxInvoices)
        .where(eq(taxInvoices.invoiceId, invoiceId))
        .limit(1);

      if (existing) {
        return { nsfp: existing.nsfp, id: existing.id };
      }

      // 2. Find available NSFP block
      // Active blocks ordered by issue date
      const blocks = await db
        .select()
        .from(nsfpBlocks)
        .where(and(eq(nsfpBlocks.tenantId, ctx.tenantId), eq(nsfpBlocks.isActive, true)))
        .orderBy(asc(nsfpBlocks.issueDate), asc(nsfpBlocks.startNsfp));

      let selectedNsfp = null;
      let selectedBlockId = null;

      for (const block of blocks) {
        let nextNsfpInt: bigint;
        if (block.lastUsedNsfp) {
          nextNsfpInt = BigInt(block.lastUsedNsfp) + BigInt(1);
        } else {
          nextNsfpInt = BigInt(block.startNsfp);
        }

        const endNsfpInt = BigInt(block.endNsfp);
        if (nextNsfpInt <= endNsfpInt) {
          selectedNsfp = nextNsfpInt.toString().padStart(block.startNsfp.length, '0');
          selectedBlockId = block.id;
          break;
        }

        // Block exhausted
        await db
          .update(nsfpBlocks)
          .set({ isActive: false, updatedBy: ctx.userId })
          .where(eq(nsfpBlocks.id, block.id));
      }

      if (!selectedNsfp || !selectedBlockId) {
        throw AppError.businessRule('tax.efaktur.noNsfpAvailable');
      }

      // Claim the NSFP atomically
      const claimResult = await db
        .update(nsfpBlocks)
        .set({
          lastUsedNsfp: selectedNsfp,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(nsfpBlocks.id, selectedBlockId),
            // ensure no one else took it if it was null
            sql`${nsfpBlocks.lastUsedNsfp} IS NOT DISTINCT FROM ${blocks.find((b) => b.id === selectedBlockId)?.lastUsedNsfp ?? null}`,
          ),
        )
        .returning({ id: nsfpBlocks.id });

      if (claimResult.length === 0) {
        // Concurrency collision, bubble up and let retry handle
        throw AppError.conflict('tax.efaktur.nsfpClaimCollision');
      }

      // 3. Format Date / Period
      const dateStr = inv.date; // YYYY-MM-DD
      const periodStr = dateStr.substring(0, 7); // YYYY-MM

      // 4. Create Tax Invoice record
      const id = generateId();
      await db.insert(taxInvoices).values({
        id,
        tenantId: ctx.tenantId,
        nsfp: selectedNsfp,
        invoiceId: invoiceId,
        issueDate: dateStr,
        taxPeriod: periodStr,
        customerName: inv.partnerName,
        customerNpwp: inv.partnerNpwp ?? '000000000000000', // Default if missing
        dpp: inv.subtotal, // Subtotal is DPP
        ppn: inv.taxAmount, // Ensure taxAmount is populated with PPN
        status: 'posted',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'tax_invoice',
        entityId: id,
        before: null,
        after: { nsfp: selectedNsfp, invoiceId, taxPeriod: periodStr },
        ctx,
      });

      return { nsfp: selectedNsfp, id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('tax.efaktur.generateFailed', e);
    },
  );
}

// ─── Export e-Faktur CSV ─────────────────────────────────────────────────────

export async function exportEFakturCsv(
  period: string, // YYYY-MM
  ctx: AuditContext,
): Promise<Result<string>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.export');
      if (!perm.ok) throw perm.error;

      // 1. Fetch Tax Invoices for Period
      const rows = await db
        .select({
          nsfp: taxInvoices.nsfp,
          customerName: taxInvoices.customerName,
          customerNpwp: taxInvoices.customerNpwp,
          customerAddress: invoices.partnerAddress,
          dpp: taxInvoices.dpp,
          ppn: taxInvoices.ppn,
          issueDate: taxInvoices.issueDate,
          invoiceId: taxInvoices.invoiceId,
          status: taxInvoices.status,
        })
        .from(taxInvoices)
        .innerJoin(invoices, eq(taxInvoices.invoiceId, invoices.id))
        .where(
          and(
            eq(taxInvoices.tenantId, ctx.tenantId),
            eq(invoices.tenantId, ctx.tenantId),
            eq(taxInvoices.taxPeriod, period),
            // Only export posted invoices, cancelled might need separate treatment
            // but production Coretax treatment must follow the active DJP template.
          ),
        )
        .orderBy(asc(taxInvoices.nsfp));

      // 2. Fetch lines
      const invoiceIds = rows.map((r) => r.invoiceId);
      const linesMap: Record<string, InvoiceLineExportRow[]> = {};

      if (invoiceIds.length > 0) {
        const lines = await db
          .select()
          .from(invoiceLines)
          .where(inArray(invoiceLines.invoiceId, invoiceIds));

        for (const line of lines) {
          const arr = linesMap[line.invoiceId] ?? [];
          arr.push(line);
          linesMap[line.invoiceId] = arr;
        }
      }

      // 3. Format CSV scaffold for e-Faktur/Coretax Pajak Keluaran.
      // Production filing must be verified against the active Coretax template.
      // Format:
      // FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI
      // OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM

      let csv =
        'FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI\n';
      csv +=
        'OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM\n';

      for (const row of rows) {
        // e-Faktur requires specific NSFP format string.
        // Assuming KD_JENIS_TRANSAKSI = '01', FG_PENGGANTI = '0' for normal.
        const masa = period.substring(5, 7);
        const tahun = period.substring(0, 4);

        // Format YYYY-MM-DD to DD/MM/YYYY without timezone conversion.
        const [tahunFaktur, bulanFaktur, tanggalFaktur] = row.issueDate.split('-');
        const dateStr = `${tanggalFaktur}/${bulanFaktur}/${tahunFaktur}`;

        // Clean NPWP
        const npwp = row.customerNpwp ? row.customerNpwp.replace(/\D/g, '') : '000000000000000';
        const customerName = escapeCsvField(row.customerName);
        const customerAddress = escapeCsvField(row.customerAddress);

        // Output FK row
        csv += `"FK","01","0","${row.nsfp}","${masa}","${tahun}","${dateStr}","${npwp}","${customerName}","${customerAddress}","${row.dpp.toString()}","${row.ppn.toString()}","0","","0","0","0","0",""\n`;

        // Output OF rows (lines)
        const lines = linesMap[row.invoiceId] ?? [];
        for (const line of lines) {
          csv += `"OF","0000","${escapeCsvField(line.description)}","${line.unitPrice.toString()}","${line.quantity}","${line.subtotal.toString()}","0","${line.subtotal.toString()}","${line.taxAmount.toString()}","0","0"\n`;
        }
      }

      return csv;
    },
    (e) => AppError.internal('tax.efaktur.exportFailed', e),
  );
}
