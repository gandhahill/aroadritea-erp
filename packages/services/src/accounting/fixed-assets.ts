import { db } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  fixedAssetCategories,
  fixedAssetDepreciationLines,
  fixedAssetDepreciationRuns,
  fixedAssets,
} from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext, LocaleString } from '@erp/shared/types';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { can, requirePermission } from '../iam';
import { createJournal } from './create-journal';
import { postJournal } from './post-journal';
import {
  type CreateFixedAssetInput,
  CreateFixedAssetSchema,
  type DepreciationMethod,
  type ListFixedAssetsInput,
  ListFixedAssetsSchema,
  type RunFixedAssetDepreciationInput,
  RunFixedAssetDepreciationSchema,
} from './schemas';

type FixedAssetRow = typeof fixedAssets.$inferSelect;

const GLOBAL_FIXED_ASSET_VIEW_PROBE = { locationId: '__global_fixed_asset_view__' };

export interface FixedAssetCategoryItem {
  id: string;
  code: string;
  name: LocaleString;
  assetAccountCode: string;
  accumulatedDepreciationAccountCode: string;
  depreciationExpenseAccountCode: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: DepreciationMethod;
}

export interface FixedAssetListItem {
  id: string;
  locationId: string;
  categoryId: string;
  categoryCode: string;
  categoryName: LocaleString;
  code: string;
  name: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionCost: string;
  salvageValue: string;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accumulatedDepreciation: string;
  bookValue: string;
  lastDepreciationDate: string | null;
  status: string;
  notes: string | null;
}

export interface DepreciationRunResult {
  runId: string;
  journalEntryId: string;
  totalAmount: string;
  lineCount: number;
}

export async function listFixedAssetCategories(
  ctx: AuditContext,
): Promise<Result<FixedAssetCategoryItem[]>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.view', {
    locationId: ctx.locationId || GLOBAL_FIXED_ASSET_VIEW_PROBE.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const rows = await db
        .select({
          id: fixedAssetCategories.id,
          code: fixedAssetCategories.code,
          name: fixedAssetCategories.name,
          defaultUsefulLifeMonths: fixedAssetCategories.defaultUsefulLifeMonths,
          defaultDepreciationMethod: fixedAssetCategories.defaultDepreciationMethod,
          assetAccountId: fixedAssetCategories.assetAccountId,
          accumulatedDepreciationAccountId: fixedAssetCategories.accumulatedDepreciationAccountId,
          depreciationExpenseAccountId: fixedAssetCategories.depreciationExpenseAccountId,
        })
        .from(fixedAssetCategories)
        .where(
          and(
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
            eq(fixedAssetCategories.isActive, true),
            isNull(fixedAssetCategories.deletedAt),
          ),
        )
        .orderBy(fixedAssetCategories.code);

      const accountIds = [
        ...new Set(
          rows.flatMap((row) => [
            row.assetAccountId,
            row.accumulatedDepreciationAccountId,
            row.depreciationExpenseAccountId,
          ]),
        ),
      ];
      const accountRows =
        accountIds.length > 0
          ? await db
              .select({ id: accounts.id, code: accounts.code })
              .from(accounts)
              .where(and(eq(accounts.tenantId, ctx.tenantId), inArray(accounts.id, accountIds)))
          : [];
      const accountCodeById = new Map(accountRows.map((row) => [row.id, row.code]));

      return rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name as LocaleString,
        assetAccountCode: accountCodeById.get(row.assetAccountId) ?? '',
        accumulatedDepreciationAccountCode:
          accountCodeById.get(row.accumulatedDepreciationAccountId) ?? '',
        depreciationExpenseAccountCode: accountCodeById.get(row.depreciationExpenseAccountId) ?? '',
        defaultUsefulLifeMonths: row.defaultUsefulLifeMonths,
        defaultDepreciationMethod: row.defaultDepreciationMethod as DepreciationMethod,
      }));
    },
    (e) => AppError.internal('accounting.fixedAsset.categoryListFailed', e),
  );
}

