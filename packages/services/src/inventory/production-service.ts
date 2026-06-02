import { db } from '@erp/db';
import {
  bomLines,
  boms,
  productionBatchLines,
  productionBatches,
  products,
  stockLevels,
  stockMovements,
} from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createJournal } from '../accounting/create-journal';
import { resolveAccountIdsByCodes } from '../accounting/account-resolver';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { depleteStock } from './stock-depletion-service';

export const CreateProductionInputSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  qtyProduced: z.number().positive(),
  productionDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type CreateProductionInput = z.infer<typeof CreateProductionInputSchema>;

function scaledUnitCost(totalCost: bigint, qty: number): bigint {
  const scaledQty = BigInt(Math.round(qty * 1000));
  if (scaledQty <= 0n) return 0n;
  return (totalCost * 1000n) / scaledQty;
}

async function generateProductionNumber(client: any, tenantId: string, productionDate: string) {
  const prefix = `PROD-${productionDate.substring(0, 7)}-`;
  const rows = await client
    .select({ count: sql<number>`count(*)` })
    .from(productionBatches)
    .where(
      and(
        eq(productionBatches.tenantId, tenantId),
        sql`${productionBatches.number} LIKE ${prefix + '%'}`,
      ),
    );

  const currentCount = Number(rows[0]?.count ?? 0);
  return `${prefix}${(currentCount + 1).toString().padStart(4, '0')}`;
}

