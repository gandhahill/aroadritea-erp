'use server';

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, inArray, isNull, sql } from '@erp/db';
import { products, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { auditRecord } from '@erp/services/audit';
import { requirePermission } from '@erp/services/iam';
import { deletePosDraft, listManualSalesLocations } from '@erp/services/pos';
import { deductIngredients } from '@erp/services/pos/create-sale';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { describeDeductError } from '../deduct-error';

const MANUAL_INGREDIENT_CONSUMPTION = 'manual_ingredient_consumption';

interface ConsumedIngredientLine {
  ingredientId: string;
  name?: string;
  qty: number;
  uom: string;
}

interface ConsumedHistoryItemLine {
  name: string;
  qty: string;
  uom: string;
}

function pickLocalized(value: unknown, locale: string): string {
  const record = value as Record<string, string> | null | undefined;
  if (!record) return '';
  const key = locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : 'id';
  return record[key] ?? record.id ?? record.en ?? record.zh ?? '';
}

function parseConsumedHistoryItems(value: unknown, locale: string): ConsumedHistoryItemLine[] {
  let rawItems: unknown = value;
  if (typeof value === 'string') {
    try {
      rawItems = JSON.parse(value) as unknown;
    } catch {
      rawItems = [];
    }
  }
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      name: pickLocalized(record.name, locale) || '-',
      qty: String(record.qty ?? ''),
      uom: String(record.uom ?? ''),
    };
  });
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchConsumedIngredientsData(page = 1, requestedPageSize = 10) {
  const ctx = await getAuditContext();
  const pageSize = Math.max(
    1,
    Math.min(100, Number.isFinite(requestedPageSize) ? requestedPageSize : 10),
  );
  const currentPage = Math.max(1, Number.isFinite(page) ? page : 1);
  if (!ctx) {
    return {
      locations: [],
      ingredients: [],
      history: { items: [], total: 0, page: currentPage, pageSize },
      error: 'Unauthenticated',
    };
  }

  const locale = await getLocale();

  const [locationRows, ingredientsList, historyRows, totalRows] = await Promise.all([
    listManualSalesLocations(ctx),
    db
      .execute<{
        id: string;
        name: string;
        uom: string;
      }>(
        sql`
      SELECT 
        p.id, 
        COALESCE(p.name->>'id', p.name->>'en', 'Ingredient') as name,
        p.uom
      FROM products p
      WHERE p.tenant_id = ${ctx.tenantId} AND p.is_active = true AND p.kind IN ('raw_material', 'consumable')
      ORDER BY p.sku ASC
      `,
      )
      .then((res) => res),
    db.execute<{
      id: string;
      occurredAt: Date;
      locationId: string;
      locationCode: string | null;
      locationName: Record<string, string> | null;
      itemCount: number;
      items: unknown;
      notes: string | null;
      createdByName: string | null;
      updatedByName: string | null;
    }>(sql`
      SELECT
        sm.reference_id as "id",
        min(sm.occurred_at) as "occurredAt",
        sm.location_id as "locationId",
        l.code as "locationCode",
        l.name as "locationName",
        cast(count(*) as int) as "itemCount",
        json_agg(
          json_build_object(
            'name', hp.name,
            'qty', abs(sm.qty_delta)::text,
            'uom', sm.uom
          )
          ORDER BY hp.sku, hp.id
        ) as "items",
        max(sm.notes) as "notes",
        max(u.display_name) as "createdByName",
        max(updater.display_name) as "updatedByName"
      FROM stock_movements sm
      LEFT JOIN locations l ON l.id = sm.location_id
      LEFT JOIN products hp ON hp.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.created_by
      LEFT JOIN users updater ON updater.id = sm.updated_by
      WHERE sm.tenant_id = ${ctx.tenantId}
        AND sm.reference_type = ${MANUAL_INGREDIENT_CONSUMPTION}
        AND sm.reason = 'sale'
        AND sm.reference_id IS NOT NULL
        AND sm.deleted_at IS NULL
      GROUP BY sm.reference_id, sm.location_id, l.code, l.name
      ORDER BY min(sm.occurred_at) DESC
      LIMIT ${pageSize}
      OFFSET ${(currentPage - 1) * pageSize}
    `),
    db.execute<{ count: number }>(sql`
      SELECT cast(count(*) as int) as "count"
      FROM (
        SELECT sm.reference_id
        FROM stock_movements sm
        WHERE sm.tenant_id = ${ctx.tenantId}
          AND sm.reference_type = ${MANUAL_INGREDIENT_CONSUMPTION}
          AND sm.reason = 'sale'
          AND sm.reference_id IS NOT NULL
          AND sm.deleted_at IS NULL
        GROUP BY sm.reference_id
      ) grouped
    `),
  ]);

  return {
    locations: locationRows.map((row) => ({
      id: row.id,
      code: row.code,
      label: `${row.code} - ${pickLocalized(row.name, locale)}`,
    })),
    ingredients: ingredientsList.map((i) => ({
      id: i.id,
      name: i.name,
      uom: i.uom,
    })),
    history: {
      items: historyRows.map((row) => ({
        id: row.id,
        occurredAt:
          row.occurredAt instanceof Date
            ? row.occurredAt.toISOString()
            : new Date(row.occurredAt).toISOString(),
        locationId: row.locationId,
        locationLabel:
          `${row.locationCode ?? ''} - ${pickLocalized(row.locationName, locale)}`.trim(),
        itemCount: Number(row.itemCount ?? 0),
        items: parseConsumedHistoryItems(row.items, locale),
        notes: row.notes ?? null,
        createdByName: row.createdByName,
        updatedByName: row.updatedByName,
      })),
      total: Number(totalRows[0]?.count ?? 0),
      page: currentPage,
      pageSize,
    },
  };
}

