/**
 * Accounting MCP tools — SD §16.4, §20
 *
 * Tools:
 * - accounting.list_accounts
 * - accounting.create_journal
 * - accounting.post_journal
 * - accounting.reverse_journal
 * - accounting.get_period_status
 * - accounting.close_period
 */

import { auditLog, db } from '@erp/db';
import { accounts, journalEntries } from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import { isActive } from '@erp/db/schema/common';
import * as accounting from '@erp/services/accounting';
import type {
  ClosePeriodInput,
  CreateFixedAssetInput,
  CreateJournalInput,
  GetPeriodStatusInput,
  ListFixedAssetsInput,
  PostJournalInput,
  ReverseJournalInput,
  RunFixedAssetDepreciationInput,
} from '@erp/services/accounting';
import { type PermissionContext, can } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, requireConfirmation, serializeResult } from '../helpers';

// --- Permission ---

async function checkPermission(ctx: McpContext, permission: string, locationId?: string) {
  const context: PermissionContext = locationId ? { locationId } : {};
  return can(ctx.userId, permission, context);
}

// --- Handlers ---

export async function listAccountsHandler(
  input: z.infer<typeof ListAccountsSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.view');

  const conditions = [eq(accounts.tenantId, ctx.tenantId), isActive];
  if (input.type) conditions.push(eq(accounts.type, input.type));

  const rows = await db
    .select()
    .from(accounts)
    .where(and(...conditions));

  const locale = input.locale ?? (ctx.locale as 'id' | 'en' | 'zh');
  let filtered = rows;

  if (input.query) {
    const q = input.query.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        (a.name as Record<string, string>)[locale]?.toLowerCase().includes(q),
    );
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          filtered.map((a) => ({
            id: a.id,
            code: a.code,
            name:
              (a.name as Record<string, string>)[locale] ?? (a.name as Record<string, string>).id,
            type: a.type,
            subtype: a.subtype,
            normal_balance: a.normalBalance,
            is_postable: a.isPostable,
          })),
          null,
          2,
        ),
      },
    ],
    isError: false,
  };
}

export async function createJournalHandler(
  input: z.infer<typeof CreateJournalSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.journal.create', input.location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.journal.create');

  const params: CreateJournalInput = {
    postingDate: input.posting_date,
    locationId: input.location_id,
    description: input.description,
    lines: input.lines.map((l, i) => ({
      lineNo: i + 1,
      accountId: l.account_id,
      locationId: input.location_id,
      description: l.description,
      debit: l.debit,
      credit: l.credit,
      taxCode: l.tax_code,
    })),
    referenceType: input.reference_type as 'sales' | 'purchase' | 'payroll' | 'manual' | undefined,
    referenceId: input.reference_id,
  };

  const result = await accounting.createJournal(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id,
  });

  return serializeResult(result);
}

export async function postJournalHandler(
  input: z.infer<typeof PostJournalSchema>,
  ctx: McpContext,
) {
  // Look up the journal's location for the audit context
  const [je] = await db
    .select({ locationId: journalEntries.locationId })
    .from(journalEntries)
    .where(eq(journalEntries.id, input.journal_id))
    .limit(1);

  if (!je) return mcpError('NOT_FOUND', `Journal entry ${input.journal_id} not found`);

  const params: PostJournalInput = { journalId: input.journal_id };
  const result = await accounting.postJournal(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: je.locationId,
  });

  return serializeResult(result);
}

export async function reverseJournalHandler(
  input: z.infer<typeof ReverseJournalSchema>,
  ctx: McpContext,
) {
  // Look up journal location for audit context
  const [je] = await db
    .select({ locationId: journalEntries.locationId })
    .from(journalEntries)
    .where(eq(journalEntries.id, input.journal_id))
    .limit(1);

  if (!je) return mcpError('NOT_FOUND', `Journal entry ${input.journal_id} not found`);

  const params: ReverseJournalInput = {
    journalId: input.journal_id,
    postingDate: input.posting_date,
  };
  const result = await accounting.reverseJournal(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: je.locationId,
  });

  return serializeResult(result);
}

