/**
 * inventory.opname — Stock Opname workflow service (SD §25.9.3)
 *
 * Workflow:
 *   draft → in_progress → submitted → approved
 *                                ↘ cancelled
 *
 * Execution on approval:
 * - For each line with varianceQty ≠ 0:
 *     Creates stock_movement (reason='adjustment')
 *     Updates stock_levels qty_on_hand = countedQty
 * - Creates balancing JE:
 *     Shortage (total variance negative): DR Beban Operasional (6-1110), CR Inventory (1-1210)
 *     Surplus (total variance positive): DR Inventory, CR Pendapatan Lainnya (4-2020)
 *
 * Permissions:
 *   inventory.opname    — create + record count + submit + cancel
 *   inventory.opname.approve — approve (director only)
 */

import { db } from '@erp/db';
import { accountingPeriods, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { products, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { stockOpnameLines, stockOpnameSessions } from '@erp/db/schema/stock-opname';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { resolveAccountIdsByCodes } from '../accounting/account-resolver';
import { createJournal } from '../accounting/create-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { generateOpnameNumber } from '../shared/number-generator';

type SupportedLocale = 'id' | 'en' | 'zh';

// Variance JE accounts (inventory + shortage expense / surplus income) come
// from the configurable account map (Settings → Accounting → Account Mapping);
// see accounting/posting-accounts.ts. Resolved to UUIDs at posting time.

// ─── Return types ─────────────────────────────────────────────────────────────

export interface OpnameResult {
  id: string;
  number: string;
  sessionDate: string;
  periodCode: string;
  status: string;
  notes: string | null;
  lines: OpnameLineResult[];
  journalEntryId: string | null;
}

export interface OpnameLineResult {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productKind: string | null;
  variantId: string | null;
  uom: string;
  systemQty: string;
  countedQty: string | null;
  varianceQty: string | null;
  varianceValue: string | null;
  isCounted: boolean;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build line result from DB row + optional product enrichment. */
function buildLineResult(
  l: Pick<
    typeof stockOpnameLines.$inferSelect,
    | 'id'
    | 'lineNo'
    | 'productId'
    | 'variantId'
    | 'uom'
    | 'systemQty'
    | 'countedQty'
    | 'varianceQty'
    | 'varianceValue'
    | 'isCounted'
    | 'notes'
  >,
  productInfo?: { sku: string | null; name: string | null; kind: string | null },
): OpnameLineResult {
  return {
    id: l.id,
    lineNo: l.lineNo,
    productId: l.productId,
    productSku: productInfo?.sku ?? null,
    productName: productInfo?.name ?? null,
    productKind: productInfo?.kind ?? null,
    variantId: l.variantId ?? null,
    uom: l.uom,
    systemQty: l.systemQty,
    countedQty: l.countedQty ?? null,
    varianceQty: l.varianceQty ?? null,
    varianceValue: l.varianceValue ? l.varianceValue.toString() : null,
    isCounted: l.isCounted,
    notes: l.notes,
  };
}

/**
 * Upsert a single stock level row.
 *
 * Bug history: the lookup previously ignored `variantId`, so for any
 * product with multiple variants the same row would be overwritten with
 * each variant's counted qty — corrupting stock for every variant
 * except the last one written. The match now includes the variant.
 *
 * Opname adjusts QUANTITY only — the weighted-average cost is not
 * recomputed from the variance value (variance value is a P&L number,
 * not a cost). avgUnitCost is intentionally not written on update; new
 * rows inherit whatever default was passed.
 */
async function upsertStockLevel(params: {
  tenantId: string;
  locationId: string;
  productId: string;
  variantId: string | null;
  uom: string;
  qtyOnHand: string;
  lastMovementAt: Date;
  userId: string;
}): Promise<void> {
  const variantMatch = params.variantId
    ? eq(stockLevels.variantId, params.variantId)
    : isNull(stockLevels.variantId);

  const existing = await db
    .select({ id: stockLevels.id })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.tenantId, params.tenantId),
        eq(stockLevels.locationId, params.locationId),
        eq(stockLevels.productId, params.productId),
        variantMatch,
      ),
    )
    .then((r) => r[0]);

  if (existing) {
    await db
      .update(stockLevels)
      .set({
        qtyOnHand: params.qtyOnHand,
        qtyAvailable: params.qtyOnHand,
        lastMovementAt: params.lastMovementAt,
        updatedBy: params.userId,
      })
      .where(eq(stockLevels.id, existing.id));
  } else {
    await db.insert(stockLevels).values({
      id: generateId(),
      tenantId: params.tenantId,
      locationId: params.locationId,
      productId: params.productId,
      variantId: params.variantId ?? null,
      uom: params.uom,
      qtyOnHand: params.qtyOnHand,
      qtyReserved: '0',
      qtyAvailable: params.qtyOnHand,
      avgUnitCost: null,
      lastMovementAt: params.lastMovementAt,
      createdBy: params.userId,
      updatedBy: params.userId,
    });
  }
}

