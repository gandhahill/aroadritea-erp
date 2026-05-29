/**
 * pos.createSale — SD §9.5, §21.4
 *
 * Creates a paid POS sales order with journal entry.
 *
 * Workflow:
 * 1. Validate shift is open, idempotency key not used
 * 2. Validate products/variants exist and are sellable
 * 3. Calculate per-line: subtotal, tax (PB1 10% inclusive), total
 * 4. For each line: lookup active BOM → deduct ingredients from stock_levels
 * 5. Insert sales_order + lines + payments (with idempotency dedup)
 * 6. Create journal entry:
 *      DR Cash/Bank                    (total received)
 *      CR Revenue (4-1100)             (subtotal before PB1)
 *      CR PB1 Payable (2-1500)         (PB1 embedded in price)
 *    For GoFood/GrabFood/ShopeeFood (online channels):
 *      Debit gross platform receivable; commission is recognized on settlement.
 *
 * Permissions:
 *   pos.transact — required for createSale
 *   pos.void — for voidSale (cashier)
 *
 * Business rules:
 * - Shift must be open
 * - Idempotency key prevents duplicate orders from offline sync
 * - All lines must be for sellable products
 * - Payment total must ≥ grandTotal (overpay allowed, change recorded separately)
 * - Online channel (gofood/grabfood/shopeefood): sale JE records gross receivable
 *   and commission is handled by settlement accounting.
 */

import { db } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
  partners,
  taxRates,
} from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import {
  bomLines,
  boms,
  productVariants,
  products,
  stockLevels,
  stockMovements,
} from '@erp/db/schema/inventory';
import {
  idempotencyRecords,
  payments,
  posSettings,
  salesOrderLines,
  salesOrders,
  shifts,
} from '@erp/db/schema/pos';
import { promotionApplications } from '@erp/db/schema/promotion';
import { memberVouchers } from '@erp/db/schema/member';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { earnLoyaltyPoints } from '../crm';
import { requirePermission } from '../iam';
import { notifyByPermission } from '../notification';
import { evaluatePromotions, type Cart, listActivePromotionsForSale } from '../promotion';
import { claimIdempotency, releaseIdempotencyClaim, saveIdempotency } from '../shared/idempotency';
import { type DonationResult, type RoundingOption, calculateDonation } from './donation';
import {
  CreateSaleInputSchema,
  type PaymentInput,
  type PaymentResult,
  type SaleLineResult,
  type SaleResult,
  VoidSaleInputSchema,
} from './schemas';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PB1_TAX_CODE = 'PB1';
const DEFAULT_CASH_ACCOUNT_CODE = '1-1300';
const DEFAULT_REVENUE_ACCOUNT_CODE = '4-1100';
const DEFAULT_DONATION_TRUST_ACCOUNT_CODE = '2-2050';
const MANUAL_DISCOUNT_PROMOTION_ID = 'manual-pos-discount';
const DEFAULT_DELIVERY_CHANNELS = [
  { id: 'gofood', label: 'GoFood', netBps: 8000, enabled: true },
  { id: 'grabfood', label: 'GrabFood', netBps: 8000, enabled: true },
  { id: 'shopeefood', label: 'ShopeeFood', netBps: 8000, enabled: true },
] as const;

interface DeliveryChannelConfig {
  id: string;
  label: string;
  netBps: number;
  commissionBps: number;
  enabled: boolean;
}

interface PosPostingConfig {
  taxCode: string;
  taxRateBps: number;
  taxAccountId: string;
  cashAccountId: string;
  revenueAccountId: string;
  donationTrustAccountId: string;
  defaultCogsAccountId: string;
  defaultInventoryAccountId: string;
  deliveryChannels: Map<string, DeliveryChannelConfig>;
}

interface NormalizedPaymentRecord {
  method: PaymentInput['method'];
  amount: bigint;
  reference: string | null;
  donationAmount: bigint | null;
  roundingOption: RoundingOption | null;
}

interface NormalizedPayments {
  records: NormalizedPaymentRecord[];
  donationResult: DonationResult;
}

function normalizeDeliveryChannelConfig(raw: unknown): DeliveryChannelConfig[] {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : [...DEFAULT_DELIVERY_CHANNELS];
  const channels = new Map<string, DeliveryChannelConfig>();

  for (const item of source) {
    const record =
      typeof item === 'string'
        ? { id: item, label: item, netBps: 8000, enabled: true }
        : item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
    if (!record) continue;

    const id = String(record.id ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_-]{2,32}$/.test(id)) continue;

    const rawNetBps = Number(record.netBps ?? 8000);
    const rawCommissionBps = Number(record.commissionBps ?? 10000 - rawNetBps);
    const netBps = Number.isFinite(rawNetBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawNetBps)))
      : 8000;
    const commissionBps = Number.isFinite(rawCommissionBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawCommissionBps)))
      : 10000 - netBps;

    channels.set(id, {
      id,
      label: String(record.label ?? id).trim() || id,
      netBps,
      commissionBps,
      enabled: record.enabled !== false,
    });
  }

  return [...channels.values()];
}

async function resolveAccountIdByCode(tenantId: string, code: string): Promise<Result<string>> {
  const account = await db
    .select({ id: accounts.id, isActive: accounts.isActive, isPostable: accounts.isPostable })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .then((rows) => rows[0]);

  if (!account) return err(AppError.notFound('pos.createSale.accountNotFound', { code }));
  if (!account.isActive || !account.isPostable) {
    return err(AppError.businessRule('pos.createSale.accountNotPostable', { code }));
  }
  return ok(account.id);
}

async function autoPostJournalEntry(
  journalEntryId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  const postedAt = new Date();
  const updated = await db
    .update(journalEntries)
    .set({
      status: 'posted',
      postedAt,
      postedBy: ctx.userId,
      updatedBy: ctx.userId,
      updatedAt: postedAt,
      version: sql`${journalEntries.version} + 1`,
    })
    .where(
      and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'draft'),
      ),
    )
    .returning({ id: journalEntries.id });

  if (updated.length === 0) {
    return err(AppError.conflict('pos.createSale.journalAutoPostFailed', { journalEntryId }));
  }

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'post',
    entityType: 'journal_entry',
    entityId: journalEntryId,
    before: { status: 'draft' },
    after: {
      status: 'posted',
      postedAt: postedAt.toISOString(),
      postedBy: ctx.userId,
    },
    metadata: {
      ip: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      source: 'pos.createSale',
    },
  });

  return ok(undefined);
}

