import { db } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import { eq } from 'drizzle-orm';

/**
 * Generates the Naixer KDS payload for a given sale order.
 * Follows ADR-0007 specification.
 *
 * Format A: [SaleNumber]|[Qty]x[ProductName]|[Qty]x[ProductName]
 * Format B: [SaleNumber]-[ProductCode]-[Qty]-[ProductCode]-[Qty]
 */
export async function generateNaixerPayload(
  saleId: string,
  format: 'A' | 'B' = 'B',
): Promise<Result<string>> {
  const [sale] = await db.select().from(salesOrders).where(eq(salesOrders.id, saleId));
  if (!sale) return err(AppError.notFound('sales.errors.sale_not_found'));

  const lines = await db
    .select({
      qty: salesOrderLines.qty,
      productCode: products.sku,
      productName: products.name,
    })
    .from(salesOrderLines)
    .innerJoin(products, eq(salesOrderLines.productId, products.id))
    .where(eq(salesOrderLines.salesOrderId, saleId));

  if (lines.length === 0) return ok('');

  let payload = '';

  if (format === 'A') {
    // Pipe delimited
    payload = sale.number;
    for (const line of lines) {
      const qtyStr = Number.parseFloat(line.qty).toString();
      // Use fallback ID or english name
      const name = line.productName.id ?? line.productName.en ?? line.productCode;
      payload += `|${qtyStr}x${name}`;
    }
  } else {
    // Dash delimited (Format B)
    payload = sale.number;
    for (const line of lines) {
      const qtyStr = Number.parseFloat(line.qty).toString();
      payload += `-${line.productCode}-${qtyStr}`;
    }
  }

  // Save the payload to the sale record
  await db.update(salesOrders).set({ naixerPayload: payload }).where(eq(salesOrders.id, saleId));

  return ok(payload);
}