// ─── Create Draft ─────────────────────────────────────────────────────────────

/**
 * Create a new stock opname session in 'draft' status.
 * Auto-populates lines with systemQty from stock_levels for all tracked products.
 *
 * Permission: inventory.opname
 */
export async function createOpnameDraft(
  input: {
    sessionDate: string; // YYYY-MM-DD
    periodCode: string;
    notes?: string;
    /** Product-level opname bucket: daily, weekly, or monthly. */
    kind?: 'daily' | 'weekly' | 'monthly';
  },
  ctx: AuditContext,
): Promise<Result<OpnameResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.opname', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // Period must be open. Code is unique PER TENANT (`periods_tenant_code_idx`),
  // so we must filter by tenant — otherwise the query could pick up another
  // tenant's period with the same code (e.g. '2026-05') and either reject a
  // valid request or accept one against a closed period.
  const period = await db
    .select({ id: accountingPeriods.id, status: accountingPeriods.status })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, ctx.tenantId),
        eq(accountingPeriods.code, input.periodCode),
      ),
    )
    .then((r) => r[0]);

  if (!period) {
    return err(new AppError('NOT_FOUND', 'errors.accounting.period_not_found'));
  }
  if (period.status !== 'open') {
    return err(new AppError('BUSINESS_RULE', 'errors.accounting.period_closed'));
  }

  // Generate number
  const number = await generateOpnameNumber(ctx.tenantId, input.sessionDate);
  const id = generateId();
  const now = new Date();

  // Build the opname snapshot from EVERY active inventory-tracked
  // product, LEFT JOINing stock_levels so products that have never
  // been tracked at this location still appear (with systemQty=0).
  //
  // Previously the query INNER-JOINed stock_levels, which silently
  // dropped newly added raw materials and finished goods that hadn't
  // moved yet — leaving the operator no way to count them.
  //
  // Service kind ('service') is excluded — no physical stock to count.
  // Daily-mode sessions include only fast-mover categories (raw_material
  // by default); monthly sessions include everything else as well.
  const sessionKind = input.kind ?? 'monthly';
  const includeKinds = ['raw_material', 'finished_good', 'consumable', 'merchandise'];

  const productRows = await db
    .select({
      productId: products.id,
      uom: products.uom,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, ctx.tenantId),
        eq(products.isActive, true),
        sql`${products.opnameFrequencies} ? ${sessionKind}`,
        inArray(products.kind, includeKinds),
      ),
    )
    .orderBy(products.sku);

  const stockMap = new Map<string, { qtyOnHand: string; variantId: string | null }>();
  if (productRows.length > 0) {
    const stockRows = await db
      .select({
        productId: stockLevels.productId,
        variantId: stockLevels.variantId,
        qtyOnHand: stockLevels.qtyOnHand,
      })
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, ctx.locationId),
          inArray(
            stockLevels.productId,
            productRows.map((p) => p.productId),
          ),
        ),
      );
    for (const row of stockRows) {
      stockMap.set(row.productId, {
        qtyOnHand: row.qtyOnHand,
        variantId: row.variantId ?? null,
      });
    }
  }

  // Insert session
  await db.insert(stockOpnameSessions).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    number,
    sessionDate: input.sessionDate,
    periodCode: input.periodCode,
    status: 'draft',
    kind: sessionKind,
    preparedBy: ctx.userId,
    preparedAt: now,
    notes: input.notes ?? null,
    createdBy: ctx.userId,
  });

  // Insert snapshot lines — every active product gets a line, with
  // systemQty defaulting to '0' when no stock_levels row exists.
  const lines = productRows.map((row, idx) => {
    const stock = stockMap.get(row.productId);
    return {
      id: generateId(),
      sessionId: id,
      lineNo: idx + 1,
      productId: row.productId,
      variantId: stock?.variantId ?? null,
      uom: row.uom,
      systemQty: stock?.qtyOnHand ?? '0',
      countedQty: null,
      isCounted: false,
      varianceQty: null,
      varianceValue: null,
      createdBy: ctx.userId,
    };
  });

  if (lines.length > 0) {
    await db.insert(stockOpnameLines).values(lines);
  }

  // Audit log
  await auditRecord({
    action: 'create',
    entityType: 'stock_opname_session',
    entityId: id,
    before: null,
    after: {
      id,
      number,
      sessionDate: input.sessionDate,
      periodCode: input.periodCode,
      linesCount: lines.length,
    },
    ctx,
  });

  return ok({
    id,
    number,
    sessionDate: input.sessionDate,
    periodCode: input.periodCode,
    status: 'draft',
    notes: input.notes ?? null,
    lines: [],
    journalEntryId: null,
  });
}

