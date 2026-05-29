import { db } from '@erp/db';
import { stockAdjustments, stockAdjustmentLines, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';
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
  const totalCost = BigInt(0);

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

  // 4. Auto-Journal (Debit Waste Expense, Credit Inventory)
  const inventoryAccount = product.inventoryAccountId ?? 'inv-default-id';
  // Use a generic waste expense account ID for now
  const wasteExpenseAccount = 'waste-expense-account-id';

  await createJournal(
    {
      postingDate: new Date().toISOString().split('T')[0] as string,
      locationId: input.locationId,
      description: `Waste Adjustment ${adjId}`,
      referenceType: 'stock_adjustment',
      referenceId: adjId,
      lines: [
        {
          accountId: wasteExpenseAccount,
          locationId: input.locationId,
          description: `Waste Expense - ${input.reason}`,
          debit: totalCost.toString(),
          credit: '0',
        },
        {
          accountId: inventoryAccount,
          locationId: input.locationId,
          description: `Inventory Decrease (Waste)`,
          debit: '0',
          credit: totalCost.toString(),
        },
      ],
    },
    ctx
  );

  return ok({ id: adjId });
}