export async function getPeriodStatusHandler(
  input: z.infer<typeof GetPeriodStatusSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.view');

  const params: GetPeriodStatusInput = { periodCode: input.period_code };
  const result = await accounting.getPeriodStatus(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: 'system',
  });

  return serializeResult(result);
}

export async function closePeriodHandler(
  input: z.infer<typeof ClosePeriodSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.period.close');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.period.close');

  const params: ClosePeriodInput = {
    periodCode: input.period_code,
    force: input.force,
  };
  const result = await accounting.closePeriod(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: 'system',
  });

  return serializeResult(result);
}

export async function listFixedAssetCategoriesHandler(
  input: z.infer<typeof ListFixedAssetCategoriesSchema>,
  ctx: McpContext,
) {
  const result = await accounting.listFixedAssetCategories({
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? ctx.locationId ?? 'system',
  });

  return serializeResult(result);
}

export async function listFixedAssetsHandler(
  input: z.infer<typeof ListFixedAssetsMcpSchema>,
  ctx: McpContext,
) {
  const params: ListFixedAssetsInput = {
    locationId: input.location_id,
    status: input.status,
    limit: input.limit,
    offset: input.offset,
  };

  const result = await accounting.listFixedAssets(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id ?? ctx.locationId ?? 'system',
  });

  return serializeResult(result);
}

export async function createFixedAssetHandler(
  input: z.infer<typeof CreateFixedAssetMcpSchema>,
  ctx: McpContext,
) {
  const params: CreateFixedAssetInput = {
    locationId: input.location_id,
    categoryId: input.category_id,
    code: input.code,
    name: input.name,
    acquisitionDate: input.acquisition_date,
    inServiceDate: input.in_service_date,
    acquisitionCost: input.acquisition_cost,
    salvageValue: input.salvage_value,
    usefulLifeMonths: input.useful_life_months,
    depreciationMethod: input.depreciation_method,
    depreciationRateBps: input.depreciation_rate_bps,
    productionCapacity: input.production_capacity,
    notes: input.notes,
  };

  const result = await accounting.createFixedAsset(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id,
  });

  return serializeResult(result);
}

export async function runFixedAssetDepreciationHandler(
  input: z.infer<typeof RunFixedAssetDepreciationMcpSchema>,
  ctx: McpContext,
) {
  const params: RunFixedAssetDepreciationInput = {
    locationId: input.location_id,
    postingDate: input.posting_date,
    assetIds: input.asset_ids,
    unitsUsedByAssetId: input.units_used_by_asset_id,
    notes: input.notes,
  };

  const result = await accounting.runFixedAssetDepreciation(params, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: input.location_id,
  });

  return serializeResult(result);
}

// --- Schemas (exported for tool registry) ---

export const ListAccountsSchema = z.object({
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'cogs', 'expense']).optional(),
  query: z.string().optional(),
});

export const CreateJournalSchema = z.object({
  posting_date: z.string(),
  location_id: z.string(),
  description: z.string().min(1),
  lines: z
    .array(
      z.object({
        account_id: z.string(),
        description: z.string().optional(),
        debit: z.string(), // bigint as string (rupiah)
        credit: z.string(),
        tax_code: z.string().optional(),
      }),
    )
    .min(2),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
});

export const PostJournalSchema = z.object({
  journal_id: z.string(),
});

export const ReverseJournalSchema = z.object({
  journal_id: z.string(),
  posting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Posting date must be YYYY-MM-DD' }),
  reason: z.string().optional(),
});

export const GetPeriodStatusSchema = z.object({
  period_code: z.string(),
});

export const ClosePeriodSchema = z.object({
  period_code: z.string(),
  force: z.boolean().optional().default(false),
});