async function reverseConsumedIngredients(
  referenceId: string,
  ctx: AuditContext,
  messages?: { notFound?: string },
) {
  const movements = await db
    .select({
      id: stockMovements.id,
      locationId: stockMovements.locationId,
      stockLocationId: stockMovements.stockLocationId,
      productId: stockMovements.productId,
      qtyDelta: stockMovements.qtyDelta,
      uom: stockMovements.uom,
      createdBy: stockMovements.createdBy,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenantId),
        eq(stockMovements.referenceType, MANUAL_INGREDIENT_CONSUMPTION),
        eq(stockMovements.referenceId, referenceId),
        eq(stockMovements.reason, 'sale'),
        isNull(stockMovements.deletedAt),
      ),
    );

  if (movements.length === 0) {
    return {
      ok: false as const,
      error: messages?.notFound ?? 'Consumed ingredient entry not found.',
    };
  }

  const locationId = movements[0]?.locationId ?? ctx.locationId;
  const perm = await requirePermission(ctx.userId, 'pos.transact', { locationId });
  if (!perm.ok) return { ok: false as const, error: perm.error.messageKey ?? perm.error.message };

  const now = new Date();
  for (const movement of movements) {
    const qtyToRestore = Math.abs(Number.parseFloat(String(movement.qtyDelta))).toString();
    const stockWhere = [
      eq(stockLevels.tenantId, ctx.tenantId),
      eq(stockLevels.locationId, movement.locationId),
      eq(stockLevels.productId, movement.productId),
      isNull(stockLevels.variantId),
      movement.stockLocationId
        ? eq(stockLevels.stockLocationId, movement.stockLocationId)
        : isNull(stockLevels.stockLocationId),
    ];

    await db
      .update(stockLevels)
      .set({
        qtyOnHand: sql`${stockLevels.qtyOnHand} + ${qtyToRestore}::numeric`,
        qtyAvailable: sql`${stockLevels.qtyAvailable} + ${qtyToRestore}::numeric`,
        updatedAt: now,
        updatedBy: ctx.userId,
        lastMovementAt: now,
      })
      .where(and(...stockWhere));

    await db.insert(stockMovements).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: movement.locationId,
      occurredAt: now,
      stockLocationId: movement.stockLocationId,
      productId: movement.productId,
      variantId: null,
      batchNo: null,
      qtyDelta: qtyToRestore,
      uom: movement.uom,
      reason: 'sale_rollback',
      referenceType: MANUAL_INGREDIENT_CONSUMPTION,
      referenceId,
      unitCost: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  await db
    .update(stockMovements)
    .set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId })
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenantId),
        inArray(
          stockMovements.id,
          movements.map((movement) => movement.id),
        ),
      ),
    );

  await auditRecord({
    action: 'delete',
    entityType: 'stock_movement',
    entityId: referenceId,
    before: { movementIds: movements.map((movement) => movement.id), status: 'active' },
    after: { status: 'reversed', reversedCount: movements.length },
    metadata: { reason: MANUAL_INGREDIENT_CONSUMPTION },
    ctx,
  });

  return { ok: true as const };
}