// ─── Record Physical Count ──────────────────────────────────────────────────────

/**
 * Record physical count for one or more products in an opname session.
 * Transitions session status from draft → in_progress.
 *
 * Permission: inventory.opname
 */
export async function recordCount(
  input: {
    sessionId: string;
    counts: Array<{
      productId: string;
      variantId?: string | null;
      countedQty: string;
      notes?: string;
    }>;
  },
  ctx: AuditContext,
): Promise<Result<OpnameResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.opname', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const session = await db
    .select()
    .from(stockOpnameSessions)
    .where(
      and(
        eq(stockOpnameSessions.id, input.sessionId),
        eq(stockOpnameSessions.tenantId, ctx.tenantId),
        eq(stockOpnameSessions.locationId, ctx.locationId),
      ),
    )
    .then((r) => r[0]);

  if (!session) {
    return err(new AppError('NOT_FOUND', 'errors.general.notFound'));
  }
  if (session.status !== 'draft' && session.status !== 'in_progress') {
    return err(
      new AppError('BUSINESS_RULE', 'errors.inventory.opname_wrong_status', {
        current: session.status,
        allowed: ['draft', 'in_progress'],
      }),
    );
  }

  // Update each count
  await Promise.all(
    input.counts.map(async (count) => {
      const lineCondition = count.variantId
        ? and(
            eq(stockOpnameLines.sessionId, input.sessionId),
            eq(stockOpnameLines.productId, count.productId),
            eq(stockOpnameLines.variantId, count.variantId),
          )
        : and(
            eq(stockOpnameLines.sessionId, input.sessionId),
            eq(stockOpnameLines.productId, count.productId),
          );

      await db
        .update(stockOpnameLines)
        .set({
          countedQty: count.countedQty,
          isCounted: true,
          notes: count.notes ?? null,
        })
        .where(lineCondition);
    }),
  );

  // Transition session to in_progress if it was draft
  if (session.status === 'draft') {
    await db
      .update(stockOpnameSessions)
      .set({ status: 'in_progress' })
      .where(eq(stockOpnameSessions.id, input.sessionId));
  }

  return ok({
    id: session.id,
    number: session.number,
    sessionDate: session.sessionDate.toString().substring(0, 10),
    periodCode: session.periodCode,
    status: 'in_progress',
    notes: session.notes,
    lines: [],
    journalEntryId: null,
  });
}

// ─── Submit ────────────────────────────────────────────────────────────────────

/**
 * Submit an opname session for approval.
 * All lines must be counted. Calculates varianceQty and varianceValue per line.
 *
 * Permission: inventory.opname
 */