const DepreciationMethodMcpSchema = z.enum([
  'straight_line',
  'declining_balance',
  'double_declining_balance',
  'sum_of_years_digits',
  'units_of_production',
]);

export const ListFixedAssetCategoriesSchema = z.object({
  location_id: z.string().min(1, 'location_id is required for MCP access'),
});

export const ListFixedAssetsMcpSchema = z.object({
  location_id: z.string().min(1, 'location_id is required for MCP access'),
  status: z.enum(['active', 'fully_depreciated', 'disposed']).optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

export const CreateFixedAssetMcpSchema = z.object({
  location_id: z.string().min(1),
  category_id: z.string().min(1),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(160),
  acquisition_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Acquisition date must be YYYY-MM-DD' }),
  in_service_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'In-service date must be YYYY-MM-DD' }),
  acquisition_cost: z.string().regex(/^[1-9]\d*$/, { message: 'Cost must be a rupiah string' }),
  salvage_value: z.string().regex(/^\d+$/).optional().default('0'),
  useful_life_months: z.number().int().min(1).max(600),
  depreciation_method: DepreciationMethodMcpSchema,
  depreciation_rate_bps: z.number().int().min(1).max(10000).optional(),
  production_capacity: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const RunFixedAssetDepreciationMcpSchema = z.object({
  location_id: z.string().min(1),
  posting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Posting date must be YYYY-MM-DD' }),
  asset_ids: z.array(z.string().min(1)).optional(),
  units_used_by_asset_id: z.record(z.string(), z.string().regex(/^[1-9]\d*$/)).optional(),
  notes: z.string().max(1000).optional(),
});

const LocaleNameSchema = z.object({
  id: z.string().min(1).max(160),
  en: z.string().min(1).max(160),
  zh: z.string().min(1).max(160),
});

export const UpsertAccountSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[1-9]-\d{4,6}$/),
  name: LocaleNameSchema,
  type: z.enum(['asset', 'liability', 'equity', 'income', 'cogs', 'expense']),
  subtype: z.string().min(1).max(80),
  parent_id: z.string().optional().nullable(),
  normal_balance: z.enum(['debit', 'credit']),
  is_postable: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
});

export const DeleteAccountSchema = z.object({
  id: z.string(),
  /**
   * Must equal `id` (the account being deleted). Prevents accidental
   * "delete all" loops by an LLM agent — see helpers.requireConfirmation.
   */
  confirm: z.string().min(1),
});

// --- Journal Attachments ---

export const GetJournalWithAttachmentsSchema = z.object({
  journal_id: z.string(),
});

export const ListJournalAttachmentsSchema = z.object({
  journal_entry_id: z.string(),
});

export async function getJournalWithAttachmentsHandler(
  input: z.infer<typeof GetJournalWithAttachmentsSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.view');

  const result = await accounting.getJournalWithAttachments(input.journal_id, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: 'system',
  });

  return serializeResult(result);
}

export async function listJournalAttachmentsHandler(
  input: z.infer<typeof ListJournalAttachmentsSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.view');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.view');

  const result = await accounting.listJournalAttachments(input.journal_entry_id, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    locationId: 'system',
  });

  return serializeResult(result);
}

export async function upsertAccountHandler(
  input: z.infer<typeof UpsertAccountSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.coa.manage');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.coa.manage');

  const now = new Date();
  const values = {
    code: input.code.trim().toUpperCase(),
    name: input.name,
    type: input.type,
    subtype: input.subtype.trim() || input.type,
    parentId: input.parent_id?.trim() || null,
    normalBalance: input.normal_balance,
    isPostable: input.is_postable,
    isActive: input.is_active,
    updatedAt: now,
    updatedBy: ctx.userId,
  };

  if (input.id) {
    const [before] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.id)))
      .limit(1);
    if (!before) return mcpError('NOT_FOUND', `Account ${input.id} not found`);

    await db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.id)));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'account',
      entityId: input.id,
      before: before as never,
      after: values as never,
    });
    return serializeResult({ ok: true, value: { id: input.id } });
  }

  const id = generateId();
  await db.insert(accounts).values({
    id,
    tenantId: ctx.tenantId,
    ...values,
    createdBy: ctx.userId,
  });
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'account',
    entityId: id,
    before: null,
    after: values as never,
  });
  return serializeResult({ ok: true, value: { id } });
}

