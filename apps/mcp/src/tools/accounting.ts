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

import { db } from '@erp/db';
import { accounts, journalEntries } from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import { isActive } from '@erp/db/schema/common';
import * as accounting from '@erp/services/accounting';
import type {
  ClosePeriodInput,
  CreateJournalInput,
  GetPeriodStatusInput,
  PostJournalInput,
  ReverseJournalInput,
} from '@erp/services/accounting';
import { type PermissionContext, can } from '@erp/services/iam';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, serializeResult } from '../helpers';

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
              (a.name as Record<string, string>)[locale] ??
              (a.name as Record<string, string>)['id'],
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
    name: 'accounting.get_journal_with_attachments',
    schema: GetJournalWithAttachmentsSchema,
    handler: getJournalWithAttachmentsHandler,
  },
  {
    name: 'accounting.list_journal_attachments',
    schema: ListJournalAttachmentsSchema,
    handler: listJournalAttachmentsHandler,
  },
] as const;
