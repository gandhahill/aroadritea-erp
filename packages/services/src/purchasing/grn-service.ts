/**
 * purchasing/grn-service.ts — GRN creation + confirmation (SD §21.6)
 *
 * createGRN:  creates a draft GRN from an approved/partial PO
 * confirmGRN: draft → confirmed, updates stock + PO status + JE
 */

import { db } from '@erp/db';
import { accountingPeriods, accounts, partners } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { products, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import {
  goodsReceiptNotes,
  grnLines,
  purchaseOrderLines,
  purchaseOrders,
} from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { ConfirmGRNInputSchema, CreateGRNInputSchema, type GRNLineInput } from './grn-schemas';

// GRNI & inventory posting accounts come from the configurable account map
// (Settings → Accounting → Account Mapping); see accounting/posting-accounts.ts.
// A product may override its own inventory account via products.inventoryAccountId.

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveAccountId(
  tenantId: string,
  code: string,
  client: any = db,
): Promise<string | null> {
  const [row] = await client
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .limit(1);
  return row?.id ?? null;
}

async function resolveGrniAccountId(tenantId: string, client: any = db): Promise<string | null> {
  const codes = await getPostingAccountCodes(tenantId);
  return resolveAccountId(tenantId, codes['purchasing.grni'], client);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + Math.max(0, days));
  return value.toISOString().slice(0, 10);

}

function stockLevelIdentityWhere(input: {
  tenantId: string;
  locationId: string;
  productId: string;
  variantId: string | null | undefined;
  batchNo: string | null | undefined;
  expiryDate: string | null | undefined;
}) {
  return and(
    eq(stockLevels.tenantId, input.tenantId),
    eq(stockLevels.locationId, input.locationId),
    eq(stockLevels.productId, input.productId),
    input.variantId ? eq(stockLevels.variantId, input.variantId) : isNull(stockLevels.variantId),
    input.batchNo ? eq(stockLevels.batchNo, input.batchNo) : isNull(stockLevels.batchNo),
    input.expiryDate ? eq(stockLevels.expiryDate, input.expiryDate) : isNull(stockLevels.expiryDate),
  );
}

async function resolveInventoryAccountForProduct(
  tenantId: string,
  productId: string,
  client: any = db,
): Promise<string> {
  const [row] = await client
    .select({ inventoryAccountId: products.inventoryAccountId })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);

  if (row?.inventoryAccountId) return row.inventoryAccountId;

  const codes = await getPostingAccountCodes(tenantId);
  const fallback = await resolveAccountId(tenantId, codes.inventory, client);
  return fallback ?? codes.inventory;
}