export async function deleteAccountHandler(
  input: z.infer<typeof DeleteAccountSchema>,
  ctx: McpContext,
) {
  const permitted = await checkPermission(ctx, 'accounting.coa.manage');
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: accounting.coa.manage');

  const guard = requireConfirmation(input.id, input.confirm);
  if ('error' in guard) return guard.error;

  const [before] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.id, input.id),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!before) return mcpError('NOT_FOUND', `Account ${input.id} not found`);

  const [child] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.parentId, input.id),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (child) return mcpError('BUSINESS_RULE', 'Account still has child accounts.');

  const deletedAt = new Date();
  const values = {
    isActive: false,
    deletedAt,
    updatedAt: deletedAt,
    updatedBy: ctx.userId,
  };
  await db
    .update(accounts)
    .set(values)
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'account',
    entityId: input.id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), isActive: false } as never,
  });
  return serializeResult({ ok: true, value: { id: input.id } });
}

export const accountingTools = [
  { name: 'accounting.list_accounts', schema: ListAccountsSchema, handler: listAccountsHandler },
  { name: 'accounting.create_journal', schema: CreateJournalSchema, handler: createJournalHandler },
  { name: 'accounting.post_journal', schema: PostJournalSchema, handler: postJournalHandler },
  {
    name: 'accounting.reverse_journal',
    schema: ReverseJournalSchema,
    handler: reverseJournalHandler,
  },
  {
    name: 'accounting.get_period_status',
    schema: GetPeriodStatusSchema,
    handler: getPeriodStatusHandler,
  },
  { name: 'accounting.close_period', schema: ClosePeriodSchema, handler: closePeriodHandler },
  {
    name: 'accounting.list_fixed_asset_categories',
    schema: ListFixedAssetCategoriesSchema,
    handler: listFixedAssetCategoriesHandler,
    description: 'List fixed asset categories and their configured asset/depreciation accounts.',
  },
  {
    name: 'accounting.list_fixed_assets',
    schema: ListFixedAssetsMcpSchema,
    handler: listFixedAssetsHandler,
    description: 'List fixed assets with book value and depreciation status.',
  },
  {
    name: 'accounting.create_fixed_asset',
    schema: CreateFixedAssetMcpSchema,
    handler: createFixedAssetHandler,
    description:
      'Create a fixed asset through the same permission, audit, and validation engine as the UI.',
  },
  {
    name: 'accounting.run_fixed_asset_depreciation',
    schema: RunFixedAssetDepreciationMcpSchema,
    handler: runFixedAssetDepreciationHandler,
    description:
      'Run fixed asset depreciation for an outlet and create the synchronized accounting journal.',
  },
  {
    name: 'accounting.get_journal_with_attachments',
    schema: GetJournalWithAttachmentsSchema,
    handler: getJournalWithAttachmentsHandler,
  },
  {
    name: 'accounting.list_journal_attachments',
    schema: ListJournalAttachmentsSchema,
    handler: listJournalAttachmentsHandler,
  },
  {
    name: 'accounting.upsert_account',
    schema: UpsertAccountSchema,
    handler: upsertAccountHandler,
    description: 'Create or update a Chart of Accounts record through the DB permission engine.',
  },
  {
    name: 'accounting.delete_account',
    schema: DeleteAccountSchema,
    handler: deleteAccountHandler,
    description: 'Soft-delete a Chart of Accounts record when it has no child accounts.',
  },
] as const;
