import { db } from '@erp/db';
import { stockAdjustments, stockAdjustmentLines, stockLevels, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';
import { resolveAccountIdsByCodes } from '../accounting/account-resolver';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { depleteStock } from './stock-depletion-service';

export const RecordWasteInputSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().positive(),
  reason: z.string().min(3),
});

export type RecordWasteInput = z.infer<typeof RecordWasteInputSchema>;

export async function recordWaste(input: RecordWasteInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = RecordWasteInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));

  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', { locationId: input.locationId });
  if (!permCheck.ok) return permCheck;

  // 1. Fetch Product for Accounts
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.tenantId, ctx.tenantId)));

  if (!product) return err(AppError.notFound('inventory.product_not_found'));

  const adjId = generateId();

  // 2. Deplete Stock
  const depletionResult = await depleteStock(
    {
      locationId: input.locationId,
      productId: input.productId,
      qtyToDeplete: input.quantity,
      reason: 'waste',
      referenceId: adjId,
      referenceType: 'stock_adjustment',
    },
    ctx
  );

  if (!depletionResult.ok) return depletionResult;

  // Compute waste cost from stock level's avgUnitCost (or product defaultCostPrice)
  const variantCond = input.variantId
    ? eq(stockLevels.variantId, input.variantId)
    : isNull(stockLevels.variantId);
  const [slRow] = await db
    .select({ avgUnitCost: stockLevels.avgUnitCost })
    .from(stockLevels)
    .where(and(eq(stockLevels.tenantId, ctx.tenantId), eq(stockLevels.locationId, input.locationId), eq(stockLevels.productId, input.productId), variantCond))
    .limit(1);
  const unitCost = (slRow?.avgUnitCost as bigint | null) ?? product.defaultCostPrice ?? 0n;
  const scaledQty = BigInt(Math.round(input.quantity * 1000));
  const totalCost = (scaledQty * unitCost) / 1000n;

  // 3. Save Adjustment Header & Lines
  await db.insert(stockAdjustments).values({
    id: adjId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number: `ADJ-WST-${Date.now()}`,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    reason: 'waste',
    notes: input.reason,
    status: 'approved',
    approvedBy: ctx.userId,
    approvedAt: new Date(),
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(stockAdjustmentLines).values({
    id: generateId(),
    adjustmentId: adjId,
    lineNo: 1,
    productId: input.productId,
    variantId: input.variantId ?? null,
    qtyBefore: '0', // Ideally derived from stockLevels before depletion
    qtyAfter: '0',
    qtyDelta: (-input.quantity).toString(),
    uom: product.uom,
    unitCost: totalCost / BigInt(Math.ceil(input.quantity)),
    notes: input.reason,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // 4. Auto-Journal (Debit Waste/Adjustment Expense, Credit Inventory)
  if (totalCost > 0n) {
    const acctCodes = await getPostingAccountCodes(ctx.tenantId);
    const invCode = acctCodes.inventory;
    const expCode = acctCodes['adjustment.expense'];
    const invAccountId = product.inventoryAccountId
      ?? (await resolveAccountIdsByCodes(ctx.tenantId, [invCode])).get(invCode);
    const expAccountId = (await resolveAccountIdsByCodes(ctx.tenantId, [expCode])).get(expCode);

    if (invAccountId && expAccountId) {
      await createJournal(
        {
          postingDate: new Date().toISOString().slice(0, 10),
          locationId: input.locationId,
          description: `Waste Adjustment ${adjId} — ${input.reason}`,
          referenceType: 'stock_adjustment',
          referenceId: adjId,
          lines: [
            {
              accountId: expAccountId,
              locationId: input.locationId,
              description: `Waste: ${input.reason}`,
              debit: totalCost.toString(),
              credit: '0',
            },
            {
              accountId: invAccountId,
              locationId: input.locationId,
              description: `Inventory decrease (waste)`,
              debit: '0',
              credit: totalCost.toString(),
            },
          ],
        },
        ctx, { skipPermissionCheck: true }
      );
    }
  }

  return ok({ id: adjId });
}