async function resolvePosPostingConfig(
  tenantId: string,
  locationId: string,
  postingDate: string,
): Promise<Result<PosPostingConfig>> {
  const [setting] = await db
    .select({
      pb1TaxCode: posSettings.pb1TaxCode,
      cashAccountCode: posSettings.cashAccountCode,
      revenueAccountCode: posSettings.revenueAccountCode,
      donationTrustAccountCode: posSettings.donationTrustAccountCode,
      deliveryChannelsJson: posSettings.deliveryChannelsJson,
    })
    .from(posSettings)
    .where(and(eq(posSettings.tenantId, tenantId), eq(posSettings.locationId, locationId)))
    .limit(1);

  const taxCode = setting?.pb1TaxCode ?? DEFAULT_PB1_TAX_CODE;
  const [taxRate] = await db
    .select({
      code: taxRates.code,
      rateBps: taxRates.rateBps,
      calculation: taxRates.calculation,
      postingAccountId: taxRates.postingAccountId,
    })
    .from(taxRates)
    .where(
      and(
        eq(taxRates.code, taxCode),
        eq(taxRates.isActive, true),
        sql`${taxRates.effectiveFrom} <= ${postingDate}`,
        sql`(${taxRates.effectiveUntil} IS NULL OR ${taxRates.effectiveUntil} >= ${postingDate})`,
      ),
    )
    .limit(1);

  if (!taxRate) return err(AppError.notFound('pos.createSale.taxRateNotFound', { taxCode }));
  if (taxRate.calculation !== 'inclusive') {
    return err(AppError.businessRule('pos.createSale.taxRateMustBeInclusive', { taxCode }));
  }

  const cashAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.cashAccountCode ?? DEFAULT_CASH_ACCOUNT_CODE,
  );
  if (!cashAccount.ok) return cashAccount;

  const revenueAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.revenueAccountCode ?? DEFAULT_REVENUE_ACCOUNT_CODE,
  );
  if (!revenueAccount.ok) return revenueAccount;

  const donationTrustAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.donationTrustAccountCode ?? DEFAULT_DONATION_TRUST_ACCOUNT_CODE,
  );
  if (!donationTrustAccount.ok) return donationTrustAccount;

  const defaultCogsAccountId = await resolveAccountIdByCode(tenantId, '5-1100');
  if (!defaultCogsAccountId.ok) return defaultCogsAccountId;

  const defaultInventoryAccountId = await resolveAccountIdByCode(tenantId, '1-1210');
  if (!defaultInventoryAccountId.ok) return defaultInventoryAccountId;

  return ok({
    taxCode: taxRate.code,
    taxRateBps: taxRate.rateBps,
    taxAccountId: taxRate.postingAccountId,
    cashAccountId: cashAccount.value,
    revenueAccountId: revenueAccount.value,
    donationTrustAccountId: donationTrustAccount.value,
    defaultCogsAccountId: defaultCogsAccountId.value,
    defaultInventoryAccountId: defaultInventoryAccountId.value,
    deliveryChannels: new Map(
      normalizeDeliveryChannelConfig(setting?.deliveryChannelsJson)
        .filter((channel) => channel.enabled)
        .map((channel) => [channel.id, channel]),
    ),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract inclusive tax from a gross price and return net + tax. */
function extractInclusiveTax(
  inclusivePrice: bigint,
  rateBps: number,
): { net: bigint; tax: bigint } {
  const price10k = BigInt(inclusivePrice) * BigInt(10000);
  const net = price10k / BigInt(10000 + rateBps);
  const tax = inclusivePrice - net;
  return { net, tax };
}

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** Map POS channel code to a user-friendly label for journal descriptions. */
function humanizeChannel(channel: string): string {
  switch (channel) {
    case 'walk_in':
      return 'Walk-in';
    case 'gofood':
      return 'GoFood';
    case 'grabfood':
      return 'GrabFood';
    case 'shopeefood':
      return 'ShopeeFood';
    default:
      return channel
        .split(/[_-]+/)
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
        .join(' ');
  }
}

/**
 * POS stores payment.amount as cash/bank value retained by the business.
 * Cash tender above the sale total is change, not revenue and not drawer cash.
 */
function normalizeSalePayments(
  inputPayments: PaymentInput[],
  totalGrand: bigint,
): Result<NormalizedPayments> {
  const totalTendered = inputPayments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  if (totalTendered < totalGrand) {
    return err(
      AppError.businessRule('pos.createSale.insufficientPayment', {
        required: totalGrand.toString(),
        paid: totalTendered.toString(),
      }),
    );
  }

  const nonCashTotal = inputPayments
    .filter((p) => p.method !== 'cash')
    .reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));

  if (nonCashTotal > totalGrand) {
    return err(
      AppError.businessRule('pos.createSale.nonCashOverpay', {
        required: totalGrand.toString(),
        paid: nonCashTotal.toString(),
      }),
    );
  }

  const cashTendered = inputPayments
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const cashNeededForSale = totalGrand - nonCashTotal;

  if (cashTendered < cashNeededForSale) {
    return err(
      AppError.businessRule('pos.createSale.insufficientPayment', {
        required: totalGrand.toString(),
        paid: totalTendered.toString(),
      }),
    );
  }

  const firstCashPayment = inputPayments.find((p) => p.method === 'cash');
  const roundingOption = (firstCashPayment?.roundingOption ?? 'no_donation') as RoundingOption;
  const donationResult = calculateDonation(cashTendered - cashNeededForSale, roundingOption);
  let cashRetainedRemaining = cashNeededForSale + donationResult.donatedAmount;
  let donationRemaining = donationResult.donatedAmount;

  const records: NormalizedPaymentRecord[] = [];
  for (const payment of inputPayments) {
    const tenderedAmount = BigInt(payment.amount);
    if (payment.method !== 'cash') {
      if (tenderedAmount > BigInt(0)) {
        records.push({
          method: payment.method,
          amount: tenderedAmount,
          reference: payment.reference ?? null,
          donationAmount: null,
          roundingOption: null,
        });
      }
      continue;
    }

    const retainedAmount = minBigint(tenderedAmount, cashRetainedRemaining);
    cashRetainedRemaining -= retainedAmount;
    if (retainedAmount <= BigInt(0)) continue;

    const paymentDonation = minBigint(donationRemaining, retainedAmount);
    donationRemaining -= paymentDonation;
    records.push({
      method: payment.method,
      amount: retainedAmount,
      reference: payment.reference ?? null,
      donationAmount: paymentDonation > BigInt(0) ? paymentDonation : null,
      roundingOption:
        paymentDonation > BigInt(0) && roundingOption !== 'no_donation' ? roundingOption : null,
    });
  }

  if (cashRetainedRemaining > BigInt(0)) {
    return err(AppError.internal('pos.createSale.paymentNormalizationFailed'));
  }

  if (records.length === 0) {
    return err(AppError.businessRule('pos.createSale.noRetainedPayment'));
  }

  return ok({ records, donationResult });
}