export async function submitOpname(
  sessionId: string,
  ctx: AuditContext,
): Promise<Result<OpnameResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.opname', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const session = await db
    .select()
    .from(stockOpnameSessions)
    .where(
      and(
        eq(stockOpnameSessions.id, sessionId),
        eq(stockOpnameSessions.tenantId, ctx.tenantId),
        eq(stockOpnameSessions.locationId, ctx.locationId),
      ),
    )
    .then((r) => r[0]);

  if (!session) {
    return err(new AppError('NOT_FOUND', 'errors.general.notFound'));
  }
  if (session.status !== 'in_progress') {
    return err(
      new AppError('BUSINESS_RULE', 'errors.inventory.opname_wrong_status', {
        current: session.status,
        allowed: ['in_progress'],
      }),
    );
  }

  const lines = await db
    .select()
    .from(stockOpnameLines)
    .where(eq(stockOpnameLines.sessionId, sessionId));

  const uncounted = lines.filter((l) => !l.isCounted);
  if (uncounted.length > 0) {
    return err(
      new AppError('VALIDATION_FAILED', 'errors.inventory.opname_uncounted', {
        count: uncounted.length,
        products: uncounted.map((l) => l.productId),
      }),
    );
  }

  // Fetch avgUnitCost for all products — both the product list and the
  // stock-level join are tenant-scoped so a stray row from another
  // tenant can't poison the cost map (defense-in-depth — the IDs come
  // from a tenant-scoped session already).
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const productCosts = await db
    .select({ id: products.id, avgUnitCost: stockLevels.avgUnitCost })
    .from(products)
    .leftJoin(
      stockLevels,
      and(
        eq(stockLevels.productId, products.id),
        eq(stockLevels.locationId, ctx.locationId),
        eq(stockLevels.tenantId, ctx.tenantId),
      ),
    )
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));

  const costMap = new Map<string, bigint>();
  for (const p of productCosts) {
    costMap.set(p.id, (p.avgUnitCost as bigint | null) ?? BigInt(0));
  }

  // Calculate variance and update each line
  await Promise.all(
    lines.map(async (line) => {
      const counted = Number.parseFloat(line.countedQty ?? '0');
      const system = Number.parseFloat(line.systemQty);
      const varianceQtyNum = counted - system;
      const varianceQtyStr = varianceQtyNum.toFixed(3);

      const avgCost = costMap.get(line.productId) ?? BigInt(0);
      const varianceQtyAbs = Math.abs(varianceQtyNum);
      const varianceValueBig = (avgCost * BigInt(Math.round(varianceQtyAbs * 1000))) / BigInt(1000);

      await db
        .update(stockOpnameLines)
        .set({ varianceQty: varianceQtyStr, varianceValue: varianceValueBig })
        .where(eq(stockOpnameLines.id, line.id));
    }),
  );

  const now = new Date();
  await db
    .update(stockOpnameSessions)
    .set({ status: 'submitted', submittedBy: ctx.userId, submittedAt: now })
    .where(eq(stockOpnameSessions.id, sessionId));

  await auditRecord({
    action: 'submit',
    entityType: 'stock_opname_session',
    entityId: sessionId,
    before: { status: session.status },
    after: { status: 'submitted' },
    ctx,
  });

  // Notify approvers (inventory.opname.approve holders).
  const { notifyByPermission } = await import('../notification');
  notifyByPermission({
    tenantId: ctx.tenantId,
    kind: 'opname',
    title: 'Stock opname menunggu persetujuan',
    body: `No. ${session.number}`,
    link: '/inventory/opname',
    permission: 'inventory.opname.approve',
  }).catch(() => {});

  return ok({
    id: session.id,
    number: session.number,
    sessionDate: session.sessionDate.toString().substring(0, 10),
    periodCode: session.periodCode,
    status: 'submitted',
    notes: session.notes,
    lines: [],
    journalEntryId: null,
  });
}

// ─── Approve ────────────────────────────────────────────────────────────────────

/**
 * Approve an opname session — executes stock changes + creates JE.
 * Only directors can approve.
 *
 * Permission: inventory.opname.approve (director only)
 */