export async function fetchConsumedIngredientDetailAction(referenceId: string) {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { ok: false as const, error: t('errorUnauthenticated') };

  const locale = await getLocale();
  const rows = await db
    .select({
      id: stockMovements.id,
      occurredAt: stockMovements.occurredAt,
      locationId: stockMovements.locationId,
      ingredientId: stockMovements.productId,
      productName: products.name,
      qtyDelta: stockMovements.qtyDelta,
      uom: stockMovements.uom,
      notes: stockMovements.notes,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenantId),
        eq(stockMovements.referenceType, MANUAL_INGREDIENT_CONSUMPTION),
        eq(stockMovements.referenceId, referenceId),
        eq(stockMovements.reason, 'sale'),
        isNull(stockMovements.deletedAt),
      ),
    );

  if (rows.length === 0) return { ok: false as const, error: t('consumedNotFound') };
  const locationId = rows[0]?.locationId ?? ctx.locationId;
  const perm = await requirePermission(ctx.userId, 'pos.transact', { locationId });
  if (!perm.ok) return { ok: false as const, error: perm.error.messageKey ?? perm.error.message };

  return {
    ok: true as const,
    value: {
      referenceId,
      locationId,
      date:
        rows[0]?.occurredAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) ??
        new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
      notes: rows[0]?.notes ?? '',
      consumedIngredients: rows.map((row) => ({
        ingredientId: row.ingredientId,
        name: pickLocalized(row.productName, locale),
        qty: Math.abs(Number.parseFloat(String(row.qtyDelta))),
        uom: row.uom,
      })),
    },
  };
}

export async function createConsumedIngredientsAction(_prev: any, formData: FormData) {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { error: t('errorUnauthenticated') };

  let consumedIngredients: ConsumedIngredientLine[] = [];
  try {
    const rawConsumed = formData.get('consumedIngredientsJson') as string;
    if (rawConsumed) {
      consumedIngredients = JSON.parse(rawConsumed);
    }
  } catch (e) {
    return { error: t('errorInvalidConsumedIngredients') };
  }

  if (consumedIngredients.length === 0) {
    return { error: t('errorMinConsumedIngredients') };
  }

  const locationId = (formData.get('locationId') as string) || ctx.locationId;
  const existingReferenceId = String(formData.get('referenceId') ?? '').trim();
  const referenceId = existingReferenceId || generateId();
  const consumptionDate = String(formData.get('date') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  // Preserve original creator when editing (mirrors manual sales behavior)
  let originalCreatedBy: string | null = null;
  if (existingReferenceId) {
    const existingMovements = await db
      .select({ createdBy: stockMovements.createdBy })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, ctx.tenantId),
          eq(stockMovements.referenceType, MANUAL_INGREDIENT_CONSUMPTION),
          eq(stockMovements.referenceId, existingReferenceId),
          eq(stockMovements.reason, 'sale'),
        ),
      )
      .orderBy(asc(stockMovements.createdAt))
      .limit(1);
    originalCreatedBy = existingMovements[0]?.createdBy ?? null;

    const reversed = await reverseConsumedIngredients(existingReferenceId, ctx, {
      notFound: t('consumedNotFound'),
    });
    if (!reversed.ok) return { error: reversed.error };
  }

  const deductResult = await deductIngredients(
    ctx.tenantId,
    locationId,
    consumedIngredients.map((item) => ({ ...item, qty: String(item.qty) })),
    referenceId,
    ctx,
    MANUAL_INGREDIENT_CONSUMPTION,
  );

  if (!deductResult.ok) {
    return {
      error: t('errorDeductStockFailed', {
        error: await describeDeductError(deductResult.error, ctx.tenantId),
      }),
    };
  }

  {
    const updateSet: Record<string, unknown> = {
      notes,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    // Restore original creator when editing so "dibuat oleh" stays correct
    if (originalCreatedBy) {
      updateSet.createdBy = originalCreatedBy;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(consumptionDate)) {
      const occurredAt = new Date(`${consumptionDate}T00:00:00+07:00`);
      if (Number.isFinite(occurredAt.getTime())) {
        updateSet.occurredAt = occurredAt;
      }
    }

    await db
      .update(stockMovements)
      .set(updateSet)
      .where(
        and(
          eq(stockMovements.tenantId, ctx.tenantId),
          eq(stockMovements.referenceType, MANUAL_INGREDIENT_CONSUMPTION),
          eq(stockMovements.referenceId, referenceId),
          eq(stockMovements.reason, 'sale'),
          isNull(stockMovements.deletedAt),
        ),
      );
  }

  // T-0296: the entry posted successfully, so the loaded draft is spent.
  const draftId = String(formData.get('draftId') ?? '').trim();
  if (draftId) await deletePosDraft(draftId, ctx);

  revalidatePath('/pos/manual-sales');
  revalidatePath('/pos/manual-sales/consumed');
  revalidatePath('/inventory/stock');
  revalidatePath('/inventory/stock-adjustments');
  return { ok: true };
}

export async function deleteConsumedIngredientsAction(referenceId: string) {
  const ctx = await getAuditContext();
  const t = await getTranslations('pos.manualSales');
  if (!ctx) return { ok: false as const, error: t('errorUnauthenticated') };
  const result = await reverseConsumedIngredients(referenceId, ctx, {
    notFound: t('consumedNotFound'),
  });
  if (!result.ok) return result;
  revalidatePath('/pos/manual-sales/consumed');
  revalidatePath('/inventory/stock');
  return { ok: true as const };
}