/** Generate sales order number T01-YYYY-MM-NNNN (SD §9.5). */
async function generateSaleNumber(tenantId: string, locationId: string): Promise<string> {
  const now = new Date();
  const prefix = `T01-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;

  // Count existing sales orders with this prefix
  const result = await db.execute(
    sql`SELECT COUNT(*) FROM sales_orders WHERE tenant_id = ${tenantId} AND number LIKE ${`${prefix}%`}`,
  );
  const count = Number(result.rows[0]?.count ?? 0);
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
}

/** Look up active BOM for a product, scale by qtySold. */
export async function getBOMIngredients(
  tenantId: string,
  productId: string,
  variantId: string | null,
  qtySold: number,
): Promise<Array<{ ingredientId: string; qty: string; uom: string }>> {
  const bom = await db
    .select({ id: boms.id })
    .from(boms)
    .where(
      and(
        eq(boms.tenantId, tenantId),
        eq(boms.productId, productId),
        variantId ? eq(boms.variantId, variantId) : sql`boms.variant_id IS NULL`,
        eq(boms.isActive, true),
      ),
    )
    .then((r) => r[0]);

  if (!bom) return []; // No BOM → no ingredient deduction (service items)

  const lines = await db
    .select({
      ingredientId: bomLines.ingredientId,
      qty: bomLines.qty,
      uom: bomLines.uom,
    })
    .from(bomLines)
    .where(and(eq(bomLines.bomId, bom.id), eq(bomLines.autoDeduct, true)));

  return lines.map((l) => ({
    ingredientId: l.ingredientId,
    qty: (Number.parseFloat(l.qty) * qtySold).toFixed(3),
    uom: l.uom,
  }));
}

type IngredientStockRow = {
  id: string;
  uom: string;
  qtyOnHand: string | null;
  qtyAvailable: string | null;
};

type IngredientDeduction = {
  stockLevelId: string;
  tenantId: string;
  locationId: string;
  ingredientId: string;
  qty: string;
  uom: string;
  referenceId: string;
  avgUnitCost: bigint;
  cogsAccountId: string | null;
  inventoryAccountId: string | null;
};

type IngredientDeductionDecision =
  | { action: 'deduct' }
  | { action: 'skip'; reason: 'untracked_or_uom_mismatch' }
  | { action: 'insufficient'; qtyOnHand: string | null; qtyAvailable: string | null };

function parseQtyToMilli(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const sign = raw.startsWith('-') ? -1n : 1n;
  const unsigned = raw.replace(/^-/, '');
  const [wholeRaw, fractionRaw = ''] = unsigned.split('.');
  const whole = BigInt(wholeRaw || '0') * 1000n;
  const fraction = BigInt(fractionRaw.padEnd(3, '0').slice(0, 3) || '0');
  return sign * (whole + fraction);
}

export function resolveIngredientDeductionDecision(
  stock: Pick<IngredientStockRow, 'uom' | 'qtyOnHand' | 'qtyAvailable'>,
  ingredient: Pick<IngredientDeduction, 'qty' | 'uom'>,
): IngredientDeductionDecision {
  if (stock.uom !== ingredient.uom) {
    return { action: 'skip', reason: 'untracked_or_uom_mismatch' };
  }

  const required = parseQtyToMilli(ingredient.qty);
  const onHand = parseQtyToMilli(stock.qtyOnHand);
  const available = parseQtyToMilli(stock.qtyAvailable);
  if (required === null || onHand === null || available === null) {
    return { action: 'insufficient', qtyOnHand: stock.qtyOnHand, qtyAvailable: stock.qtyAvailable };
  }

  if (onHand < required || available < required) {
    return { action: 'insufficient', qtyOnHand: stock.qtyOnHand, qtyAvailable: stock.qtyAvailable };
  }

  return { action: 'deduct' };
}

export async function compensateIngredientDeductions(
  deductions: IngredientDeduction[],
  ctx: AuditContext,
  recordMovement: boolean,
): Promise<void> {
  for (const deduction of [...deductions].reverse()) {
    await db
      .update(stockLevels)
      .set({
        qtyOnHand: sql`${stockLevels.qtyOnHand} + ${deduction.qty}::numeric`,
        qtyAvailable: sql`${stockLevels.qtyAvailable} + ${deduction.qty}::numeric`,
        updatedBy: ctx.userId,
        lastMovementAt: new Date(),
      })
      .where(eq(stockLevels.id, deduction.stockLevelId));

    if (recordMovement) {
      await db.insert(stockMovements).values({
        id: generateId(),
        tenantId: deduction.tenantId,
        locationId: deduction.locationId,
        occurredAt: new Date(),
        stockLocationId: null as unknown as string,
        productId: deduction.ingredientId,
        variantId: null,
        batchNo: null,
        qtyDelta: deduction.qty as unknown as ReturnType<typeof String>,
        uom: deduction.uom,
        reason: 'sale_rollback',
        referenceType: 'sales_order',
        referenceId: deduction.referenceId,
        unitCost: null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
  }
}

function insufficientStockError(ingredient: IngredientDeduction, stock?: IngredientStockRow) {
  return AppError.businessRule('pos.createSale.insufficientStock', {
    ingredientId: ingredient.ingredientId,
    requiredQty: ingredient.qty,
    uom: ingredient.uom,
    qtyOnHand: stock?.qtyOnHand ?? null,
    qtyAvailable: stock?.qtyAvailable ?? null,
  });
}

/** Deduct ingredients from stock_levels. */
export async function deductIngredients(
  tenantId: string,
  locationId: string,
  ingredients: Array<{
    ingredientId: string;
    qty: string;
    uom: string;
  }>,
  referenceId: string,
  ctx: AuditContext,
): Promise<Result<IngredientDeduction[]>> {
  const appliedDeductions: IngredientDeduction[] = [];
  try {
    for (const ing of ingredients) {
      const existing = await db
        .select({
          id: stockLevels.id,
          uom: stockLevels.uom,
          qtyOnHand: stockLevels.qtyOnHand,
          qtyAvailable: stockLevels.qtyAvailable,
          avgUnitCost: stockLevels.avgUnitCost,
          cogsAccountId: products.cogsAccountId,
          inventoryAccountId: products.inventoryAccountId,
        })
        .from(stockLevels)
        .innerJoin(products, eq(products.id, stockLevels.productId))
        .where(
          and(
            eq(stockLevels.tenantId, tenantId),
            eq(stockLevels.locationId, locationId),
            eq(stockLevels.productId, ing.ingredientId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) continue;

      const deduction: IngredientDeduction = {
        stockLevelId: existing.id,
        tenantId,
        locationId,
        ingredientId: ing.ingredientId,
        qty: ing.qty,
        uom: ing.uom,
        referenceId,
        avgUnitCost: existing.avgUnitCost ?? 0n,
        cogsAccountId: existing.cogsAccountId,
        inventoryAccountId: existing.inventoryAccountId,
      };
      const decision = resolveIngredientDeductionDecision(existing, deduction);
      if (decision.action === 'skip') continue;
      if (decision.action === 'insufficient') {
        await compensateIngredientDeductions(appliedDeductions, ctx, false);
        return err(insufficientStockError(deduction, existing));
      }

      const updated = await db
        .update(stockLevels)
        .set({
          qtyOnHand: sql`${stockLevels.qtyOnHand} - ${ing.qty}::numeric`,
          qtyAvailable: sql`${stockLevels.qtyAvailable} - ${ing.qty}::numeric`,
          updatedBy: ctx.userId,
          lastMovementAt: new Date(),
        })
        .where(
          and(
            eq(stockLevels.id, existing.id),
            sql`${stockLevels.qtyOnHand} >= ${ing.qty}::numeric`,
            sql`${stockLevels.qtyAvailable} >= ${ing.qty}::numeric`,
          ),
        )
        .returning({ id: stockLevels.id });

      if (!updated[0]) {
        await compensateIngredientDeductions(appliedDeductions, ctx, false);
        return err(insufficientStockError(deduction, existing));
      }

      appliedDeductions.push(deduction);
    }

    if (appliedDeductions.length > 0) {
      await db.insert(stockMovements).values(
        appliedDeductions.map((deduction) => ({
          id: generateId(),
          tenantId: deduction.tenantId,
          locationId: deduction.locationId,
          occurredAt: new Date(),
          stockLocationId: null as unknown as string,
          productId: deduction.ingredientId,
          variantId: null,
          batchNo: null,
          qtyDelta: `-${deduction.qty}` as unknown as ReturnType<typeof String>,
          uom: deduction.uom,
          reason: 'sale',
          referenceType: 'sales_order',
          referenceId: deduction.referenceId,
          unitCost: null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      );
    }

    return ok(appliedDeductions);
  } catch (e) {
    await compensateIngredientDeductions(appliedDeductions, ctx, false);
    return err(AppError.internal('pos.createSale.ingredientDeductionFailed', e));
  }
}

// ─── Create Sale ──────────────────────────────────────────────────────────────

export async function createSale(input: unknown, ctx: AuditContext): Promise<Result<SaleResult>> {
  // 1. Parse input
  const parsed = CreateSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.createSale.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 2. Permission check is scoped to the sale location, not the user's default location.
  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  let claimedIdempotencyId: string | null = null;
  let saleIdToRollback: string | null = null;
  const rollbackSaleData = async () => {
    if (!saleIdToRollback) return;
    await db
      .delete(payments)
      .where(eq(payments.salesOrderId, saleIdToRollback))
      .catch(() => undefined);
    await db
      .delete(promotionApplications)
      .where(eq(promotionApplications.salesOrderId, saleIdToRollback))
      .catch(() => undefined);
    await db
      .delete(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, saleIdToRollback))
      .catch(() => undefined);
    await db
      .delete(salesOrders)
      .where(eq(salesOrders.id, saleIdToRollback))
      .catch(() => undefined);
  };

  let appliedStockDeductions: IngredientDeduction[] = [];
  const rollbackAppliedStockDeductions = async () => {
    if (appliedStockDeductions.length === 0) return;
    await compensateIngredientDeductions(appliedStockDeductions, ctx, true);
    appliedStockDeductions = [];
  };

  try {
    // 3. Validate shift is open
    const shift = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.tenantId, ctx.tenantId),
          eq(shifts.id, data.shiftId),
          eq(shifts.locationId, data.locationId),
          eq(shifts.status, 'open'),
        ),
      )
      .then((r) => r[0]);

    if (!shift) {
      return err(AppError.notFound('pos.createSale.shiftNotOpen', { shiftId: data.shiftId }));
    }

    // 4. Idempotency check — prevent duplicate from offline sync
    // Will be claimed properly later after validations.
    const productIds = [...new Set(data.lines.map((l) => l.productId))];
    const foundProducts = await db
      .select({
        id: products.id,
        isSellable: products.isSellable,
        isActive: products.isActive,
        kind: products.kind,
        defaultSellPrice: products.defaultSellPrice,
      })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));
    const productMap = new Map(foundProducts.map((p) => [p.id, p]));

    const variantIds = [
      ...new Set(data.lines.map((line) => line.variantId).filter((id): id is string => !!id)),
    ];
    const foundVariants = variantIds.length
      ? await db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            sellPrice: productVariants.sellPrice,
            isActive: productVariants.isActive,
          })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.tenantId, ctx.tenantId),
              inArray(productVariants.id, variantIds),
            ),
          )
      : [];
    const variantMap = new Map(foundVariants.map((variant) => [variant.id, variant]));

    for (const line of data.lines) {
      const p = productMap.get(line.productId);
      if (!p) {
        return err(
          AppError.notFound('pos.createSale.productNotFound', { productId: line.productId }),
        );
      }
      if (!p.isActive) {
        return err(
          AppError.businessRule('pos.createSale.productInactive', { productId: line.productId }),
        );
      }
      if (!p.isSellable) {
        return err(
          AppError.businessRule('pos.createSale.productNotSellable', { productId: line.productId }),
        );
      }

      const submittedPrice = BigInt(line.unitPrice);
      if (line.variantId) {
        const variant = variantMap.get(line.variantId);
        if (!variant) {
          return err(
            AppError.notFound('pos.createSale.variantNotFound', { variantId: line.variantId }),
          );
        }
        if (!variant.isActive || variant.productId !== line.productId) {
          return err(
            AppError.businessRule('pos.createSale.variantInvalid', {
              productId: line.productId,
              variantId: line.variantId,
            }),
          );
        }
        const expectedPrice =
          variant.sellPrice > BigInt(0) ? variant.sellPrice : p.defaultSellPrice;
        if (submittedPrice !== expectedPrice) {
          return err(
            AppError.businessRule('pos.createSale.priceMismatch', {
              productId: line.productId,
              variantId: line.variantId,
              expected: expectedPrice.toString(),
              actual: submittedPrice.toString(),
            }),
          );
        }
      } else if (submittedPrice !== p.defaultSellPrice) {
        return err(
          AppError.businessRule('pos.createSale.priceMismatch', {
            productId: line.productId,
            expected: p.defaultSellPrice.toString(),
            actual: submittedPrice.toString(),
          }),
        );
      }
    }

    if (data.customerId) {
      const customer = await db
        .select({ id: partners.id })
        .from(partners)
        .where(
          and(
            eq(partners.tenantId, ctx.tenantId),
            eq(partners.id, data.customerId),
            eq(partners.kind, 'customer'),
            eq(partners.isMember, true),
            eq(partners.isActive, true),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!customer) {
        return err(
          AppError.notFound('pos.createSale.memberNotFound', { customerId: data.customerId }),
        );
      }
    }

    const postingDate = new Date().toISOString().slice(0, 10);
    const postingConfigResult = await resolvePosPostingConfig(
      ctx.tenantId,
      data.locationId,
      postingDate,
    );
    if (!postingConfigResult.ok) return postingConfigResult;
    const postingConfig = postingConfigResult.value;
    if (
      data.channel !== 'walk_in' &&
      data.channel !== 'dine_in' &&
      data.channel !== 'take_away' &&
      !postingConfig.deliveryChannels.has(data.channel)
    ) {
      return err(
        AppError.businessRule('pos.createSale.deliveryChannelNotConfigured', {
          channel: data.channel,
        }),
      );
    }

    // 6. Evaluate promotions
    const activePromotions = await listActivePromotionsForSale({
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      channel: data.channel,
    });

    const cartForEval: Cart = {
      lines: data.lines.map((l) => {
        const up = BigInt(l.unitPrice);
        const qty = Math.round(l.qty);
        return {
          id: l.productId, // using productId as id for line matching in pure promo engine
          productId: l.productId,
          qty,
          unitPrice: up,
          subtotal: up * BigInt(qty),
        };
      }),
      subtotal: data.lines.reduce(
        (sum, l) => sum + BigInt(l.unitPrice) * BigInt(Math.round(l.qty)),
        BigInt(0),
      ),
    };

    const promoResult = evaluatePromotions(cartForEval, activePromotions);

    // 7. Calculate totals
    let totalSubtotal = BigInt(0);
    let totalDiscount = BigInt(0);
    let totalTax = BigInt(0);
    let totalGrand = BigInt(0);

    const lineResults: Array<{
      productId: string;
      variantId: string | null;
      qty: string;
      unitPrice: bigint;
      lineSubtotal: bigint;
      lineDiscount: bigint;
      lineTax: bigint;
      lineTotal: bigint;
      lineDiscountReason: string | null;
      modifierJson: unknown | null;
      notes: string | null;
    }> = [];

    for (const line of data.lines) {
      const unitPrice = BigInt(line.unitPrice);
      const lineSubtotal = unitPrice * BigInt(Math.round(line.qty));
      // For now, distribute order-level auto-discounts across lines proportionally or apply manually
      const lineManualDiscount = BigInt(line.lineDiscount ?? '0');
      const lineTotalDiscount = lineManualDiscount; // Auto discounts will be added at the order level for now to avoid rounding issues

      if (lineTotalDiscount > lineSubtotal) {
        return err(
          AppError.businessRule('pos.createSale.discountExceedsLineTotal', {
            productId: line.productId,
            discount: lineTotalDiscount.toString(),
            lineSubtotal: lineSubtotal.toString(),
          }),
        );
      }
      const lineTotal = lineSubtotal - lineTotalDiscount; // unitPrice already includes PB1
      const { tax } = extractInclusiveTax(lineTotal, postingConfig.taxRateBps);
      const lineTax = tax;

      totalSubtotal += lineSubtotal;
      totalDiscount += lineTotalDiscount;
      totalTax += lineTax;
      totalGrand += lineTotal;

      lineResults.push({
        productId: line.productId,
        variantId: line.variantId ?? null,
        qty: line.qty.toString(),
        unitPrice,
        lineSubtotal,
        lineDiscount: lineTotalDiscount,
        lineTax,
        lineTotal,
        lineDiscountReason: line.lineDiscountReason ?? null,
        modifierJson: line.modifierJson ?? null,
        notes: line.notes ?? null,
      });
    }

    // Apply order-level promo discounts to grand total
    const autoDiscountTotal = promoResult.totalDiscount;
    if (autoDiscountTotal > totalGrand) {
       totalDiscount += totalGrand;
       totalGrand = BigInt(0);
    } else {
       totalDiscount += autoDiscountTotal;
       totalGrand -= autoDiscountTotal;
    }

    // Validate and apply voucher if provided
    let totalVoucherDiscount = BigInt(0);
    let voucherToUpdate: { id: string, code: string } | null = null;
    if (data.voucherCode) {
      if (!data.customerId) {
         return err(AppError.businessRule('pos.createSale.voucherRequiresCustomer', { code: data.voucherCode }));
      }
      const voucher = await db.select().from(memberVouchers).where(and(eq(memberVouchers.tenantId, ctx.tenantId), eq(memberVouchers.code, data.voucherCode))).then(r => r[0]);
      if (!voucher) {
         return err(AppError.notFound('pos.createSale.voucherNotFound', { code: data.voucherCode }));
      }
      if (voucher.memberId !== data.customerId) {
         return err(AppError.businessRule('pos.createSale.voucherOwnerMismatch', { code: data.voucherCode }));
      }
      if (!voucher.isActive) {
         return err(AppError.businessRule('pos.createSale.voucherInactive', { code: data.voucherCode }));
      }
      if (voucher.usedInOrderId) {
         return err(AppError.businessRule('pos.createSale.voucherAlreadyUsed', { code: data.voucherCode }));
      }
      const now = new Date();
      if (now < voucher.validFrom || now > voucher.validUntil) {
         return err(AppError.businessRule('pos.createSale.voucherExpired', { code: data.voucherCode }));
      }
      if (totalGrand < BigInt(voucher.minOrderValue)) {
         return err(AppError.businessRule('pos.createSale.voucherMinOrderNotMet', { code: data.voucherCode, minOrder: voucher.minOrderValue.toString() }));
      }

      if (voucher.kind === 'discount_fixed') {
         totalVoucherDiscount = BigInt(voucher.value);
      } else if (voucher.kind === 'discount_percent') {
         let calculated = (totalGrand * BigInt(voucher.value)) / 100n;
         if (voucher.maxDiscountValue && calculated > BigInt(voucher.maxDiscountValue)) {
            calculated = BigInt(voucher.maxDiscountValue);
         }
         totalVoucherDiscount = calculated;
      }
      
      if (totalVoucherDiscount > totalGrand) {
         totalVoucherDiscount = totalGrand;
      }
      totalGrand -= totalVoucherDiscount;
      voucherToUpdate = { id: voucher.id, code: voucher.code };
    }

    // 8. Validate payment coverage, cash change, and donation rounding.
    const normalizedPayments = normalizeSalePayments(data.payments, totalGrand);
    if (!normalizedPayments.ok) return normalizedPayments;
    const { donationResult, records: normalizedPaymentRecords } = normalizedPayments.value;

    // 7b. SD §25.11 — Calculate donation / rounding for cash payments
    // 8. Generate order number + ID
    const saleId = generateId();
    saleIdToRollback = saleId;
    const saleNumber = await generateSaleNumber(ctx.tenantId, data.locationId);

    // 9. Claim idempotency before any stock/order/accounting mutation.
    const claimResult = await claimIdempotency(
      data.locationId,
      data.idempotencyKey,
      'pos.createSale',
    );
    if (!claimResult.ok) {
      // Fallback check: if duplicateRequest, preserve original error signature
      if (claimResult.error.messageKey === 'pos.createSale.duplicateRequest') {
        const details = claimResult.error.details as { cachedResponse?: { id: string } };
        if (details.cachedResponse?.id) {
          return err(
            AppError.conflict('pos.createSale.duplicateOrder', {
              existingOrderId: details.cachedResponse.id,
            }),
          );
        }
      }
      return err(claimResult.error);
    }
    claimedIdempotencyId = claimResult.value.id;

    // 10. BOM ingredient deduction (for all non-service lines)
    for (const line of data.lines) {
      const p = productMap.get(line.productId);
      if (p?.kind === 'service') continue; // skip service items

      let ingredients = await getBOMIngredients(
        ctx.tenantId,
        line.productId,
        line.variantId ?? null,
        line.qty,
      );

      // Deduct product directly if no BOM (e.g. merchandise, pre-packaged)
      if (ingredients.length === 0) {
        const uom = (p as any).uom ?? 'pcs';
        ingredients = [{
          ingredientId: line.productId,
          qty: line.qty.toString(),
          uom,
        }];
      }

      const deductResult = await deductIngredients(
        ctx.tenantId,
        data.locationId,
        ingredients,
        saleId,
        ctx,
      );
      if (!deductResult.ok) {
        await rollbackAppliedStockDeductions();
        return err(deductResult.error);
      }
      appliedStockDeductions.push(...deductResult.value);
    }
    // 10. Insert sales_order
    await db.insert(salesOrders).values({
      id: saleId,
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      number: saleNumber,
      shiftId: data.shiftId,
      cashierId: ctx.userId,
      channel: data.channel,
      status: 'paid',
      placedAt: new Date(),
      subtotal: totalSubtotal,
      discountTotal: totalDiscount,
      voucherDiscount: totalVoucherDiscount,
      taxTotal: totalTax,
      grandTotal: totalGrand,
      customerId: data.customerId ?? null,
      idempotencyKey: data.idempotencyKey,
      notes: data.notes ?? null,
      version: 1,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    if (voucherToUpdate) {
       await db.update(memberVouchers).set({
         usedAt: new Date(),
         usedInOrderId: saleId,
         isActive: false,
         updatedBy: ctx.userId,
       }).where(eq(memberVouchers.id, voucherToUpdate.id));

       await db.insert(auditLog).values({
         id: generateId(),
         tenantId: ctx.tenantId,
         userId: ctx.userId,
         action: 'redeem',
         entityType: 'member_voucher',
         entityId: voucherToUpdate.id,
         before: { isActive: true, usedInOrderId: null },
         after: { isActive: false, usedInOrderId: saleId },
       });
    }

    // 11. Insert order lines
    const orderLines = lineResults.map((lr, idx) => ({
      id: generateId(),
      salesOrderId: saleId,
      lineNo: idx + 1,
      productId: lr.productId,
      variantId: lr.variantId,
      qty: lr.qty,
      unitPrice: lr.unitPrice,
      lineSubtotal: lr.lineSubtotal,
      lineDiscount: lr.lineDiscount,
      lineTax: lr.lineTax,
      lineTotal: lr.lineTotal,
      modifierJson: lr.modifierJson as never,
      notes: lr.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));
    await db.insert(salesOrderLines).values(orderLines);

    const manualDiscountApplications = lineResults
      .map((lr, idx) => ({ ...lr, lineId: orderLines[idx]?.id ?? null }))
      .filter((lr) => lr.lineDiscount > BigInt(0) && lr.lineId && lr.lineDiscountReason);

    if (manualDiscountApplications.length > 0) {
      await db.insert(promotionApplications).values(
        manualDiscountApplications.map((lr) => ({
          id: generateId(),
          tenantId: ctx.tenantId,
          promotionId: MANUAL_DISCOUNT_PROMOTION_ID,
          salesOrderId: saleId,
          lineId: lr.lineId,
          benefitType: 'manual_line_discount',
          discountAmount: lr.lineDiscount.toString(),
          reason: lr.lineDiscountReason,
          approvedBy: ctx.userId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      );
    }

    // 12. Insert payments
    const paymentRecords = normalizedPaymentRecords.map((p) => ({
      id: generateId(),
      salesOrderId: saleId,
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      occurredAt: new Date(),
      // SD §25.11 — donation on cash payment
      donationAmount: p.donationAmount,
      roundingOption: p.roundingOption,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));
    await db.insert(payments).values(paymentRecords);

    // 13. Create journal entry
    // Delivery settlement is configurable per location via Settings -> POS.
    const isDeliveryChannel = postingConfig.deliveryChannels.has(data.channel);
    const taxableRevenue = totalGrand - totalTax;
    const netRevenue = taxableRevenue;
    const netPB1 = totalTax; // PB1 on gross after line discounts

    // SD §25.11 — JE for cash + donation: record trust separately
    // Cash/settlement/AR debit = gross sale + any donation.
    const totalCashReceived = totalGrand + donationResult.donatedAmount;
    const hasDonation = donationResult.donatedAmount > BigInt(0);

    const jeLines: Array<{
      accountId: string;
      locationId: string;
      description: string;
      debit: string;
      credit: string;
      taxCode?: string;
    }> = [];

    const channelLabel = humanizeChannel(data.channel);
    // DR Cash — total cash received (sale + any donation)
    jeLines.push({
      accountId: postingConfig.cashAccountId,
      locationId: data.locationId,
      description: `${channelLabel} ${isDeliveryChannel ? 'receivable' : 'payment'}${hasDonation ? ' + donasi' : ''}`,
      debit: totalCashReceived.toString(),
      credit: '0',
    });

    // SD §25.11 — CR Donation Trust Payable (liability held until remitted)
    if (hasDonation) {
      jeLines.push({
        accountId: postingConfig.donationTrustAccountId,
        locationId: data.locationId,
        description: `Donasi dari penjualan ${saleNumber}`,
        debit: '0',
        credit: donationResult.donatedAmount.toString(),
      });
    }

    // CR Revenue — net (after PB1)
    jeLines.push({
      accountId: postingConfig.revenueAccountId,
      locationId: data.locationId,
      description: `Sales ${saleNumber}`,
      debit: '0',
      credit: netRevenue.toString(),
    });

    // CR PB1 Payable
    jeLines.push({
      accountId: postingConfig.taxAccountId,
      locationId: data.locationId,
      description: `PB1 ${saleNumber}`,
      debit: '0',
      credit: netPB1.toString(),
      taxCode: postingConfig.taxCode,
    });

    const cogsGroups = new Map<string, { cogsAcc: string; invAcc: string; amount: bigint }>();
    for (const d of appliedStockDeductions) {
      const qtyNum = Number.parseFloat(d.qty);
      const cogsAmount = (d.avgUnitCost * BigInt(Math.round(qtyNum * 1000))) / 1000n;
      if (cogsAmount > 0n) {
        const cAcc = d.cogsAccountId ?? postingConfig.defaultCogsAccountId;
        const iAcc = d.inventoryAccountId ?? postingConfig.defaultInventoryAccountId;
        const key = `${cAcc}-${iAcc}`;
        const existing = cogsGroups.get(key) ?? { cogsAcc: cAcc, invAcc: iAcc, amount: 0n };
        existing.amount += cogsAmount;
        cogsGroups.set(key, existing);
      }
    }

    for (const group of cogsGroups.values()) {
      jeLines.push({
        accountId: group.cogsAcc,
        locationId: data.locationId,
        description: `HPP ${saleNumber}`,
        debit: group.amount.toString(),
        credit: '0',
      });
      jeLines.push({
        accountId: group.invAcc,
        locationId: data.locationId,
        description: `HPP ${saleNumber}`,
        debit: '0',
        credit: group.amount.toString(),
      });
    }

      // Insert auto-promotions into promotionApplications
      if (promoResult.appliedPromotions.length > 0) {
        await db.insert(promotionApplications).values(
          promoResult.appliedPromotions.map((p) => ({
            id: generateId(),
            tenantId: ctx.tenantId,
            promotionId: p.promotionId,
            salesOrderId: saleId,
            lineId: p.lineId ?? null,
            benefitType: 'discount',
            discountAmount: p.discountAmount.toString(),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          }))
        );
      }

    const jeResult = await createJournal(
      {
        postingDate,
        locationId: data.locationId,
        description: `POS ${saleNumber} — ${channelLabel}${isDeliveryChannel ? ' platform receivable' : ''}${hasDonation ? ' + donasi' : ''}`,
        referenceType: 'sales',
        referenceId: saleId,
        lines: jeLines,
      },
      ctx,
    );

    let journalEntryId: string | null = null;
    if (jeResult.ok) {
      journalEntryId = jeResult.value.id;
      const postResult = await autoPostJournalEntry(journalEntryId, ctx);
      if (!postResult.ok) {
        if (claimedIdempotencyId) {
          await db
            .update(idempotencyRecords)
            .set({
              responseStatus: 500,
              responseBody: { error: 'journal_auto_post_failed' } as never,
            })
            .where(eq(idempotencyRecords.id, claimedIdempotencyId));
          claimedIdempotencyId = null;
        }
        await rollbackAppliedStockDeductions();
        await rollbackSaleData();
        return err(postResult.error);
      }
      // Update sales_order with JE reference
      await db.update(salesOrders).set({ journalEntryId }).where(eq(salesOrders.id, saleId));
    } else {
      if (claimedIdempotencyId) {
        await db
          .update(idempotencyRecords)
          .set({
            responseStatus: 500,
            responseBody: { error: 'journal_create_failed' } as never,
          })
          .where(eq(idempotencyRecords.id, claimedIdempotencyId));
        claimedIdempotencyId = null;
      }
      await rollbackAppliedStockDeductions();
      await rollbackSaleData();
      return err(jeResult.error);
    }

    // 14. Idempotency record
    if (!claimedIdempotencyId) {
      await rollbackAppliedStockDeductions();
      return err(AppError.internal('pos.createSale.idempotencyClaimMissing'));
    }
    await releaseIdempotencyClaim(claimedIdempotencyId, 200, { id: saleId });
    claimedIdempotencyId = null;

    // 15. Audit log
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'sales_order',
      entityId: saleId,
      before: null,
      after: {
        number: saleNumber,
        channel: data.channel,
        subtotal: totalSubtotal.toString(),
        discountTotal: totalDiscount.toString(),
        voucherDiscount: totalVoucherDiscount.toString(),
        taxTotal: totalTax.toString(),
        grandTotal: totalGrand.toString(),
        lineCount: lineResults.length,
        paymentCount: data.payments.length,
        manualDiscountCount: manualDiscountApplications.length,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    // 15b. Loyalty points — earn for member customers
    // Points calculated on net (after discounts), in cents (× 100)
    if (manualDiscountApplications.length > 0) {
      const totalManualDiscount = manualDiscountApplications.reduce(
        (sum, row) => sum + row.lineDiscount,
        BigInt(0),
      );
      notifyByPermission({
        tenantId: ctx.tenantId,
        kind: 'promotion',
        title: `Diskon manual POS ${saleNumber}`,
        body: `${manualDiscountApplications.length} baris diskon manual dengan total ${totalManualDiscount.toString()} tercatat untuk review promosi.`,
        link: `/pos/orders?sale=${saleId}`,
        permission: 'promotion.manage',
        extraUserIds: [ctx.userId],
      }).catch(() => {
        // Review notification is best-effort; sale posting must remain non-blocking.
      });
    }

    if (data.customerId && totalGrand > BigInt(0)) {
      earnLoyaltyPoints(data.customerId, totalGrand * BigInt(100), saleId, ctx).catch(() => {
        // Non-fatal: do not fail the sale if loyalty earning fails
      });
    }

    // 16. Build result
    const result: SaleResult = {
      id: saleId,
      number: saleNumber,
      status: 'paid',
      channel: data.channel,
      subtotal: totalSubtotal.toString(),
      discountTotal: totalDiscount.toString(),
      voucherDiscount: totalVoucherDiscount.toString(),
      taxTotal: totalTax.toString(),
      grandTotal: totalGrand.toString(),
      lines: orderLines.map((ol) => ({
        id: ol.id,
        lineNo: ol.lineNo,
        productId: ol.productId,
        variantId: ol.variantId ?? null,
        qty: ol.qty,
        unitPrice: ol.unitPrice.toString(),
        lineSubtotal: ol.lineSubtotal.toString(),
        lineDiscount: ol.lineDiscount.toString(),
        lineTax: ol.lineTax.toString(),
        lineTotal: ol.lineTotal.toString(),
        modifierJson: ol.modifierJson,
        notes: ol.notes,
      })),
      payments: paymentRecords.map((pr) => ({
        id: pr.id,
        method: pr.method,
        amount: pr.amount.toString(),
        reference: pr.reference,
        donationAmount: pr.donationAmount ? pr.donationAmount.toString() : null,
        roundingOption: pr.roundingOption,
      })),
      journalEntryId,
    };

    return ok(result);
  } catch (e: any) {
    await rollbackAppliedStockDeductions().catch(() => undefined);
    await rollbackSaleData();
    if (e instanceof Error || typeof e === 'object') {
      const errObj = e as any;
      if (errObj.code === '23514' || errObj.message?.includes('stock_levels_qty_check')) {
        if (claimedIdempotencyId) {
          await releaseIdempotencyClaim(claimedIdempotencyId, 400, { error: 'insufficient_stock' });
        }
        return err(AppError.businessRule('pos.createSale.insufficientStock'));
      }
    }

    if (claimedIdempotencyId) {
      await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'sale_create_failed' });
    }
    return err(AppError.internal('pos.createSale.failed', e));
  }
}

// ─── Void Sale (cancel before payment) ────────────────────────────────────────

export async function voidSale(input: unknown, ctx: AuditContext): Promise<Result<SaleResult>> {
  const parsed = VoidSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.void.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const sale = await db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenantId), eq(salesOrders.id, data.salesOrderId)))
      .then((r) => r[0]);

    if (!sale) {
      return err(AppError.notFound('pos.void.notFound', { salesOrderId: data.salesOrderId }));
    }
    const permCheck = await requirePermission(ctx.userId, 'pos.void', {
      locationId: sale.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (sale.status !== 'open') {
      return err(AppError.businessRule('pos.void.notOpen', { currentStatus: sale.status }));
    }
    if (sale.version !== data.version) {
      return err(AppError.conflict('pos.void.versionMismatch'));
    }

    // CLAIM the order — two concurrent void attempts must produce exactly
    // one audit log entry, not two.
    const claimedVoid = await db
      .update(salesOrders)
      .set({
        status: 'voided',
        notes: data.reason,
        updatedBy: ctx.userId,
        version: sale.version + 1,
      })
      .where(
        and(
          eq(salesOrders.id, data.salesOrderId),
          eq(salesOrders.version, sale.version),
          eq(salesOrders.status, 'open'),
        ),
      )
      .returning({ id: salesOrders.id });
    if (!claimedVoid || claimedVoid.length === 0) {
      return err(AppError.conflict('pos.void.versionMismatch'));
    }

    const lines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, data.salesOrderId))
      .orderBy(salesOrderLines.lineNo);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'void',
      entityType: 'sales_order',
      entityId: data.salesOrderId,
      before: { status: sale.status },
      after: { status: 'voided', reason: data.reason },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok({
      id: sale.id,
      number: sale.number,
      status: 'voided',
      channel: sale.channel as SaleResult['channel'],
      subtotal: sale.subtotal.toString(),
      discountTotal: sale.discountTotal.toString(),
      taxTotal: sale.taxTotal.toString(),
      grandTotal: sale.grandTotal.toString(),
      voucherDiscount: sale.voucherDiscount.toString(),
      lines: lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        productId: l.productId,
        variantId: l.variantId ?? null,
        qty: l.qty,
        unitPrice: l.unitPrice.toString(),
        lineSubtotal: l.lineSubtotal.toString(),
        lineDiscount: l.lineDiscount.toString(),
        lineTax: l.lineTax.toString(),
        lineTotal: l.lineTotal.toString(),
        modifierJson: l.modifierJson as unknown,
        notes: l.notes,
      })),
      payments: [],
      journalEntryId: null,
    });
  } catch (e) {
    return err(AppError.internal('pos.void.failed', e));
  }
}