export async function createProductionBatch(
  input: CreateProductionInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateProductionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }),
    );
  }

  const permCheck = await requirePermission(ctx.userId, 'inventory.stock.write', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const productionDate = (
    input.productionDate ? new Date(input.productionDate) : new Date()
  )
    .toISOString()
    .slice(0, 10);

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.tenantId, ctx.tenantId)));

  if (!product) return err(AppError.notFound('inventory.product_not_found'));

  const [bom] = await db
    .select()
    .from(boms)
    .where(
      and(eq(boms.productId, input.productId), eq(boms.tenantId, ctx.tenantId), eq(boms.isActive, true)),
    )
    .limit(1);

  if (!bom) return err(AppError.businessRule('inventory.production.no_active_bom'));

  const bomLinesData = await db.select().from(bomLines).where(eq(bomLines.bomId, bom.id));
  if (bomLinesData.length === 0) {
    return err(AppError.businessRule('inventory.production.empty_bom'));
  }

  const ingredientIds = [...new Set(bomLinesData.map((line) => line.ingredientId))];
  const ingredientProducts = await db
    .select({
      id: products.id,
      inventoryAccountId: products.inventoryAccountId,
    })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, ingredientIds)));
  const ingredientMap = new Map(ingredientProducts.map((row) => [row.id, row]));

  const acctCodes = await getPostingAccountCodes(ctx.tenantId);
  const accountIds = await resolveAccountIdsByCodes(ctx.tenantId, [acctCodes.inventory]);
  const fallbackInventoryAccountId = accountIds.get(acctCodes.inventory) ?? null;
  const finishedInventoryAccountId = product.inventoryAccountId ?? fallbackInventoryAccountId;

  if (!finishedInventoryAccountId) {
    return err(AppError.businessRule('inventory.production.inventory_account_not_found'));
  }

  for (const line of bomLinesData) {
    if (!ingredientMap.has(line.ingredientId)) {
      return err(
        AppError.notFound('inventory.production.ingredient_not_found', {
          productId: line.ingredientId,
        }),
      );
    }
  }

  const batchId = generateId();

  try {
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const productionNumber = await generateProductionNumber(tx, ctx.tenantId, productionDate);
      const batchLines: Array<typeof productionBatchLines.$inferInsert> = [];
      const rawMaterialValueByAccount = new Map<string, bigint>();
      let totalCost = 0n;

      for (const line of bomLinesData) {
        const qtyNeeded = (Number(line.qty) / Number(bom.yieldQty || 1)) * input.qtyProduced;
        const depletionResult = await depleteStock(
          {
            locationId: input.locationId,
            productId: line.ingredientId,
            qtyToDeplete: qtyNeeded,
            reason: 'production',
            referenceId: batchId,
            referenceType: 'production',
          },
          ctx,
          { tx },
        );

        if (!depletionResult.ok) throw depletionResult.error;
        if (depletionResult.value.depletedBatches.some((batch) => batch.unitCost === null)) {
          throw AppError.businessRule('inventory.production.missing_ingredient_cost', {
            productId: line.ingredientId,
          });
        }

        const lineCost = depletionResult.value.totalCost;
        const ingredient = ingredientMap.get(line.ingredientId);
        const rawMaterialAccountId = ingredient?.inventoryAccountId ?? fallbackInventoryAccountId;

        if (!rawMaterialAccountId) {
          throw AppError.businessRule('inventory.production.raw_material_account_not_found', {
            productId: line.ingredientId,
          });
        }

        rawMaterialValueByAccount.set(
          rawMaterialAccountId,
          (rawMaterialValueByAccount.get(rawMaterialAccountId) ?? 0n) + lineCost,
        );
        totalCost += lineCost;

        batchLines.push({
          id: generateId(),
          tenantId: ctx.tenantId,
          batchId,
          productId: line.ingredientId,
          variantId: null,
          qtyConsumed: qtyNeeded.toFixed(3),
          uom: line.uom,
          unitCost: scaledUnitCost(lineCost, qtyNeeded),
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }

      if (totalCost <= 0n) {
        throw AppError.businessRule('inventory.production.zero_cost_not_allowed');
      }

      const producedUnitCost = scaledUnitCost(totalCost, input.qtyProduced);
      await tx.insert(stockMovements).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        locationId: input.locationId,
        occurredAt: now,
        stockLocationId: null,
        productId: input.productId,
        variantId: input.variantId ?? null,
        batchNo: null,
        expiryDate: null,
        qtyDelta: input.qtyProduced.toFixed(3),
        uom: product.uom,
        reason: 'production',
        referenceType: 'production',
        referenceId: batchId,
        unitCost: producedUnitCost,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      const variantCondition = input.variantId
        ? eq(stockLevels.variantId, input.variantId)
        : isNull(stockLevels.variantId);

      const existingFinishedStock = await tx
        .select({
          id: stockLevels.id,
          qtyOnHand: stockLevels.qtyOnHand,
          avgUnitCost: stockLevels.avgUnitCost,
        })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, input.locationId),
            eq(stockLevels.productId, input.productId),
            variantCondition,
            isNull(stockLevels.batchNo),
          ),
        )
        .limit(1)
        .then((rows: Array<{ id: string; qtyOnHand: string; avgUnitCost: bigint | null }>) => rows[0]);

      if (existingFinishedStock) {
        const oldQty = Number.parseFloat(existingFinishedStock.qtyOnHand || '0');
        const newQty = oldQty + input.qtyProduced;
        const oldAvgCost = existingFinishedStock.avgUnitCost ?? 0n;
        const newAvgCost =
          newQty > 0.001
            ? (BigInt(Math.round(oldQty * 1000)) * oldAvgCost +
                BigInt(Math.round(input.qtyProduced * 1000)) * producedUnitCost) /
              BigInt(Math.round(newQty * 1000))
            : producedUnitCost;

        await tx
          .update(stockLevels)
          .set({
            qtyOnHand: sql`${stockLevels.qtyOnHand} + ${input.qtyProduced}::numeric`,
            qtyAvailable: sql`${stockLevels.qtyAvailable} + ${input.qtyProduced}::numeric`,
            avgUnitCost: newAvgCost,
            updatedBy: ctx.userId,
            lastMovementAt: now,
          })
          .where(eq(stockLevels.id, existingFinishedStock.id));
      } else {
        await tx.insert(stockLevels).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          locationId: input.locationId,
          stockLocationId: null,
          productId: input.productId,
          variantId: input.variantId ?? null,
          batchNo: null,
          expiryDate: null,
          qtyOnHand: input.qtyProduced.toFixed(3),
          qtyReserved: '0',
          qtyAvailable: input.qtyProduced.toFixed(3),
          uom: product.uom,
          avgUnitCost: producedUnitCost,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          lastMovementAt: now,
        });
      }

      const journalLines = [
        {
          accountId: finishedInventoryAccountId,
          locationId: input.locationId,
          description: `Production ${productionNumber} finished goods`,
          debit: totalCost.toString(),
          credit: '0',
        },
      ];

      for (const [accountId, amount] of rawMaterialValueByAccount.entries()) {
        if (amount > 0n) {
          journalLines.push({
            accountId,
            locationId: input.locationId,
            description: `Production ${productionNumber} raw materials`,
            debit: '0',
            credit: amount.toString(),
          });
        }
      }

      const journalResult = await createJournal(
        {
          postingDate: productionDate,
          locationId: input.locationId,
          description: `Production Batch ${productionNumber} - COGM`,
          referenceType: 'production',
          referenceId: batchId,
          lines: journalLines,
        },
        ctx,
        { skipPermissionCheck: true, tx },
      );
      if (!journalResult.ok) throw journalResult.error;

      await tx.insert(productionBatches).values({
        id: batchId,
        tenantId: ctx.tenantId,
        locationId: input.locationId,
        number: productionNumber,
        productionDate,
        status: 'completed',
        productId: input.productId,
        variantId: input.variantId ?? null,
        qtyProduced: input.qtyProduced.toFixed(3),
        uom: product.uom,
        totalCost,
        journalEntryId: journalResult.value.id,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      if (batchLines.length > 0) {
        await tx.insert(productionBatchLines).values(batchLines);
      }

      await auditRecord({
        action: 'create',
        entityType: 'production_batch',
        entityId: batchId,
        before: null,
        after: {
          id: batchId,
          number: productionNumber,
          productId: input.productId,
          qtyProduced: input.qtyProduced.toFixed(3),
          totalCost: totalCost.toString(),
          journalEntryId: journalResult.value.id,
        },
        ctx,
        tx,
      });

      return { id: batchId };
    });

    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('inventory.production.create_failed', e));
  }
}
