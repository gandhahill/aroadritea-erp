/**
 * POS manual sales closing.
 *
 * Used while an outlet still runs an old POS. At closing, the cashier posts
 * one audited daily total. It creates a balanced, posted journal using the
 * same POS account settings as live POS sales.
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { locations } from '@erp/db/schema/auth';
import { manualSalesClosings } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { requirePermission } from '../iam';
import {
  autoPostJournalEntry,
  extractInclusiveTax,
  humanizeChannel,
  resolvePosPostingConfig,
} from './posting';
import {
  CreateManualSalesClosingInputSchema,
  type CreateManualSalesClosingInput,
  type ManualSalesClosingResult,
} from './schemas';

async function generateManualSalesNumber(tenantId: string, salesDate: string): Promise<string> {
  const prefix = `MSC-${salesDate.slice(0, 7)}-`;
  const result = await db.execute(
    sql`SELECT COUNT(*) FROM manual_sales_closings WHERE tenant_id = ${tenantId} AND number LIKE ${`${prefix}%`}`,
  );
  const count = Number(result.rows[0]?.count ?? 0);
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
}

function toResult(row: typeof manualSalesClosings.$inferSelect): ManualSalesClosingResult {
  return {
    id: row.id,
    number: row.number,
    salesDate: row.salesDate,
    locationId: row.locationId,
    channel: row.channel,
    paymentMethod: row.paymentMethod,
    transactionCount: row.transactionCount,
    grossSales: row.grossSales.toString(),
    discountTotal: row.discountTotal.toString(),
    taxTotal: row.taxTotal.toString(),
    netRevenue: row.netRevenue.toString(),
    sourceReference: row.sourceReference,
    notes: row.notes,
    status: row.status,
    journalEntryId: row.journalEntryId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function markManualSalesFailed(id: string, ctx: AuditContext, errorCode: string) {
  await tryCatch(
    async () => {
      await db
        .update(manualSalesClosings)
        .set({
          status: 'failed',
          notes: sql`concat(coalesce(${manualSalesClosings.notes}, ''), ${`\n${errorCode}`})`,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
          version: sql`${manualSalesClosings.version} + 1`,
        })
        .where(and(eq(manualSalesClosings.id, id), eq(manualSalesClosings.tenantId, ctx.tenantId)));
    },
    (e) => AppError.internal('pos.manualSales.markFailedFailed', e),
  );
}

export async function createManualSalesClosing(
  input: CreateManualSalesClosingInput,
  ctx: AuditContext,
): Promise<Result<ManualSalesClosingResult>> {
  const parsed = CreateManualSalesClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.manualSales.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const grossSales = BigInt(data.grossSales);
  const discountTotal = BigInt(data.discountTotal);
  if (discountTotal > grossSales) {
    return err(
      AppError.businessRule('pos.manualSales.discountExceedsGross', {
        grossSales: grossSales.toString(),
        discountTotal: discountTotal.toString(),
      }),
    );
  }

  const postingConfig = await resolvePosPostingConfig(ctx.tenantId, data.locationId, data.salesDate);
  if (!postingConfig.ok) return postingConfig;

  const taxableBase = grossSales - discountTotal;
  const { net, tax } = extractInclusiveTax(taxableBase, postingConfig.value.taxRateBps);
  const id = generateId();
  const number = await generateManualSalesNumber(ctx.tenantId, data.salesDate);
  const channelLabel = humanizeChannel(data.channel);
  const reference = data.sourceReference?.trim() || number;

  const createResult = await tryCatch(
    async () => {
      await db.insert(manualSalesClosings).values({
        id,
        tenantId: ctx.tenantId,
        locationId: data.locationId,
        number,
        salesDate: data.salesDate,
        channel: data.channel,
        paymentMethod: data.paymentMethod,
        transactionCount: data.transactionCount,
        grossSales,
        discountTotal,
        taxTotal: tax,
        netRevenue: net,
        sourceReference: data.sourceReference ?? null,
        notes: data.notes ?? null,
        status: 'draft',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      return true;
    },
    (e) => AppError.internal('pos.manualSales.createFailed', e),
  );
  if (!createResult.ok) return err(createResult.error);

  const journal = await createJournal(
    {
      postingDate: data.salesDate,
      locationId: data.locationId,
      description: `Manual POS closing ${number} - ${channelLabel}`,
      referenceType: 'manual_sales_closing',
      referenceId: id,
      lines: [
        {
          accountId: postingConfig.value.cashAccountId,
          locationId: data.locationId,
          description: `${data.paymentMethod} settlement ${reference}`,
          debit: taxableBase.toString(),
          credit: '0',
        },
        {
          accountId: postingConfig.value.revenueAccountId,
          locationId: data.locationId,
          description: `Manual sales revenue ${reference}`,
          debit: '0',
          credit: net.toString(),
        },
        {
          accountId: postingConfig.value.taxAccountId,
          locationId: data.locationId,
          description: `PB1 manual sales ${reference}`,
          debit: '0',
          credit: tax.toString(),
          taxCode: postingConfig.value.taxCode,
        },
      ],
    },
    ctx,
  );

  if (!journal.ok) {
    await markManualSalesFailed(id, ctx, journal.error.code);
    return err(journal.error);
  }
  const postResult = await autoPostJournalEntry(journal.value.id, ctx, 'pos.manualSales');
  if (!postResult.ok) {
    await markManualSalesFailed(id, ctx, postResult.error.code);
    return postResult;
  }

  const [updated] = await db
    .update(manualSalesClosings)
    .set({
      status: 'posted',
      journalEntryId: journal.value.id,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
      version: sql`${manualSalesClosings.version} + 1`,
    })
    .where(and(eq(manualSalesClosings.id, id), eq(manualSalesClosings.tenantId, ctx.tenantId)))
    .returning();

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'manual_sales_closing',
    entityId: id,
    before: null,
    after: {
      number,
      salesDate: data.salesDate,
      channel: data.channel,
      paymentMethod: data.paymentMethod,
      grossSales: grossSales.toString(),
      discountTotal: discountTotal.toString(),
      taxTotal: tax.toString(),
      netRevenue: net.toString(),
      journalEntryId: journal.value.id,
    },
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
  });

  if (!updated) {
    return err(AppError.internal('pos.manualSales.linkJournalFailed', { id }));
  }
  return ok(toResult(updated));
}

export async function listManualSalesClosings(
  params: { locationId?: string; limit?: number; offset?: number },
  ctx: AuditContext,
): Promise<Result<{ items: ManualSalesClosingResult[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: params.locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const conditions = [eq(manualSalesClosings.tenantId, ctx.tenantId)];
      if (params.locationId) conditions.push(eq(manualSalesClosings.locationId, params.locationId));
      const whereClause = and(...conditions);
      const [{ count = 0 } = { count: 0 }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(manualSalesClosings)
        .where(whereClause);
      const rows = await db
        .select()
        .from(manualSalesClosings)
        .where(whereClause)
        .orderBy(desc(manualSalesClosings.salesDate), desc(manualSalesClosings.createdAt))
        .limit(params.limit ?? 25)
        .offset(params.offset ?? 0);
      return { items: rows.map(toResult), total: count };
    },
    (e) => AppError.internal('pos.manualSales.listFailed', e),
  );
}

export async function listManualSalesLocations(ctx: AuditContext) {
  const rows = await db
    .select({ id: locations.id, code: locations.code, name: locations.name })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active')))
    .orderBy(locations.code);
  return rows;
}