export async function listFixedAssets(
  input: ListFixedAssetsInput,
  ctx: AuditContext,
): Promise<Result<{ items: FixedAssetListItem[]; total: number }>> {
  const parsed = ListFixedAssetsSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.fixedAsset.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;
  const hasGlobalView = await can(
    ctx.userId,
    'accounting.fixed_asset.view',
    GLOBAL_FIXED_ASSET_VIEW_PROBE,
  );
  const effectiveLocationId = data.locationId ?? (hasGlobalView ? undefined : ctx.locationId);

  if (data.locationId) {
    const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.view', {
      locationId: data.locationId,
    });
    if (!permCheck.ok) return permCheck;
  } else if (!hasGlobalView) {
    const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.view', {
      locationId: ctx.locationId,
    });
    if (!permCheck.ok) return permCheck;
  }

  return tryCatch(
    async () => {
      const conditions = [eq(fixedAssets.tenantId, ctx.tenantId), isNull(fixedAssets.deletedAt)];
      if (effectiveLocationId) conditions.push(eq(fixedAssets.locationId, effectiveLocationId));
      if (data.status) conditions.push(eq(fixedAssets.status, data.status));

      const whereClause = and(...conditions);
      const countRows = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(fixedAssets)
        .where(whereClause);

      const rows = await db
        .select({
          asset: fixedAssets,
          categoryCode: fixedAssetCategories.code,
          categoryName: fixedAssetCategories.name,
        })
        .from(fixedAssets)
        .innerJoin(
          fixedAssetCategories,
          and(
            eq(fixedAssetCategories.id, fixedAssets.categoryId),
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
          ),
        )
        .where(whereClause)
        .orderBy(desc(fixedAssets.inServiceDate), fixedAssets.code)
        .limit(data.limit)
        .offset(data.offset);

      return {
        total: countRows[0]?.count ?? 0,
        items: rows.map((row) =>
          toFixedAssetListItem(row.asset, {
            code: row.categoryCode,
            name: row.categoryName as LocaleString,
          }),
        ),
      };
    },
    (e) => AppError.internal('accounting.fixedAsset.listFailed', e),
  );
}

