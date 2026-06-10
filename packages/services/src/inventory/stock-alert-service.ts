import { db } from '@erp/db';
import { products, stockLevels } from '@erp/db/schema/inventory';
import { type Result, ok } from '@erp/shared/result';
import { and, asc, eq, sql } from 'drizzle-orm';

export interface LowStockItem {
  productId: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  locationId: string;
  qtyAvailable: string;
  minStock: string;
  uom: string;
}

export async function getLowStockItems(
  tenantId: string,
  locationId?: string,
): Promise<Result<LowStockItem[]>> {
  const conditions = [
    eq(stockLevels.tenantId, tenantId),
    sql`${stockLevels.qtyAvailable} < ${stockLevels.minStock}`,
  ];
  if (locationId) {
    conditions.push(eq(stockLevels.locationId, locationId));
  }

  const results = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      locationId: stockLevels.locationId,
      qtyAvailable: stockLevels.qtyAvailable,
      minStock: stockLevels.minStock,
      uom: stockLevels.uom,
    })
    .from(stockLevels)
    .innerJoin(products, eq(stockLevels.productId, products.id))
    .where(and(...conditions))
    .orderBy(asc(products.name));

  return ok(
    results.map((r) => ({
      ...r,
      minStock: r.minStock ?? '0',
    })),
  );
}

export interface ExpiringStockItem {
  productId: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  locationId: string;
  qtyAvailable: string;
  batchNo: string | null;
  expiryDate: Date | null;
  uom: string;
}

export async function getExpiringStock(
  tenantId: string,
  daysThreshold: number,
  locationId?: string,
): Promise<Result<ExpiringStockItem[]>> {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  const conditions = [
    eq(stockLevels.tenantId, tenantId),
    sql`${stockLevels.expiryDate} IS NOT NULL`,
    sql`${stockLevels.expiryDate} <= ${thresholdDate}`,
    sql`${stockLevels.qtyAvailable} > 0`,
  ];

  if (locationId) {
    conditions.push(eq(stockLevels.locationId, locationId));
  }

  const results = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      locationId: stockLevels.locationId,
      qtyAvailable: stockLevels.qtyAvailable,
      batchNo: stockLevels.batchNo,
      expiryDate: stockLevels.expiryDate,
      uom: stockLevels.uom,
    })
    .from(stockLevels)
    .innerJoin(products, eq(stockLevels.productId, products.id))
    .where(and(...conditions))
    .orderBy(asc(stockLevels.expiryDate));

  return ok(
    results.map((r) => ({
      ...r,
      // Drizzle returns date as string or Date depending on config, assume Date
      expiryDate: r.expiryDate ? new Date(r.expiryDate) : null,
    })),
  );
}
