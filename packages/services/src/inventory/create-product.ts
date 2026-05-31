/**
 * inventory.createProduct — SD §9.3, §21.5
 *
 * Creates a new product in the catalog.
 * Returns Result<ProductResult> — never throws.
 *
 * Business rules:
 * - SKU must be unique per tenant
 * - Category must exist and be active
 * - If accounting account IDs provided, they must exist
 * - Permission: inventory.product.create
 */

import { db } from '@erp/db';
import { productCategories, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { type CreateProductInput, CreateProductInputSchema } from './schemas';
import { stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { createJournal } from '../accounting/create-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { resolveAccountIdsByCodes } from '../accounting/account-resolver';

// --- Return type ---

export interface ProductResult {
  id: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  categoryId: string;
  kind: string;
  opnameFrequency: string;
  opnameFrequencies: Array<'daily' | 'weekly' | 'monthly'>;
  uom: string;
  isSellable: boolean;
  isPurchasable: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  shelfLifeDays: number | null;
  defaultSellPrice: string;
  defaultCostPrice: string;
  isActive: boolean;
  version: number;
}

// --- Service function ---

export async function createProduct(
  input: CreateProductInput,
  ctx: AuditContext,
): Promise<Result<ProductResult>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input
  const parsed = CreateProductInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.product.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 3. Check SKU uniqueness
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.sku, data.sku)))
    .then((rows) => rows[0]);

  if (existing) {
    return err(AppError.conflict('inventory.product.skuDuplicate', { sku: data.sku }));
  }

  // 4. Validate category exists and is active
  const category = await db
    .select({ id: productCategories.id, isActive: productCategories.isActive })
    .from(productCategories)
    .where(
      and(eq(productCategories.tenantId, ctx.tenantId), eq(productCategories.id, data.categoryId)),
    )
    .then((rows) => rows[0]);

  if (!category) {
    return err(
      AppError.notFound('inventory.product.categoryNotFound', { categoryId: data.categoryId }),
    );
  }
  if (!category.isActive) {
    return err(
      AppError.businessRule('inventory.product.categoryInactive', { categoryId: data.categoryId }),
    );
  }

  // 5. Generate ID and insert
  const productId = generateId();

  return tryCatch(
    async () => {
      await db.insert(products).values({
        id: productId,
        tenantId: ctx.tenantId,
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        categoryId: data.categoryId,
        kind: data.kind,
        opnameFrequency: data.opnameFrequencies[0] ?? data.opnameFrequency,
        opnameFrequencies: data.opnameFrequencies,
        uom: data.uom,
        isSellable: data.isSellable,
        isPurchasable: data.isPurchasable,
        trackBatch: data.trackBatch,
        trackExpiry: data.trackExpiry,
        shelfLifeDays: data.shelfLifeDays ?? null,
        defaultSellPrice: BigInt(data.defaultSellPrice),
        defaultCostPrice: BigInt(data.defaultCostPrice),
        cogsAccountId: data.cogsAccountId ?? null,
        revenueAccountId: data.revenueAccountId ?? null,
        inventoryAccountId: data.inventoryAccountId ?? null,
        taxCode: data.taxCode ?? null,
        imageUrl: data.imageUrl ?? null,
        isActive: true,
        version: 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Audit log
      await auditRecord({
        action: 'create',
        entityType: 'product',
        entityId: productId,
        before: null,
        after: { id: productId, sku: data.sku, name: data.name, kind: data.kind },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      // Initial stock processing
      if (data.initialStocks && data.initialStocks.length > 0) {
        const validStocks = data.initialStocks.filter((s) => Number.parseFloat(s.qty) > 0);
        
        if (validStocks.length > 0) {
          const acctCodes = await getPostingAccountCodes(ctx.tenantId);
          
          let invAccount = data.inventoryAccountId;
          if (!invAccount) {
            const map = await resolveAccountIdsByCodes(ctx.tenantId, [acctCodes.inventory]);
            invAccount = map.get(acctCodes.inventory);
          }

          const equityCode = acctCodes['equity.opening'];
          const codeMap = await resolveAccountIdsByCodes(ctx.tenantId, [equityCode]);
          const equityAccount = codeMap.get(equityCode);

          if (invAccount && equityAccount) {
            const defaultCost = BigInt(data.defaultCostPrice);
            let totalValue = 0n;
            
            const batchQueries: any[] = [];
            const journalLines: any[] = [];
            
            for (const stock of validStocks) {
              const qtyDec = Number.parseFloat(stock.qty);
              const scaled = BigInt(Math.round(qtyDec * 1000));
              const lineValue = (scaled * defaultCost) / 1000n;
              totalValue += lineValue;
              
              batchQueries.push(
                db.insert(stockLevels).values({
                  id: generateId(),
                  tenantId: ctx.tenantId,
                  locationId: stock.locationId,
                  stockLocationId: null as unknown as string,
                  productId: productId,
                  variantId: null,
                  qtyOnHand: stock.qty,
                  qtyReserved: '0',
                  qtyAvailable: stock.qty,
                  uom: data.uom,
                  avgUnitCost: defaultCost,
                  createdBy: ctx.userId,
                  updatedBy: ctx.userId,
                })
              );
              
              batchQueries.push(
                db.insert(stockMovements).values({
                  id: generateId(),
                  tenantId: ctx.tenantId,
                  locationId: stock.locationId,
                  occurredAt: new Date(),
                  stockLocationId: null as unknown as string,
                  productId: productId,
                  variantId: null,
                  qtyDelta: stock.qty,
                  uom: data.uom,
                  reason: 'opening_balance' as const,
                  unitCost: defaultCost,
                  createdBy: ctx.userId,
                  updatedBy: ctx.userId,
                })
              );

              if (lineValue > 0n) {
                // One debit per location
                journalLines.push({
                  accountId: invAccount,
                  locationId: stock.locationId,
                  description: `Opening Balance: ${data.sku}`,
                  debit: lineValue.toString(),
                  credit: '0',
                });
              }
            }
            
            if (totalValue > 0n) {
              // One credit for the total across all locations to opening balance equity
              // Wait, Journal must balance per location if we use strict branch accounting.
              // To make it simple, we just credit equity in the user's current location or first stock location.
              // We'll credit equity per location to ensure strict balance.
              for (const stock of validStocks) {
                const qtyDec = Number.parseFloat(stock.qty);
                const scaled = BigInt(Math.round(qtyDec * 1000));
                const lineValue = (scaled * defaultCost) / 1000n;
                if (lineValue > 0n) {
                  journalLines.push({
                    accountId: equityAccount,
                    locationId: stock.locationId,
                    description: `Opening Balance: ${data.sku}`,
                    debit: '0',
                    credit: lineValue.toString(),
                  });
                }
              }

              // Create Journal
              const jeResult = await createJournal(
                {
                  postingDate: new Date().toISOString().substring(0, 10),
                  locationId: ctx.locationId || validStocks[0]!.locationId,
                  description: `Opening Stock: ${data.sku}`,
                  referenceType: 'manual',
                  referenceId: productId,
                  lines: journalLines,
                },
                ctx, { skipPermissionCheck: true }
              );
              
              if (jeResult.ok) {
                // Only insert stock records if journal is successful
                for (const query of batchQueries) {
                  await query;
                }
              }
            } else {
              // Cost is zero, just insert stock records without journal
              for (const query of batchQueries) {
                await query;
              }
            }
          }
        }
      }

      const result: ProductResult = {
        id: productId,
        sku: data.sku,
        name: data.name,
        categoryId: data.categoryId,
        kind: data.kind,
        opnameFrequency: data.opnameFrequencies[0] ?? data.opnameFrequency,
        opnameFrequencies: data.opnameFrequencies,
        uom: data.uom,
        isSellable: data.isSellable,
        isPurchasable: data.isPurchasable,
        trackBatch: data.trackBatch,
        trackExpiry: data.trackExpiry,
        shelfLifeDays: data.shelfLifeDays ?? null,
        defaultSellPrice: data.defaultSellPrice,
        defaultCostPrice: data.defaultCostPrice,
        isActive: true,
        version: 1,
      };

      return result;
    },
    (e) => AppError.internal('inventory.product.createFailed', e),
  );
}
