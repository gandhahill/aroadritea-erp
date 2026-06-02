import { db } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  fixedAssetCategories,
  fixedAssetDepreciationLines,
  fixedAssetDepreciationRuns,
  fixedAssets,
} from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext, LocaleString } from '@erp/shared/types';
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { can, requirePermission } from '../iam';
import { createJournal } from './create-journal';
import { postJournal } from './post-journal';
import { getPostingAccountCodes } from './posting-accounts';
import {
  type CreateFixedAssetInput,
  CreateFixedAssetSchema,
  type DepreciationMethod,
  type ListFixedAssetsInput,
  ListFixedAssetsSchema,
  type RunFixedAssetDepreciationInput,
  RunFixedAssetDepreciationSchema,
  type UpdateFixedAssetCategoryInput,
  UpdateFixedAssetCategorySchema,
  type DisposeFixedAssetInput,
  DisposeFixedAssetSchema,
} from './schemas';

type FixedAssetRow = typeof fixedAssets.$inferSelect;

const GLOBAL_FIXED_ASSET_VIEW_PROBE = { locationId: '__global_fixed_asset_view__' };

export interface FixedAssetCategoryItem {
  id: string;
  code: string;
  name: LocaleString;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
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
        assetAccountId: row.assetAccountId,
        accumulatedDepreciationAccountId: row.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: row.depreciationExpenseAccountId,
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

export async function updateFixedAssetCategory(
  input: UpdateFixedAssetCategoryInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdateFixedAssetCategorySchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.fixedAsset.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.fixed_asset.manage', {
    locationId: ctx.locationId || GLOBAL_FIXED_ASSET_VIEW_PROBE.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const [category] = await db
        .select()
        .from(fixedAssetCategories)
        .where(
          and(
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
            eq(fixedAssetCategories.id, data.id),
            isNull(fixedAssetCategories.deletedAt),
          ),
        )
        .limit(1);
      if (!category) throw AppError.notFound('accounting.fixedAsset.categoryNotFound');

      const accountRows = await db
        .select({
          id: accounts.id,
          type: accounts.type,
          subtype: accounts.subtype,
          isActive: accounts.isActive,
          isPostable: accounts.isPostable,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, ctx.tenantId),
            inArray(accounts.id, [
              data.assetAccountId,
              data.accumulatedDepreciationAccountId,
              data.depreciationExpenseAccountId,
            ]),
            isNull(accounts.deletedAt),
          ),
        );
      const accountById = new Map(accountRows.map((account) => [account.id, account]));
      validateFixedAssetCategoryAccount(
        accountById.get(data.assetAccountId),
        'asset',
        'fixed_asset',
      );
      validateFixedAssetCategoryAccount(
        accountById.get(data.accumulatedDepreciationAccountId),
        'asset',
        'contra_asset',
      );
      validateFixedAssetCategoryAccount(
        accountById.get(data.depreciationExpenseAccountId),
        'expense',
      );

      await db
        .update(fixedAssetCategories)
        .set({
          defaultUsefulLifeMonths: data.defaultUsefulLifeMonths,
          defaultDepreciationMethod: data.defaultDepreciationMethod,
          assetAccountId: data.assetAccountId,
          accumulatedDepreciationAccountId: data.accumulatedDepreciationAccountId,
          depreciationExpenseAccountId: data.depreciationExpenseAccountId,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
          version: category.version + 1,
        })
        .where(
          and(
            eq(fixedAssetCategories.tenantId, ctx.tenantId),
            eq(fixedAssetCategories.id, data.id),
            eq(fixedAssetCategories.version, category.version),
          ),
        );

      await auditRecord({
        action: 'update',
        entityType: 'fixed_asset_category',
        entityId: category.id,
        before: {
          defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
          defaultDepreciationMethod: category.defaultDepreciationMethod,
          assetAccountId: category.assetAccountId,
          accumulatedDepreciationAccountId: category.accumulatedDepreciationAccountId,
          depreciationExpenseAccountId: category.depreciationExpenseAccountId,
        },
        after: data,
        ctx,
      });

      return { id: category.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.categoryUpdateFailed', e);
    },
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