export async function createFixedAsset(
  input: CreateFixedAssetInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateFixedAssetSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.fixedAsset.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.manage', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const acquisitionCost = BigInt(data.acquisitionCost);
  const salvageValue = BigInt(data.salvageValue);
  if (salvageValue >= acquisitionCost) {
    return err(AppError.businessRule('accounting.fixedAsset.salvageTooHigh'));
  }
  if (data.depreciationMethod === 'declining_balance' && !data.depreciationRateBps) {
    return err(AppError.businessRule('accounting.fixedAsset.rateRequired'));
  }
  if (data.depreciationMethod === 'units_of_production' && !data.productionCapacity) {
    return err(AppError.businessRule('accounting.fixedAsset.productionCapacityRequired'));
  }

  return tryCatch(
    async () => {
      const [category] = await db
        .select({ id: fixedAssetCategories.id })
        .from(fixedAssetCategories)
        .where(
          and(
            eq(fixedAssetCategories.id, data.categoryId),
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
            eq(fixedAssetCategories.isActive, true),
            isNull(fixedAssetCategories.deletedAt),
          ),
        )
        .limit(1);
      if (!category) throw AppError.notFound('accounting.fixedAsset.categoryNotFound');

      const id = generateId();
      await db.insert(fixedAssets).values({
        id,
        tenantId: ctx.tenantId,
        locationId: data.locationId,
        categoryId: data.categoryId,
        code: data.code,
        name: data.name,
        acquisitionDate: data.acquisitionDate,
        inServiceDate: data.inServiceDate,
        acquisitionCost,
        salvageValue,
        usefulLifeMonths: data.usefulLifeMonths,
        depreciationMethod: data.depreciationMethod,
        depreciationRateBps: data.depreciationRateBps ?? null,
        productionCapacity: data.productionCapacity ? BigInt(data.productionCapacity) : null,
        notes: data.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'fixed_asset',
        entityId: id,
        before: null,
        after: {
          code: data.code,
          name: data.name,
          locationId: data.locationId,
          categoryId: data.categoryId,
          acquisitionCost: data.acquisitionCost,
          depreciationMethod: data.depreciationMethod,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return { id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.createFailed', e);
    },
  );
}

export async function runFixedAssetDepreciation(
  input: RunFixedAssetDepreciationInput,
  ctx: AuditContext,
): Promise<Result<DepreciationRunResult>> {
  const parsed = RunFixedAssetDepreciationSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.fixedAsset.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.depreciate', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const periodCode = data.postingDate.substring(0, 7);
      const [period] = await db
        .select()
        .from(accountingPeriods)
        .where(
          and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
        )
        .limit(1);
      if (!period) throw AppError.businessRule('accounting.journal.periodNotFound', { periodCode });
      if (period.status !== 'open') {
        throw AppError.businessRule('accounting.journal.periodClosed', {
          periodCode,
          periodStatus: period.status,
        });
      }

      const conditions = [
        eq(fixedAssets.tenantId, ctx.tenantId),
        eq(fixedAssets.locationId, data.locationId),
        eq(fixedAssets.status, 'active'),
        isNull(fixedAssets.deletedAt),
      ];
      if (data.assetIds?.length) conditions.push(inArray(fixedAssets.id, data.assetIds));

      const rows = await db
        .select({
          asset: fixedAssets,
          categoryCode: fixedAssetCategories.code,
          expenseAccountId: fixedAssetCategories.depreciationExpenseAccountId,
          accumulatedAccountId: fixedAssetCategories.accumulatedDepreciationAccountId,
        })
        .from(fixedAssets)
        .innerJoin(
          fixedAssetCategories,
          and(
            eq(fixedAssetCategories.id, fixedAssets.categoryId),
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
          ),
        )
        .where(and(...conditions))
        .orderBy(fixedAssets.code);

      const depreciationLines = rows
        .map((row) => {
          const unitsUsed = data.unitsUsedByAssetId?.[row.asset.id];
          const amount = calculateDepreciationAmount(row.asset, data.postingDate, unitsUsed);
          if (amount <= 0n) return null;
          const accumulatedAfter = row.asset.accumulatedDepreciation + amount;
          const bookValueAfter = row.asset.acquisitionCost - accumulatedAfter;
          return {
            asset: row.asset,
            categoryCode: row.categoryCode,
            expenseAccountId: row.expenseAccountId,
            accumulatedAccountId: row.accumulatedAccountId,
            amount,
            accumulatedAfter,
            bookValueAfter,
            unitsUsed: unitsUsed ? BigInt(unitsUsed) : null,
          };
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line));

      if (depreciationLines.length === 0) {
        throw AppError.businessRule('accounting.fixedAsset.noDepreciationDue');
      }

      const totalAmount = depreciationLines.reduce((sum, line) => sum + line.amount, 0n);
      const runId = generateId();
      const journalLines = buildDepreciationJournalLines(depreciationLines, data.locationId);

      const journalResult = await createJournal(
        {
          postingDate: data.postingDate,
          locationId: data.locationId,
          description: `Penyusutan aset tetap ${periodCode}`,
          referenceType: 'fixed_asset_depreciation',
          referenceId: runId,
          lines: journalLines,
        },
        ctx,
      );
      if (!journalResult.ok) throw journalResult.error;

      const postResult = await postJournal({ journalId: journalResult.value.id }, ctx);
      if (!postResult.ok) throw postResult.error;

      await db.insert(fixedAssetDepreciationRuns).values({
        id: runId,
        tenantId: ctx.tenantId,
        locationId: data.locationId,
        periodId: period.id,
        postingDate: data.postingDate,
        totalAmount,
        journalEntryId: journalResult.value.id,
        notes: data.notes ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await db.insert(fixedAssetDepreciationLines).values(
        depreciationLines.map((line) => ({
          id: generateId(),
          runId,
          assetId: line.asset.id,
          amount: line.amount,
          accumulatedAfter: line.accumulatedAfter,
          bookValueAfter: line.bookValueAfter,
          unitsUsed: line.unitsUsed,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })),
      );

      for (const line of depreciationLines) {
        await db
          .update(fixedAssets)
          .set({
            accumulatedDepreciation: line.accumulatedAfter,
            lastDepreciationDate: data.postingDate,
            status: line.bookValueAfter <= line.asset.salvageValue ? 'fully_depreciated' : 'active',
            updatedAt: new Date(),
            updatedBy: ctx.userId,
            version: line.asset.version + 1,
          })
          .where(
            and(
              eq(fixedAssets.id, line.asset.id),
              eq(fixedAssets.tenantId, ctx.tenantId),
              eq(fixedAssets.version, line.asset.version),
            ),
          );
      }

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'post_depreciation',
        entityType: 'fixed_asset_depreciation_run',
        entityId: runId,
        before: null,
        after: {
          postingDate: data.postingDate,
          locationId: data.locationId,
          totalAmount: totalAmount.toString(),
          assetCount: depreciationLines.length,
          journalEntryId: journalResult.value.id,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return {
        runId,
        journalEntryId: journalResult.value.id,
        totalAmount: totalAmount.toString(),
        lineCount: depreciationLines.length,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.depreciationFailed', e);
    },
  );
}

function toFixedAssetListItem(
  asset: FixedAssetRow,
  category: { code: string; name: LocaleString },
): FixedAssetListItem {
  const bookValue = asset.acquisitionCost - asset.accumulatedDepreciation;
  return {
    id: asset.id,
    locationId: asset.locationId,
    categoryId: asset.categoryId,
    categoryCode: category.code,
    categoryName: category.name,
    code: asset.code,
    name: asset.name,
    acquisitionDate: String(asset.acquisitionDate),
    inServiceDate: String(asset.inServiceDate),
    acquisitionCost: asset.acquisitionCost.toString(),
    salvageValue: asset.salvageValue.toString(),
    usefulLifeMonths: asset.usefulLifeMonths,
    depreciationMethod: asset.depreciationMethod as DepreciationMethod,
    accumulatedDepreciation: asset.accumulatedDepreciation.toString(),
    bookValue: bookValue.toString(),
    lastDepreciationDate: asset.lastDepreciationDate ? String(asset.lastDepreciationDate) : null,
    status: asset.status,
    notes: asset.notes,
  };
}

function buildDepreciationJournalLines(
  lines: Array<{
    categoryCode: string;
    expenseAccountId: string;
    accumulatedAccountId: string;
    amount: bigint;
  }>,
  locationId: string,
) {
  const grouped = new Map<
    string,
    {
      categoryCode: string;
      expenseAccountId: string;
      accumulatedAccountId: string;
      amount: bigint;
    }
  >();
  for (const line of lines) {
    const key = `${line.expenseAccountId}:${line.accumulatedAccountId}`;
    const current = grouped.get(key);
    if (current) {
      current.amount += line.amount;
    } else {
      grouped.set(key, { ...line });
    }
  }

  return [...grouped.values()].flatMap((line) => [
    {
      accountId: line.expenseAccountId,
      locationId,
      description: `Beban penyusutan ${line.categoryCode}`,
      debit: line.amount.toString(),
      credit: '0',
    },
    {
      accountId: line.accumulatedAccountId,
      locationId,
      description: `Akumulasi penyusutan ${line.categoryCode}`,
      debit: '0',
      credit: line.amount.toString(),
    },
  ]);
}

function calculateDepreciationAmount(
  asset: FixedAssetRow,
  postingDate: string,
  unitsUsed?: string,
): bigint {
  if (alreadyDepreciatedThisPeriod(asset.lastDepreciationDate, postingDate)) return 0n;
  const depreciableBase = asset.acquisitionCost - asset.salvageValue;
  const remaining = asset.acquisitionCost - asset.salvageValue - asset.accumulatedDepreciation;
  if (depreciableBase <= 0n || remaining <= 0n) return 0n;

  let amount = 0n;
  switch (asset.depreciationMethod as DepreciationMethod) {
    case 'declining_balance': {
      const rateBps = BigInt(asset.depreciationRateBps ?? 2500);
      amount = ((asset.acquisitionCost - asset.accumulatedDepreciation) * rateBps) / 120000n;
      break;
    }
    case 'double_declining_balance': {
      const denominator = BigInt(Math.max(asset.usefulLifeMonths, 1));
      amount = ((asset.acquisitionCost - asset.accumulatedDepreciation) * 2n) / denominator;
      break;
    }
    case 'sum_of_years_digits': {
      const elapsed = BigInt(
        Math.min(
          asset.usefulLifeMonths - 1,
          Math.max(0, monthsBetween(asset.inServiceDate, postingDate)),
        ),
      );
      const life = BigInt(asset.usefulLifeMonths);
      const remainingMonthsWeight = life - elapsed;
      const denominator = (life * (life + 1n)) / 2n;
      amount = (depreciableBase * remainingMonthsWeight) / denominator;
      break;
    }
    case 'units_of_production': {
      if (!unitsUsed || !asset.productionCapacity || asset.productionCapacity <= 0n) return 0n;
      amount = (depreciableBase * BigInt(unitsUsed)) / asset.productionCapacity;
      break;
    }
    default:
      amount = depreciableBase / BigInt(asset.usefulLifeMonths);
  }

  if (amount <= 0n) amount = 1n;
  return amount > remaining ? remaining : amount;
}

function alreadyDepreciatedThisPeriod(
  lastDepreciationDate: string | Date | null,
  postingDate: string,
) {
  if (!lastDepreciationDate) return false;
  return String(lastDepreciationDate).slice(0, 7) >= postingDate.slice(0, 7);
}

function monthsBetween(from: string | Date, to: string): number {
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  );
}