export async function approveOpname(
  sessionId: string,
  ctx: AuditContext,
): Promise<Result<OpnameResult>> {
  const session = await db
    .select()
    .from(stockOpnameSessions)
    .where(
      and(eq(stockOpnameSessions.id, sessionId), eq(stockOpnameSessions.tenantId, ctx.tenantId)),
    )
    .then((r) => r[0]);

  if (!session) {
    return err(new AppError('NOT_FOUND', 'errors.general.notFound'));
  }

  // Scope permission to the session's location — a director on shift at
  // outlet A may not approve outlet B's opname session.
  const permCheck = await requirePermission(ctx.userId, 'inventory.opname.approve', {
    locationId: session.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (session.status !== 'submitted') {
    return err(
      new AppError('BUSINESS_RULE', 'errors.inventory.opname_wrong_status', {
        current: session.status,
        allowed: ['submitted'],
      }),
    );
  }

  const lines = await db
    .select()
    .from(stockOpnameLines)
    .where(eq(stockOpnameLines.sessionId, sessionId));

  const now = new Date();

  // CLAIM the session before mutating inventory. Two concurrent
  // approvers would otherwise both run the variance pass, doubling
  // stock_movement rows. Returning rows confirms exclusive ownership.
  const claimed = await db
    .update(stockOpnameSessions)
    .set({ status: 'approved', approvedBy: ctx.userId, approvedAt: now })
    .where(and(eq(stockOpnameSessions.id, sessionId), eq(stockOpnameSessions.status, 'submitted')))
    .returning({ id: stockOpnameSessions.id });
  if (!claimed || claimed.length === 0) {
    return err(
      new AppError('CONFLICT', 'errors.inventory.opname_wrong_status', {
        current: session.status,
        allowed: ['submitted'],
      }),
    );
  }

  // 1. Execute stock movements + update stock_levels for lines with
  //    variance ≠ 0. Use the SESSION's locationId so a director who is
  //    currently checked-in elsewhere can't accidentally apply the
  //    deltas to the wrong outlet.
  await Promise.all(
    lines.map(async (line) => {
      const varianceNum = Number.parseFloat(line.varianceQty ?? '0');
      if (Math.abs(varianceNum) < 0.001) return; // no variance, skip

      await upsertStockLevel({
        tenantId: ctx.tenantId,
        locationId: session.locationId,
        productId: line.productId,
        variantId: line.variantId ?? null,
        uom: line.uom,
        qtyOnHand: line.countedQty ?? '0',
        lastMovementAt: now,
        userId: ctx.userId,
      });

      await db.insert(stockMovements).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        locationId: session.locationId,
        occurredAt: now,
        productId: line.productId,
        variantId: line.variantId ?? null,
        batchNo: null,
        qtyDelta: line.varianceQty ?? '0',
        uom: line.uom,
        reason: 'adjustment',
        referenceType: 'manual',
        referenceId: sessionId,
        unitCost: line.varianceValue ?? null,
        createdBy: ctx.userId,
      });
    }),
  );

  // 2. Calculate Total Physical Value for all items in this location
  // We query all stock_levels for this location (after the above updates)
  const allStocks = await db
    .select({ qty: stockLevels.qtyOnHand, cost: stockLevels.avgUnitCost })
    .from(stockLevels)
    .where(
      and(eq(stockLevels.tenantId, ctx.tenantId), eq(stockLevels.locationId, session.locationId)),
    );

  let totalPhysicalValue = BigInt(0);
  for (const st of allStocks) {
    const qtyNum = Number.parseFloat(st.qty);
    const scaledQty = BigInt(Math.round(qtyNum * 1000));
    const unitCost = (st.cost as bigint | null) ?? BigInt(0);
    totalPhysicalValue += (scaledQty * unitCost) / BigInt(1000);
  }

  let resultJournalId: string | null = null;

  // Resolve inventory and adjustment accounts (not COGS — opname variance
  // should hit the same adjustment expense/income accounts as stock adjustments
  // per SD §9.3: 6-1110 beban penyesuaian / 4-2020 pendapatan lainnya).
  const acctCodes = await getPostingAccountCodes(ctx.tenantId);
  const inventoryCode = acctCodes.inventory;
  const adjustExpenseCode = acctCodes['adjustment.expense'];
  const adjustIncomeCode = acctCodes['adjustment.income'];

  const codeMap = await resolveAccountIdsByCodes(ctx.tenantId, [
    inventoryCode,
    adjustExpenseCode,
    adjustIncomeCode,
  ]);
  const inventoryAccountId = codeMap.get(inventoryCode);
  const adjustExpenseAccountId = codeMap.get(adjustExpenseCode);
  const adjustIncomeAccountId = codeMap.get(adjustIncomeCode);

  if (!inventoryAccountId || !adjustExpenseAccountId || !adjustIncomeAccountId) {
    return err(
      AppError.businessRule('inventory.opname.varianceAccountsMissing', {
        missing: [
          !inventoryAccountId ? inventoryCode : null,
          !adjustExpenseAccountId ? adjustExpenseCode : null,
          !adjustIncomeAccountId ? adjustIncomeCode : null,
        ].filter(Boolean),
      }),
    );
  }

  // 3. Calculate current GL Balance for Inventory Account at this location
  const glRows = await db
    .select({
      totalDebit: sql<bigint>`sum(${journalLines.debit})`,
      totalCredit: sql<bigint>`sum(${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, inventoryAccountId),
        eq(journalLines.locationId, session.locationId),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.tenantId, ctx.tenantId),
      ),
    );

  const glDebit = (glRows[0]?.totalDebit as bigint | null) ?? BigInt(0);
  const glCredit = (glRows[0]?.totalCredit as bigint | null) ?? BigInt(0);
  const glBalance = glDebit - glCredit;

  // 4. Calculate Periodic True-Up Adjustment
  // adjustment = totalPhysicalValue - glBalance
  // If adjustment > 0, we need to INCREASE GL balance (Debit Inventory, Credit Adjustment Income)
  // If adjustment < 0, we need to DECREASE GL balance (Debit Adjustment Expense, Credit Inventory)
  const adjustmentValue = totalPhysicalValue - glBalance;

  if (adjustmentValue !== BigInt(0)) {
    if (adjustmentValue > BigInt(0)) {
      // Physical > GL (Gain, need to increase GL)
      const jeResult = await createJournal(
        {
          postingDate: session.sessionDate.toString().substring(0, 10),
          locationId: session.locationId,
          description: `Stock Opname ${session.number} — periodic true-up gain`,
          referenceType: 'stock_adjustment',
          referenceId: sessionId,
          lines: [
            {
              accountId: inventoryAccountId,
              debit: adjustmentValue.toString(),
              credit: '0',
              locationId: session.locationId,
            },
            {
              accountId: adjustIncomeAccountId,
              debit: '0',
              credit: adjustmentValue.toString(),
              locationId: session.locationId,
            },
          ],
        },
        ctx,
        { skipPermissionCheck: true },
      );
      if (!jeResult.ok) return jeResult;
      resultJournalId = jeResult.value.id;
    } else {
      // Physical < GL (Loss, need to decrease GL)
      const absValue = (adjustmentValue * BigInt(-1)).toString();
      const jeResult = await createJournal(
        {
          postingDate: session.sessionDate.toString().substring(0, 10),
          locationId: session.locationId,
          description: `Stock Opname ${session.number} — periodic true-up loss`,
          referenceType: 'stock_adjustment',
          referenceId: sessionId,
          lines: [
            {
              accountId: adjustExpenseAccountId,
              debit: absValue,
              credit: '0',
              locationId: session.locationId,
            },
            {
              accountId: inventoryAccountId,
              debit: '0',
              credit: absValue,
              locationId: session.locationId,
            },
          ],
        },
        ctx,
        { skipPermissionCheck: true },
      );
      if (!jeResult.ok) return jeResult;
      resultJournalId = jeResult.value.id;
    }
  }

  // Session was already claimed above; no second status update needed.

  await auditRecord({
    action: 'approve',
    entityType: 'stock_opname_session',
    entityId: sessionId,
    before: { status: 'submitted' },
    after: { status: 'approved', journalEntryId: resultJournalId, linesCount: lines.length },
    ctx,
  });

  return ok({
    id: session.id,
    number: session.number,
    sessionDate: session.sessionDate.toString().substring(0, 10),
    periodCode: session.periodCode,
    status: 'approved',
    notes: session.notes,
    lines: lines.map((l) => buildLineResult(l)),
    journalEntryId: resultJournalId,
  });
}

// ─── Cancel ────────────────────────────────────────────────────────────────────

/**
 * Cancel an opname session. Only allowed in draft or in_progress.
 *
 * Permission: inventory.opname
 */
export async function cancelOpname(
  sessionId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.opname', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const session = await db
    .select()
    .from(stockOpnameSessions)
    .where(
      and(
        eq(stockOpnameSessions.id, sessionId),
        eq(stockOpnameSessions.tenantId, ctx.tenantId),
        eq(stockOpnameSessions.locationId, ctx.locationId),
      ),
    )
    .then((r) => r[0]);

  if (!session) {
    return err(new AppError('NOT_FOUND', 'errors.general.notFound'));
  }
  if (session.status !== 'draft' && session.status !== 'in_progress') {
    return err(
      new AppError('BUSINESS_RULE', 'errors.inventory.opname_wrong_status', {
        current: session.status,
        allowed: ['draft', 'in_progress'],
      }),
    );
  }

  await db
    .update(stockOpnameSessions)
    .set({ status: 'cancelled' })
    .where(eq(stockOpnameSessions.id, sessionId));

  await auditRecord({
    action: 'cancel',
    entityType: 'stock_opname_session',
    entityId: sessionId,
    before: { status: session.status },
    after: { status: 'cancelled' },
    ctx,
  });

  return ok({ id: sessionId, status: 'cancelled' });
}

// ─── Get Session ────────────────────────────────────────────────────────────────

/**
 * Get a full opname session with its lines.
 *
 * Permission: inventory.opname
 */
export async function getOpname(
  sessionId: string,
  ctx: AuditContext,
  options?: { locale?: SupportedLocale },
): Promise<Result<OpnameResult>> {
  const session = await db
    .select()
    .from(stockOpnameSessions)
    .where(
      and(eq(stockOpnameSessions.id, sessionId), eq(stockOpnameSessions.tenantId, ctx.tenantId)),
    )
    .then((r) => r[0]);

  if (!session) {
    return err(new AppError('NOT_FOUND', 'errors.general.notFound'));
  }

  // Enrich lines with product SKU + localized name + kind. Without
  // this, the UI showed raw UUIDs in both the SKU and product columns
  // and had no way to filter by raw_material vs finished_good.
  const lines = await db
    .select({
      id: stockOpnameLines.id,
      lineNo: stockOpnameLines.lineNo,
      productId: stockOpnameLines.productId,
      variantId: stockOpnameLines.variantId,
      uom: stockOpnameLines.uom,
      systemQty: stockOpnameLines.systemQty,
      countedQty: stockOpnameLines.countedQty,
      varianceQty: stockOpnameLines.varianceQty,
      varianceValue: stockOpnameLines.varianceValue,
      isCounted: stockOpnameLines.isCounted,
      notes: stockOpnameLines.notes,
      productSku: products.sku,
      productName: products.name,
      productKind: products.kind,
    })
    .from(stockOpnameLines)
    .leftJoin(
      products,
      and(eq(products.id, stockOpnameLines.productId), eq(products.tenantId, ctx.tenantId)),
    )
    .where(eq(stockOpnameLines.sessionId, sessionId))
    .orderBy(stockOpnameLines.lineNo);

  const locale: SupportedLocale = options?.locale ?? 'id';
  function pickName(name: unknown): string | null {
    if (!name) return null;
    const rec = name as Record<string, string>;
    return rec[locale] ?? rec.id ?? rec.en ?? rec.zh ?? null;
  }

  return ok({
    id: session.id,
    number: session.number,
    sessionDate: session.sessionDate.toString().substring(0, 10),
    periodCode: session.periodCode,
    status: session.status,
    notes: session.notes,
    lines: lines.map((l) =>
      buildLineResult(l, {
        sku: l.productSku ?? null,
        name: pickName(l.productName),
        kind: l.productKind ?? null,
      }),
    ),
    journalEntryId: null,
  });
}