      await auditRecord({
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
        ctx,
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
        ctx, { skipPermissionCheck: true }
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

      await auditRecord({
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
        ctx,
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

export async function validateFixedAssetDepreciationJournalCanReverse(
  journalEntryId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  return tryCatch(
    async () => {
      const run = await findPostedDepreciationRunByJournal(journalEntryId, ctx.tenantId);
      if (!run) return;

      const lines = await db
        .select({ assetId: fixedAssetDepreciationLines.assetId })
        .from(fixedAssetDepreciationLines)
        .where(eq(fixedAssetDepreciationLines.runId, run.id));
      if (lines.length === 0) return;

      const assetIds = lines.map((line) => line.assetId);
      const [laterRun] = await db
        .select({ id: fixedAssetDepreciationRuns.id })
        .from(fixedAssetDepreciationLines)
        .innerJoin(
          fixedAssetDepreciationRuns,
          eq(fixedAssetDepreciationRuns.id, fixedAssetDepreciationLines.runId),
        )
        .where(
          and(
            eq(fixedAssetDepreciationRuns.tenantId, ctx.tenantId),
            eq(fixedAssetDepreciationRuns.status, 'posted'),
            inArray(fixedAssetDepreciationLines.assetId, assetIds),
            sql`${fixedAssetDepreciationRuns.postingDate} > ${run.postingDate}`,
          ),
        )
        .limit(1);

      if (laterRun) {
        throw AppError.businessRule('accounting.fixedAsset.reverseLatestRunFirst', {
          journalEntryId,
          runId: run.id,
        });
      }
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.reversePrecheckFailed', e);
    },
  );
}

export async function voidFixedAssetDepreciationForJournal(
  journalEntryId: string,
  reversalJournalEntryId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  return tryCatch(
    async () => {
      const run = await findPostedDepreciationRunByJournal(journalEntryId, ctx.tenantId);
      if (!run) return;

      const preflight = await validateFixedAssetDepreciationJournalCanReverse(journalEntryId, ctx);
      if (!preflight.ok) throw preflight.error;

      const lines = await db
        .select({
          id: fixedAssetDepreciationLines.id,
          assetId: fixedAssetDepreciationLines.assetId,
          amount: fixedAssetDepreciationLines.amount,
          asset: fixedAssets,
        })
        .from(fixedAssetDepreciationLines)
        .innerJoin(
          fixedAssets,
          and(
            eq(fixedAssets.id, fixedAssetDepreciationLines.assetId),
            eq(fixedAssets.tenantId, ctx.tenantId),
          ),
        )
        .where(eq(fixedAssetDepreciationLines.runId, run.id));

      for (const line of lines) {
        const newAccumulated =
          line.asset.accumulatedDepreciation > line.amount
            ? line.asset.accumulatedDepreciation - line.amount
            : 0n;
        const previousDate = await findPreviousPostedDepreciationDate(
          line.assetId,
          run.id,
          run.postingDate,
          ctx.tenantId,
        );
        const bookValueAfter = line.asset.acquisitionCost - newAccumulated;
        const nextStatus =
          line.asset.status === 'disposed'
            ? 'disposed'
            : bookValueAfter <= line.asset.salvageValue
              ? 'fully_depreciated'
              : 'active';

        await db
          .update(fixedAssets)
          .set({
            accumulatedDepreciation: newAccumulated,
            lastDepreciationDate: previousDate,
            status: nextStatus,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
            version: line.asset.version + 1,
          })
          .where(and(eq(fixedAssets.id, line.assetId), eq(fixedAssets.tenantId, ctx.tenantId)));
      }

      await db
        .update(fixedAssetDepreciationRuns)
        .set({
          status: 'void',
          notes: run.notes
            ? `${run.notes}\nVoided by reversal journal ${reversalJournalEntryId}.`
            : `Voided by reversal journal ${reversalJournalEntryId}.`,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
          version: run.version + 1,
        })
        .where(
          and(
            eq(fixedAssetDepreciationRuns.id, run.id),
            eq(fixedAssetDepreciationRuns.tenantId, ctx.tenantId),
            eq(fixedAssetDepreciationRuns.status, 'posted'),
          ),
        );

      await auditRecord({
        action: 'void_depreciation',
        entityType: 'fixed_asset_depreciation_run',
        entityId: run.id,
        before: {
          status: 'posted',
          journalEntryId,
          totalAmount: run.totalAmount.toString(),
        },
        after: {
          status: 'void',
          reversalJournalEntryId,
          assetCount: lines.length,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.voidDepreciationFailed', e);
    },
  );
}

async function findPostedDepreciationRunByJournal(journalEntryId: string, tenantId: string) {
  const [run] = await db
    .select()
    .from(fixedAssetDepreciationRuns)
    .where(
      and(
        eq(fixedAssetDepreciationRuns.tenantId, tenantId),
        eq(fixedAssetDepreciationRuns.journalEntryId, journalEntryId),
        eq(fixedAssetDepreciationRuns.status, 'posted'),
      ),
    )
    .limit(1);
  return run ?? null;
}

async function findPreviousPostedDepreciationDate(
  assetId: string,
  excludedRunId: string,
  beforePostingDate: string,
  tenantId: string,
) {
  const [row] = await db
    .select({
      postingDate: sql<string | null>`max(${fixedAssetDepreciationRuns.postingDate})`,
    })
    .from(fixedAssetDepreciationLines)
    .innerJoin(
      fixedAssetDepreciationRuns,
      eq(fixedAssetDepreciationRuns.id, fixedAssetDepreciationLines.runId),
    )
    .where(
      and(
        eq(fixedAssetDepreciationRuns.tenantId, tenantId),
        eq(fixedAssetDepreciationRuns.status, 'posted'),
        eq(fixedAssetDepreciationLines.assetId, assetId),
        sql`${fixedAssetDepreciationRuns.id} <> ${excludedRunId}`,
        lt(fixedAssetDepreciationRuns.postingDate, beforePostingDate),
      ),
    );
  return row?.postingDate ?? null;
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

function validateFixedAssetCategoryAccount(
  account:
    | {
        type: string;
        subtype: string;
        isActive: boolean;
        isPostable: boolean;
      }
    | undefined,
  expectedType: string,
  expectedSubtype?: string,
) {
  if (!account || !account.isActive || !account.isPostable) {
    throw AppError.businessRule('accounting.fixedAsset.invalidCategoryAccount');
  }
  if (account.type !== expectedType) {
    throw AppError.businessRule('accounting.fixedAsset.invalidCategoryAccount');
  }
  if (expectedSubtype && account.subtype !== expectedSubtype) {
    throw AppError.businessRule('accounting.fixedAsset.invalidCategoryAccount');
  }
}

export async function disposeFixedAsset(
  input: DisposeFixedAssetInput,
  ctx: AuditContext,
): Promise<Result<{ journalEntryId: string }>> {
  const parsed = DisposeFixedAssetSchema.safeParse(input);
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

  return tryCatch(
    async () => {
      const [row] = await db
        .select({
          asset: fixedAssets,
          assetAccountId: fixedAssetCategories.assetAccountId,
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
        .where(
          and(
            eq(fixedAssets.id, data.id),
            eq(fixedAssets.tenantId, ctx.tenantId),
            isNull(fixedAssets.deletedAt),
          ),
        )
        .limit(1);

      if (!row) throw AppError.notFound('accounting.fixedAsset.notFound');
      if (row.asset.status === 'disposed') {
        throw AppError.businessRule('accounting.fixedAsset.alreadyDisposed');
      }

      const bookValue = row.asset.acquisitionCost - row.asset.accumulatedDepreciation;
      const salePrice = BigInt(data.salePrice);
      const gainLoss = salePrice - bookValue;

      const disposalCodes = await getPostingAccountCodes(ctx.tenantId);
      const [gainLossAcct] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, ctx.tenantId),
            eq(accounts.code, disposalCodes['fixedAsset.gainOnDisposal']),
          ),
        )
        .limit(1);

      if (!gainLossAcct) {
        throw AppError.businessRule('accounting.fixedAsset.gainLossAccountNotFound');
      }

      if (salePrice > 0n && !data.saleAccountId) {
        throw AppError.businessRule('accounting.fixedAsset.saleAccountRequired');
      }

      const lines = [];

      lines.push({
        accountId: row.assetAccountId,
        locationId: data.locationId,
        debit: '0',
        credit: row.asset.acquisitionCost.toString(),
      });

      if (row.asset.accumulatedDepreciation > 0n) {
        lines.push({
          accountId: row.accumulatedAccountId,
          locationId: data.locationId,
          debit: row.asset.accumulatedDepreciation.toString(),
          credit: '0',
        });
      }

      if (salePrice > 0n && data.saleAccountId) {
        lines.push({
          accountId: data.saleAccountId,
          locationId: data.locationId,
          debit: salePrice.toString(),
          credit: '0',
        });
      }

      if (gainLoss > 0n) {
        lines.push({
          accountId: gainLossAcct.id,
          locationId: data.locationId,
          debit: '0',
          credit: gainLoss.toString(),
        });
      } else if (gainLoss < 0n) {
        lines.push({
          accountId: gainLossAcct.id,
          locationId: data.locationId,
          debit: (-gainLoss).toString(),
          credit: '0',
        });
      }

      const journalResult = await createJournal(
        {
          postingDate: data.disposalDate,
          locationId: data.locationId,
          description: `Pelepasan aset tetap: ${row.asset.code} - ${row.asset.name}`,
          referenceType: 'manual',
          lines,
        },
        ctx, { skipPermissionCheck: true }
      );

      if (!journalResult.ok) throw journalResult.error;

      const postResult = await postJournal({ journalId: journalResult.value.id }, ctx);
      if (!postResult.ok) throw postResult.error;

      await db
        .update(fixedAssets)
        .set({
          status: 'disposed',
          disposalDate: data.disposalDate,
          disposalJournalEntryId: journalResult.value.id,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
          version: row.asset.version + 1,
        })
        .where(
          and(
            eq(fixedAssets.id, data.id),
            eq(fixedAssets.tenantId, ctx.tenantId),
            eq(fixedAssets.version, row.asset.version),
          ),
        );

      await auditRecord({
        action: 'dispose',
        entityType: 'fixed_asset',
        entityId: data.id,
        before: {
          status: row.asset.status,
        },
        after: {
          status: 'disposed',
          disposalDate: data.disposalDate,
          salePrice: salePrice.toString(),
          gainLoss: gainLoss.toString(),
          journalEntryId: journalResult.value.id,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { journalEntryId: journalResult.value.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.fixedAsset.disposeFailed', e);
    },
  );
}