async function generateGRNNumber(
  tenantId: string,
  locationId: string,
  receivedDate: string,
): Promise<string> {
  const prefix = `GRN-${receivedDate.substring(0, 7)}-`;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(goodsReceiptNotes)
    .where(
      and(
        eq(goodsReceiptNotes.tenantId, tenantId),
        eq(goodsReceiptNotes.locationId, locationId),
        sql`${goodsReceiptNotes.number} LIKE ${prefix + '%'}`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// ─── Result types ───────────────────────────────────────────────────────────

export interface GRNResult {
  id: string;
  number: string;
  purchaseOrderId: string;
  receivedDate: string;
  status: string;
  lines: GRNLineResult[];
}

export interface GRNLineResult {
  id: string;
  lineNo: number;
  poLineId: string;
  productId: string;
  variantId: string | null;
  qtyReceived: string;
  uom: string;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface GRNConfirmResult {
  id: string;
  number: string;
  status: string;
  poStatus: string;
  journalEntryId: string | null;
  movementCount: number;
}

// ─── Create GRN ─────────────────────────────────────────────────────────────

export async function createGRN(rawInput: unknown, ctx: AuditContext): Promise<Result<GRNResult>> {
  const parsed = CreateGRNInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }
  const input = parsed.data;

  // Validate PO exists and is in receivable status
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, input.purchaseOrderId)),
    )
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  const permCheck = await requirePermission(ctx.userId, 'purchasing.grn.create', {
    locationId: po.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const RECEIVABLE_STATUSES = new Set(['approved', 'partial']);
  if (!RECEIVABLE_STATUSES.has(po.status)) {
    return err(
      AppError.businessRule('purchasing.errors.po_not_receivable', {
        currentStatus: po.status,
      }),
    );
  }

  // Load all PO lines and products
  const poLines = await db
    .select({
      id: purchaseOrderLines.id,
      productId: purchaseOrderLines.productId,
      qtyOrdered: purchaseOrderLines.qtyOrdered,
      qtyReceived: purchaseOrderLines.qtyReceived,
      unitPrice: purchaseOrderLines.unitPrice,
      trackBatch: products.trackBatch,
      trackExpiry: products.trackExpiry
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(products.id, purchaseOrderLines.productId))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id))
    .orderBy(purchaseOrderLines.lineNo);

  const poLineMap = new Map(poLines.map((l) => [l.id, l]));

  // Validate GRN lines against PO lines
  for (const grnLine of input.lines) {
    const poLine = poLineMap.get(grnLine.poLineId);
    if (!poLine) {
      return err(
        AppError.validation('purchasing.errors.invalid_po_line', {
          poLineId: grnLine.poLineId,
        }),
      );
    }

    if (grnLine.productId !== poLine.productId) {
      return err(
        AppError.validation('purchasing.errors.product_mismatch', {
          poLineId: grnLine.poLineId,
          expected: poLine.productId,
          got: grnLine.productId,
        }),
      );
    }

    if (poLine.trackBatch && !grnLine.batchNo) {
      return err(
        AppError.validation('purchasing.errors.missing_batch_no', {
          poLineId: grnLine.poLineId,
          productId: grnLine.productId,
        }),
      );
    }
    
    if (poLine.trackExpiry && !grnLine.expiryDate) {
      return err(
        AppError.validation('purchasing.errors.missing_expiry_date', {
          poLineId: grnLine.poLineId,
          productId: grnLine.productId,
        }),
      );
    }

    // Check qty does not exceed remaining
    const alreadyReceived = Number.parseFloat(poLine.qtyReceived);
    const ordered = Number.parseFloat(poLine.qtyOrdered);
    const receiving = Number.parseFloat(grnLine.qtyReceived);
    const remaining = ordered - alreadyReceived;

    if (receiving > remaining + 0.001) {
      return err(
        AppError.businessRule('purchasing.errors.qty_exceeds_remaining', {
          poLineId: grnLine.poLineId,
          ordered: poLine.qtyOrdered,
          alreadyReceived: poLine.qtyReceived,
          remaining: remaining.toFixed(3),
          receiving: grnLine.qtyReceived,
        }),
      );
    }
  }

  // Generate GRN number
  const grnNumber = await generateGRNNumber(ctx.tenantId, input.locationId, input.receivedDate);

  // Insert GRN header
  const grnId = generateId();
  await db.insert(goodsReceiptNotes).values({
    id: grnId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number: grnNumber,
    purchaseOrderId: input.purchaseOrderId,
    receivedDate: input.receivedDate,
    receivedBy: ctx.userId,
    notes: input.notes ?? null,
    status: 'draft',
    version: 1,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Insert GRN lines
  const grnLineValues = input.lines.map((line: GRNLineInput, idx: number) => ({
    id: generateId(),
    grnId,
    poLineId: line.poLineId,
    lineNo: idx + 1,
    productId: line.productId,
    variantId: line.variantId ?? null,
    qtyReceived: line.qtyReceived,
    uom: line.uom,
    batchNo: line.batchNo ?? null,
    expiryDate: line.expiryDate ?? null,
    notes: line.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db.insert(grnLines).values(grnLineValues);

  await auditRecord({
    action: 'create',
    entityType: 'grn',
    entityId: grnId,
    before: null,
    after: {
      id: grnId,
      number: grnNumber,
      purchaseOrderId: input.purchaseOrderId,
      status: 'draft',
      lineCount: grnLineValues.length,
    },
    ctx,
  });

  return ok({
    id: grnId,
    number: grnNumber,
    purchaseOrderId: input.purchaseOrderId,
    receivedDate: input.receivedDate,
    status: 'draft',
    lines: grnLineValues.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      poLineId: l.poLineId,
      productId: l.productId,
      variantId: l.variantId,
      qtyReceived: l.qtyReceived,
      uom: l.uom,
      batchNo: l.batchNo,
      expiryDate: l.expiryDate,
    })),
  });
}

// ─── Confirm GRN ────────────────────────────────────────────────────────────

export async function confirmGRN(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<GRNConfirmResult>> {
  const parsed = ConfirmGRNInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }

  // Load GRN
  const [grn] = await db
    .select()
    .from(goodsReceiptNotes)
    .where(
      and(
        eq(goodsReceiptNotes.tenantId, ctx.tenantId),
        eq(goodsReceiptNotes.id, parsed.data.grnId),
      ),
    )
    .limit(1);

  if (!grn) {
    return err(AppError.notFound('purchasing.errors.grn_not_found'));
  }

  // Permission scoped to the GRN's outlet, not the caller's current
  // location — receiving a delivery at outlet A should never be done
  // by a clerk logged into outlet B.
  const permCheck = await requirePermission(ctx.userId, 'purchasing.grn.create', {
    locationId: grn.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (grn.status !== 'draft') {
    return err(
      AppError.businessRule('purchasing.errors.grn_not_draft', {
        currentStatus: grn.status,
      }),
    );
  }

  // Load GRN lines
  const lines = await db
    .select()
    .from(grnLines)
    .where(eq(grnLines.grnId, grn.id))
    .orderBy(grnLines.lineNo);

  if (lines.length === 0) {
    return err(AppError.businessRule('purchasing.errors.grn_no_lines'));
  }

  // Load PO for context
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, grn.purchaseOrderId))
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  // Verify accounting period is open
  const periodCode = grn.receivedDate.substring(0, 7);
  const [period] = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
    )
    .limit(1);

  if (!period) {
    return err(
      AppError.businessRule('accounting.journal.periodNotFound', {
        periodCode,
      }),
    );
  }
  if (period.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode,
        periodStatus: period.status,
      }),
    );
  }

    return tryCatch(async () => {
    return await db.transaction(async (tx) => {
      // CLAIM the GRN first. Two concurrent confirmGRN calls would
        // otherwise both run the stock + PO line updates, doubling on-hand
        // qty and posting two GRNI journals.
        const claimedGrn = await tx
          .update(goodsReceiptNotes)
          .set({
            status: 'confirmed',
            updatedBy: ctx.userId,
            version: grn.version + 1,
          })
          .where(
            and(
              eq(goodsReceiptNotes.id, grn.id),
              eq(goodsReceiptNotes.version, grn.version),
              eq(goodsReceiptNotes.status, 'draft'),
            ),
          )
          .returning({ id: goodsReceiptNotes.id });
        if (!claimedGrn || claimedGrn.length === 0) {
          throw AppError.conflict('purchasing.errors.version_mismatch');
        }

        const grniAccountId = await resolveGrniAccountId(ctx.tenantId, tx);
        if (!grniAccountId) {
          throw AppError.businessRule('purchasing.errors.grni_account_not_found');
        }

        const [supplier] = await tx
          .select({ paymentTermsDays: partners.paymentTermsDays })
          .from(partners)
          .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.id, po.supplierId)))
          .limit(1);
        const apDueDate = addDays(grn.receivedDate, supplier?.paymentTermsDays ?? 0);

        // Load PO lines once so we can compute totals and remaining qty.
        const poLines = await tx
          .select()
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.purchaseOrderId, po.id));
        const poLineMap = new Map(poLines.map((l) => [l.id, l]));

        // Compute total value with bigint math (3-decimal scaling) before
        // mutating anything. This drives the JE amount.
        let totalValue = 0n;
        const inventoryValueByAccount = new Map<string, bigint>();

        for (const line of lines) {
          const poLine = poLineMap.get(line.poLineId);
          if (poLine) {
            const qty = BigInt(Math.round(Number.parseFloat(line.qtyReceived) * 1000));
            const lineValue = (qty * poLine.unitPrice) / 1000n;
            totalValue += lineValue;

            const invAccountId = await resolveInventoryAccountForProduct(
              ctx.tenantId,
              line.productId,
              tx,
            );
            if (!invAccountId) {
              throw AppError.businessRule('purchasing.errors.inventory_account_not_found');
            }

            inventoryValueByAccount.set(
              invAccountId,
              (inventoryValueByAccount.get(invAccountId) ?? 0n) + lineValue,
            );
          }
        }

        // Post the JE before stock updates. Any failure throws inside the
        // surrounding transaction, so the GRN claim is rolled back too.
        let journalEntryId: string | null = null;
        if (totalValue > 0n) {
          const jeLines: Array<{
            accountId: string;
            locationId: string;
            description: string;
            debit: string;
            credit: string;
            partnerId: string;
          }> = [];

          // Debit each inventory account
          for (const [accountId, amount] of inventoryValueByAccount.entries()) {
            if (amount > 0n) {
              jeLines.push({
                accountId,
                locationId: grn.locationId,
                description: `GRN ${grn.number} inventory`,
                debit: amount.toString(),
                credit: '0',
                partnerId: po.supplierId,
              });
            }
          }

          // Credit GRNI
          jeLines.push({
            accountId: grniAccountId,
            locationId: grn.locationId,
            description: `GRN ${grn.number} GRNI`,
            debit: '0',
            credit: totalValue.toString(),
            partnerId: po.supplierId,
          });

          const jeResult = await createJournal(
            {
              postingDate: grn.receivedDate,
              locationId: grn.locationId,
              description: `GRN ${grn.number} — goods received (PO ${po.number})`,
              referenceType: 'purchase',
              referenceId: grn.id,
              lines: jeLines,
            },
            ctx, { skipPermissionCheck: true, tx }
          );
          if (!jeResult.ok) {
            throw jeResult.error;
          }
          journalEntryId = jeResult.value.id;
        }

        // 1. Update PO line qtyReceived using atomic SQL so concurrent GRNs
        //    on the SAME PO don't race the value.
        for (const line of lines) {
          const poLine = poLineMap.get(line.poLineId);
          if (!poLine) {
            throw AppError.validation('purchasing.errors.invalid_po_line', {
              poLineId: line.poLineId,
            });
          }

          const updatedPoLine = await tx
            .update(purchaseOrderLines)
            .set({
              qtyReceived: sql`(${purchaseOrderLines.qtyReceived}::numeric + ${line.qtyReceived}::numeric)`,
              updatedBy: ctx.userId,
            })
            .where(
              and(
                eq(purchaseOrderLines.id, poLine.id),
                sql`${purchaseOrderLines.qtyReceived}::numeric + ${line.qtyReceived}::numeric <= ${purchaseOrderLines.qtyOrdered}::numeric + 0.001`,
              ),
            )
            .returning({ id: purchaseOrderLines.id });

          if (updatedPoLine.length === 0) {
            const alreadyReceived = Number.parseFloat(poLine.qtyReceived);
            const ordered = Number.parseFloat(poLine.qtyOrdered);
            const receiving = Number.parseFloat(line.qtyReceived);
            throw AppError.businessRule('purchasing.errors.qty_exceeds_remaining', {
              poLineId: line.poLineId,
              ordered: poLine.qtyOrdered,
              alreadyReceived: poLine.qtyReceived,
              remaining: (ordered - alreadyReceived).toFixed(3),
              receiving: receiving.toFixed(3),
            });
          }

          poLineMap.set(poLine.id, {
            ...poLine,
            qtyReceived: (
              Number.parseFloat(poLine.qtyReceived) + Number.parseFloat(line.qtyReceived)
            ).toFixed(3),
          });
        }

        // 2. Create stock movements (reason='purchase')
        const movementValues = lines.map((line) => {
          const poLine = poLineMap.get(line.poLineId);
          return {
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: grn.locationId,
            occurredAt: new Date(),
            stockLocationId: null,
            productId: line.productId,
            variantId: line.variantId ?? null,
            batchNo: line.batchNo ?? null,
            expiryDate: line.expiryDate ?? null,
            qtyDelta: line.qtyReceived,
            uom: line.uom,
            reason: 'purchase' as const,
            referenceType: 'grn' as const,
            referenceId: grn.id,
            unitCost: poLine?.unitPrice ?? null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          };
        });

        await tx.insert(stockMovements).values(movementValues);

        // 3. Update stock_levels — variant-aware lookup; bug fix from opname.
        for (const line of lines) {
          const existingStock = await tx
            .select({ id: stockLevels.id, qtyOnHand: stockLevels.qtyOnHand, avgUnitCost: stockLevels.avgUnitCost })
            .from(stockLevels)
            .where(
              stockLevelIdentityWhere({
                tenantId: ctx.tenantId,
                locationId: grn.locationId,
                productId: line.productId,
                variantId: line.variantId,
                batchNo: line.batchNo,
                expiryDate: line.expiryDate,
              }),
            )
            .limit(1)
            .then((r) => r[0]);

          if (existingStock) {
            const oldQty = Number.parseFloat(existingStock.qtyOnHand || '0');
            const recQty = Number.parseFloat(line.qtyReceived);
            const newQty = oldQty + recQty;
            const oldAvgCost = existingStock.avgUnitCost ?? 0n;
            const poLine = poLineMap.get(line.poLineId);
            const unitCost = poLine?.unitPrice ?? 0n;

            let newAvgCost = unitCost;
            if (newQty > 0.001) {
              newAvgCost = (BigInt(Math.round(oldQty * 1000)) * oldAvgCost + BigInt(Math.round(recQty * 1000)) * unitCost) / BigInt(Math.round(newQty * 1000));
            }

            await tx
              .update(stockLevels)
              .set({
                qtyOnHand: sql`${stockLevels.qtyOnHand} + ${line.qtyReceived}::numeric`,
                qtyAvailable: sql`${stockLevels.qtyAvailable} + ${line.qtyReceived}::numeric`,
                avgUnitCost: newAvgCost,
                updatedBy: ctx.userId,
                lastMovementAt: new Date(),
              })
              .where(eq(stockLevels.id, existingStock.id));
          } else {
            const poLine = poLineMap.get(line.poLineId);
            const unitCost = poLine?.unitPrice ?? 0n;

            await tx.insert(stockLevels).values({
              id: generateId(),
              tenantId: ctx.tenantId,
              locationId: grn.locationId,
              stockLocationId: null,
              productId: line.productId,
              variantId: line.variantId ?? null,
              batchNo: line.batchNo ?? null,
              expiryDate: line.expiryDate ?? null,
              qtyOnHand: line.qtyReceived,
              qtyReserved: '0',
              qtyAvailable: line.qtyReceived,
              uom: line.uom,
              avgUnitCost: unitCost,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            });
          }
        }

        // 4. Determine new PO status and update.
        const updatedPoLines = [...poLineMap.values()];
        const allFullyReceived = updatedPoLines.every(
          (l) => Number.parseFloat(l.qtyReceived) >= Number.parseFloat(l.qtyOrdered) - 0.001,
        );
        const newPoStatus = allFullyReceived ? 'received' : 'partial';

        const updatedPo = await tx
          .update(purchaseOrders)
          .set({
            status: newPoStatus,
            updatedBy: ctx.userId,
            version: po.version + 1,
          })
          .where(
            and(
              eq(purchaseOrders.tenantId, ctx.tenantId),
              eq(purchaseOrders.id, po.id),
              eq(purchaseOrders.version, po.version),
            ),
          )
          .returning({ id: purchaseOrders.id });

        if (updatedPo.length === 0) {
          throw AppError.conflict('purchasing.errors.po_version_mismatch');
        }

        // 7. Audit
        await auditRecord({
          action: 'approve',
          entityType: 'grn',
          entityId: grn.id,
          before: { status: 'draft' },
          after: {
            status: 'confirmed',
            poStatus: newPoStatus,
            journalEntryId,
            movementCount: movementValues.length,
            totalValue: totalValue.toString(),
          },
          ctx,
          tx,
        });

        return {
          id: grn.id,
          number: grn.number,
          status: 'confirmed',
          poStatus: newPoStatus,
          journalEntryId,
          movementCount: movementValues.length,
        };
    });
  }, (e: any) => {
    if (e && typeof e === 'object' && 'messageKey' in e) return e as AppError;
    return AppError.internal('purchasing.errors.grn_confirm_failed', e);
  });
}
