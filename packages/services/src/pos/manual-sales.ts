/**
 * POS manual sales closing.
 *
 * Used while an outlet still runs an old POS. At closing, the cashier posts
 * one audited daily total. It creates a balanced, posted journal using the
 * same POS account settings as live POS sales.
 */

import { db } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { manualSalesClosings, shifts } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { auditRecord } from '../audit';
import { getAuthorizedLocations, requirePermission } from '../iam';
import { claimIdempotency, releaseIdempotencyClaim, saveIdempotency } from '../shared/idempotency';
import {
  compensateIngredientDeductions,
  deductIngredients,
  getBOMIngredients,
} from './create-sale';
import {
  autoPostJournalEntry,
  extractInclusiveTax,
  humanizeChannel,
  resolvePosPostingConfig,
} from './posting';
import {
  type CreateManualSalesClosingInput,
  CreateManualSalesClosingInputSchema,
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

  const postingConfig = await resolvePosPostingConfig(
    ctx.tenantId,
    data.locationId,
    data.salesDate,
  );
  if (!postingConfig.ok) return postingConfig;

  const taxableBase = grossSales - discountTotal;
  const { net, tax } = extractInclusiveTax(taxableBase, postingConfig.value.taxRateBps);
  const id = generateId();
  const number = await generateManualSalesNumber(ctx.tenantId, data.salesDate);
  const channelLabel = humanizeChannel(data.channel);
  const reference = data.sourceReference?.trim() || number;

  const claimResult = await claimIdempotency(
    data.locationId,
    data.idempotencyKey,
    'pos.manualSales',
  );
  if (!claimResult.ok) return claimResult;
  const claimedIdempotencyId = claimResult.value.id;

  const openShift = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, ctx.tenantId),
        eq(shifts.locationId, data.locationId),
        eq(shifts.status, 'open'),
      ),
    )
    .then((r) => r[0] ?? null);
  const shiftId = openShift?.id ?? null;

  let appliedStockDeductions: Awaited<ReturnType<typeof deductIngredients>> extends Result<infer T>
    ? T
    : never = [];
  const rollbackAppliedStockDeductions = async () => {
    if (appliedStockDeductions.length === 0) return;
    await compensateIngredientDeductions(appliedStockDeductions, ctx, true);
    appliedStockDeductions = [];
  };

  if (data.lineItems.length > 0) {
    for (const line of data.lineItems) {
      const ingredients = await getBOMIngredients(
        ctx.tenantId,
        line.productId,
        line.variantId ?? null,
        line.qty,
      );

      const deductResult = await deductIngredients(
        ctx.tenantId,
        data.locationId,
        ingredients,
        id,
        ctx,
      );
      if (!deductResult.ok) {
        await rollbackAppliedStockDeductions();
        await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'deduction_failed' });
        return err(deductResult.error);
      }
      appliedStockDeductions.push(...deductResult.value);
    }
  }

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
        shiftId,
        lineItemsJson: data.lineItems.length > 0 ? data.lineItems : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      return true;
    },
    (e) => AppError.internal('pos.manualSales.createFailed', e),
  );
  if (!createResult.ok) {
    await rollbackAppliedStockDeductions();
    await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'create_failed' });
    return err(createResult.error);
  }

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
    await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'journal_failed' });
    await markManualSalesFailed(id, ctx, journal.error.code);
    return err(journal.error);
  }
  const postResult = await autoPostJournalEntry(journal.value.id, ctx, 'pos.manualSales');
  if (!postResult.ok) {
    await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'post_failed' });
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

  await auditRecord({
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
      shiftId,
    },
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    ctx,
  });

  if (!updated) {
    await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'update_failed' });
    return err(AppError.internal('pos.manualSales.linkJournalFailed', { id }));
  }

  const resultObj = toResult(updated);
  await saveIdempotency(db, data.locationId, data.idempotencyKey, 201, resultObj);
  return ok(resultObj);
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
  const locationScope = await getAuthorizedLocations(ctx.userId, 'pos.transact');
  if (locationScope.scope === 'location' && locationScope.locationIds.length === 0) return [];

  const conditions = [
    eq(locations.tenantId, ctx.tenantId),
    eq(locations.status, 'active'),
    eq(locations.type, 'store'),
    isNull(locations.deletedAt),
  ];
  if (locationScope.scope === 'location') {
    conditions.push(inArray(locations.id, locationScope.locationIds));
  }

  const rows = await db
    .select({ id: locations.id, code: locations.code, name: locations.name })
    .from(locations)
    .where(and(...conditions))
    .orderBy(locations.code);
  return rows;
}
