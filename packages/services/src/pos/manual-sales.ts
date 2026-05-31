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
import { and, desc, eq, inArray, isNull, sql, ne } from 'drizzle-orm';
import { sequences } from '@erp/db/schema/common';
import { createJournal } from '../accounting/create-journal';
import { reverseJournal } from '../accounting/reverse-journal';
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
  const seqName = `${tenantId}:${prefix}`;
  const rows = await db
    .insert(sequences)
    .values({ name: seqName, currentVal: 1 })
    .onConflictDoUpdate({
      target: sequences.name,
      set: { currentVal: sql`${sequences.currentVal} + 1` },
    })
    .returning({ currentVal: sequences.currentVal });
  const next = (rows[0]?.currentVal ?? 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

function toResult(row: typeof manualSalesClosings.$inferSelect): ManualSalesClosingResult {
  let dateStr = String(row.salesDate);
  const rawDate = row.salesDate as any;
  if (typeof rawDate === 'object' && rawDate instanceof Date) {
    const d = rawDate;
    dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else if (typeof rawDate === 'string') {
    dateStr = rawDate.split('T')[0] ?? rawDate;
  }

  return {
    id: row.id,
    number: row.number,
    salesDate: dateStr,
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
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
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

  if (data.consumedIngredients && data.consumedIngredients.length > 0) {
    const deductResult = await deductIngredients(
      ctx.tenantId,
      data.locationId,
      data.consumedIngredients,
      id,
      ctx,
      'manual_sales_closing'
    );
    if (!deductResult.ok) {
      await rollbackAppliedStockDeductions();
      await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'deduction_failed' });
      return err(deductResult.error);
    }
    appliedStockDeductions.push(...deductResult.value);
  }

  if (data.deductBom && data.lineItems.length > 0) {
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
        'manual_sales_closing'
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
        createdBy: data.originalCreatedBy || ctx.userId,
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

  const cogsGroups = new Map<string, { cogsAcc: string; invAcc: string; amount: bigint }>();
  for (const d of appliedStockDeductions) {
    const qtyNum = Number.parseFloat(d.qty);
    const cogsAmount = (d.avgUnitCost * BigInt(Math.round(qtyNum * 1000))) / 1000n;
    if (cogsAmount > 0n) {
      const cAcc = d.cogsAccountId ?? postingConfig.value.defaultCogsAccountId;
      const iAcc = d.inventoryAccountId ?? postingConfig.value.defaultInventoryAccountId;
      const key = `${cAcc}-${iAcc}`;
      const existing = cogsGroups.get(key) ?? { cogsAcc: cAcc, invAcc: iAcc, amount: 0n };
      existing.amount += cogsAmount;
      cogsGroups.set(key, existing);
    }
  }

  const isPureCash = data.paymentMethod.toLowerCase() === 'cash' || data.paymentMethod.toLowerCase() === 'tunai';
  const debitAccountId = isPureCash ? postingConfig.value.pureCashAccountId : postingConfig.value.cashAccountId;

  const jeLines: Array<{
    accountId: string;
    locationId: string;
    description: string;
    debit: string;
    credit: string;
    taxCode?: string;
  }> = [
    {
      accountId: debitAccountId,
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
  ];

  for (const group of cogsGroups.values()) {
    jeLines.push({
      accountId: group.cogsAcc,
      locationId: data.locationId,
      description: `HPP manual sales ${reference}`,
      debit: group.amount.toString(),
      credit: '0',
    });
    jeLines.push({
      accountId: group.invAcc,
      locationId: data.locationId,
      description: `HPP manual sales ${reference}`,
      debit: '0',
      credit: group.amount.toString(),
    });
  }

  const journal = await createJournal(
    {
      postingDate: data.salesDate,
      locationId: data.locationId,
      description: `Manual POS closing ${number} - ${channelLabel}`,
      referenceType: 'manual_sales_closing',
      referenceId: id,
      lines: jeLines,
    },
    ctx, { skipPermissionCheck: true }
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
      const conditions = [
        eq(manualSalesClosings.tenantId, ctx.tenantId),
        ne(manualSalesClosings.status, 'voided')
      ];
      if (params.locationId) conditions.push(eq(manualSalesClosings.locationId, params.locationId));
      const whereClause = and(...conditions);
      const [{ count = 0 } = { count: 0 }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(manualSalesClosings)
        .where(whereClause);
        
      const { users } = await import('@erp/db/schema/auth');
      const { aliasedTable } = await import('drizzle-orm');
      const creators = aliasedTable(users, 'creators');
      const updaters = aliasedTable(users, 'updaters');
      
      const rows = await db
        .select({
          closing: manualSalesClosings,
          createdByName: creators.displayName,
          updatedByName: updaters.displayName,
        })
        .from(manualSalesClosings)
        .leftJoin(creators, eq(manualSalesClosings.createdBy, creators.id))
        .leftJoin(updaters, eq(manualSalesClosings.updatedBy, updaters.id))
        .where(whereClause)
        .orderBy(desc(manualSalesClosings.salesDate), desc(manualSalesClosings.createdAt))
        .limit(params.limit ?? 25)
        .offset(params.offset ?? 0);
        
      return { 
        items: rows.map(r => ({
          ...toResult(r.closing),
          createdByName: r.createdByName,
          updatedByName: r.updatedByName,
        })), 
        total: count 
      };
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


export async function getManualSalesClosingDetail(id: string, ctx: AuditContext) {
  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const closing = await db.query.manualSalesClosings.findFirst({
        where: eq(manualSalesClosings.id, id)
      });
      if (!closing || closing.tenantId !== ctx.tenantId) {
        throw new Error('Not found');
      }

      const { stockMovements, products } = await import('@erp/db/schema/inventory');
      const movements = await db
        .select({
          productId: stockMovements.productId,
          productName: products.name,
          qtyDelta: stockMovements.qtyDelta,
          uom: stockMovements.uom,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .where(
          and(
            eq(stockMovements.tenantId, ctx.tenantId),
            eq(stockMovements.referenceType, 'manual_sales_closing'),
            eq(stockMovements.referenceId, id)
          )
        );

      return {
        closing: toResult(closing),
        lineItems: closing.lineItemsJson || [],
        stockMovements: movements.map(m => ({
          ...m,
          productName: m.productName as Record<string, string>
        }))
      };
    },
    (e) => AppError.internal('pos.manualSales.detailFailed', e)
  );
}

export async function deleteManualSalesClosing(id: string, ctx: AuditContext) {
  const closing = await db
    .select()
    .from(manualSalesClosings)
    .where(and(eq(manualSalesClosings.id, id), eq(manualSalesClosings.tenantId, ctx.tenantId)))
    .then((r) => r[0]);

  if (!closing) {
    return err(AppError.notFound('pos.manualSales.notFound', { id }));
  }

  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: closing.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (closing.status === 'voided') {
    return err(AppError.businessRule('pos.manualSales.alreadyVoided', { id }));
  }

  return tryCatch(
    async () => {
      // 1. Reverse stock movements
      const { stockMovements, stockLevels } = await import('@erp/db/schema/inventory');
      
      const movements = await db
        .select({
          id: stockMovements.id,
          productId: stockMovements.productId,
          qtyDelta: stockMovements.qtyDelta,
          uom: stockMovements.uom,
          stockLevelId: stockLevels.id,
          locationId: stockMovements.locationId,
        })
        .from(stockMovements)
        .leftJoin(
          stockLevels, 
          and(
            eq(stockLevels.productId, stockMovements.productId),
            eq(stockLevels.locationId, stockMovements.locationId),
            eq(stockLevels.tenantId, ctx.tenantId)
          )
        )
        .where(
          and(
            eq(stockMovements.tenantId, ctx.tenantId),
            eq(stockMovements.referenceType, 'manual_sales_closing'),
            eq(stockMovements.referenceId, id)
          )
        );

      const deductions = movements
        .filter(m => m.stockLevelId && m.qtyDelta.startsWith('-'))
        .map(m => ({
          stockLevelId: m.stockLevelId!,
          tenantId: ctx.tenantId,
          locationId: m.locationId,
          ingredientId: m.productId,
          qty: m.qtyDelta.substring(1), // remove negative sign
          uom: m.uom,
          referenceId: id,
          referenceType: 'manual_sales_closing',
          avgUnitCost: 0n,
          cogsAccountId: null,
          inventoryAccountId: null,
        }));

      if (deductions.length > 0) {
        await compensateIngredientDeductions(deductions, ctx, true);
      }

      if (closing.journalEntryId) {
        let pDate = closing.salesDate as string | Date;
        if (pDate instanceof Date) {
          pDate = pDate.toISOString().slice(0, 10);
        } else if (typeof pDate === 'string' && pDate.length > 10) {
          pDate = pDate.substring(0, 10);
        }
        
        const reverseRes = await reverseJournal(
          { journalId: closing.journalEntryId, postingDate: pDate as string },
          ctx,
          { skipPermissionCheck: true }
        );
        if (!reverseRes.ok) {
          // If already reversed, we can proceed safely to void the closing
          const isAlreadyReversed = reverseRes.error.code === 'BUSINESS_RULE' && reverseRes.error.messageKey === 'accounting.journal.cannotReverse';
          if (!isAlreadyReversed) {
            throw reverseRes.error;
          }
        }
      }

      // 3. Mark as voided
      await db
        .update(manualSalesClosings)
        .set({
          status: 'voided',
          updatedBy: ctx.userId,
          updatedAt: new Date(),
          version: sql`${manualSalesClosings.version} + 1`,
        })
        .where(eq(manualSalesClosings.id, id));

      await auditRecord({
        action: 'delete',
        entityType: 'manual_sales_closing',
        entityId: id,
        before: { status: closing.status, version: closing.version },
        after: { status: 'voided', version: closing.version + 1 },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return true;
    },
    (e) => (e instanceof AppError || (e && typeof e === 'object' && 'code' in e && 'messageKey' in e)) ? (e as AppError) : new AppError('INTERNAL', 'pos.manualSales.deleteFailed', e instanceof Error ? e.message : String(e))
  );
}

export async function updateManualSalesClosing(
  id: string,
  input: CreateManualSalesClosingInput,
  ctx: AuditContext
) {
  // We use Delete and Recreate for safe edit
  const deleteRes = await deleteManualSalesClosing(id, ctx);
  if (!deleteRes.ok) return deleteRes;

  return createManualSalesClosing(input, ctx);
}

