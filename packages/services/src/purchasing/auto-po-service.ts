import { db } from '@erp/db';
import { purchaseOrders, purchaseOrderLines } from '@erp/db/schema/purchasing';
import { stockLevels, products } from '@erp/db/schema/inventory';
import { partners } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and, lt } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';

export const GenerateAutoPOInputSchema = z.object({
  locationId: z.string().min(1),
  orderDate: z.string().date().optional(),
});

export type GenerateAutoPOInput = z.infer<typeof GenerateAutoPOInputSchema>;

export async function generateAutoPO(
  input: GenerateAutoPOInput,
  ctx: AuditContext,
): Promise<Result<{ poIds: string[] }>> {
  const parsed = GenerateAutoPOInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));
  const { locationId, orderDate } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create' as any, { locationId });
  if (!permCheck.ok) return permCheck;

  // 1. Find all stock levels where qtyOnHand < minStock
  // We need to join with products to get supplier info (we'll assume products have a defaultSupplierId for this tier)
  // Actually, our schema doesn't have defaultSupplierId on product.
  // We will group everything under a generic supplier for now, or just create one PO per location.
  // Let's create a single PO for all low stock items for simplicity if no supplier mapping exists,
  // or group by a 'primary supplier' if we had one.
  
  // For now, let's fetch low stock items
  // Note: minStock and maxStock are in stockLevels
  
  // In our DB schema, minStock is numeric, so we can't do direct `<` in JS safely without parsing,
  // but we can query it via Drizzle.
  // However, Drizzle's typed operations on numeric might be tricky, so let's fetch and filter in JS for now.
  const allStock = await db
    .select({
      productId: stockLevels.productId,
      variantId: stockLevels.variantId,
      qtyOnHand: stockLevels.qtyOnHand,
      minStock: stockLevels.minStock,
      maxStock: stockLevels.maxStock,
      uom: stockLevels.uom,
      defaultCostPrice: products.defaultCostPrice,
      isPurchasable: products.isPurchasable,
    })
    .from(stockLevels)
    .innerJoin(products, eq(products.id, stockLevels.productId))
    .where(
      and(
        eq(stockLevels.tenantId, ctx.tenantId),
        eq(stockLevels.locationId, locationId),
        eq(products.isPurchasable, true)
      )
    );

  const lowStockItems = allStock.filter(s => {
    if (!s.minStock) return false;
    return Number(s.qtyOnHand) <= Number(s.minStock);
  });

  if (lowStockItems.length === 0) {
    return ok({ poIds: [] });
  }

  // 2. Generate a single PO for the generic default supplier
  // We'll look up an active supplier.
  const [supplier] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.kind, 'supplier'), eq(partners.isActive, true)))
    .limit(1);

  if (!supplier) {
    return err(AppError.businessRule('purchasing.auto_po.no_supplier_available'));
  }

  const poId = generateId();
  const currentDate = orderDate ?? new Date().toISOString().slice(0, 10);

  await db.insert(purchaseOrders).values({
    id: poId,
    tenantId: ctx.tenantId,
    locationId,
    number: `PO-AUTO-${Date.now()}`,
    orderDate: currentDate,
    supplierId: supplier.id,
    status: 'draft',
    subtotal: 0n,
    taxTotal: 0n,
    grandTotal: 0n,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Create Lines
  const lines = lowStockItems.map((item, idx) => {
    // Order up to maxStock, or a default amount if not set
    const qtyToOrder = item.maxStock ? Math.max(0, Number(item.maxStock) - Number(item.qtyOnHand)) : 10;
    const subtotal = item.defaultCostPrice * BigInt(Math.ceil(qtyToOrder));
    
    return {
      id: generateId(),
      purchaseOrderId: poId,
      lineNo: idx + 1,
      productId: item.productId,
      variantId: item.variantId ?? null,
      qtyOrdered: qtyToOrder.toString(),
      uom: item.uom,
      unitPrice: item.defaultCostPrice, // Use default cost price
      lineSubtotal: subtotal,
      lineTax: 0n,
      lineTotal: subtotal,
      taxCode: null,
      createdBy: ctx.userId,
    };
  });

  let subtotal = 0n;
  for (const line of lines) {
    subtotal += line.lineTotal;
  }

  if (lines.length > 0) {
    await db.insert(purchaseOrderLines).values(lines);
  }

  await db
    .update(purchaseOrders)
    .set({ subtotal, grandTotal: subtotal, updatedBy: ctx.userId })
    .where(eq(purchaseOrders.id, poId));

  return ok({ poIds: [poId] });
}
