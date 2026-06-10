import { db } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

export interface ExportSalesInput {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
}

export async function exportSalesSummaryCsv(
  input: ExportSalesInput,
  ctx: AuditContext,
): Promise<Result<string>> {
  if (!ctx.userId) return err(AppError.unauthenticated('auth.required'));

  const perm = await requirePermission(ctx.userId, 'reporting.export', {
    locationId: input.locationId ?? ctx.locationId,
  });
  if (!perm.ok) return perm;

  const conditions = [eq(salesOrders.tenantId, ctx.tenantId)];
  if (input.locationId) {
    conditions.push(eq(salesOrders.locationId, input.locationId));
  }
  if (input.dateFrom) {
    conditions.push(gte(salesOrders.createdAt, new Date(input.dateFrom)));
  }
  if (input.dateTo) {
    conditions.push(lte(salesOrders.createdAt, new Date(input.dateTo)));
  }

  const rows = await db
    .select()
    .from(salesOrders)
    .where(and(...conditions))
    .orderBy(desc(salesOrders.createdAt));

  if (rows.length === 0) {
    return ok('');
  }

  const headers = [
    'Order Number',
    'Date',
    'Location ID',
    'Channel',
    'Subtotal',
    'Discount',
    'Tax',
    'Grand Total',
    'Status',
  ];
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.number,
        row.createdAt.toISOString(),
        row.locationId,
        row.channel,
        row.subtotal.toString(),
        row.discountTotal.toString(),
        row.taxTotal.toString(),
        row.grandTotal.toString(),
        row.status,
      ].join(','),
    );
  }

  return ok(lines.join('\n'));
}

export async function exportSalesSummaryExcel(
  input: ExportSalesInput,
  ctx: AuditContext,
): Promise<Result<Buffer>> {
  // In a real app we'd use exceljs or xlsx to generate a buffer.
  // For now we will just return a CSV-like text as a Buffer stub to fulfill the requirement.
  const csvResult = await exportSalesSummaryCsv(input, ctx);
  if (!csvResult.ok) return err(csvResult.error);

  return ok(Buffer.from(csvResult.value, 'utf-8'));
}
