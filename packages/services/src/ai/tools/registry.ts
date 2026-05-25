/**
 * AI tool registry — T-0171 (Phase 2) + T-0172 (Phase 3).
 *
 * Tools are pure functions the assistant can invoke. Every tool MUST:
 *   1. Declare the permission code it requires (gated through the same
 *      `requirePermission()` engine the UI uses — never a "super-AI"
 *      bypass).
 *   2. Validate input via Zod before touching the DB.
 *   3. Return JSON-serializable output (becomes the tool message content).
 *   4. Refuse mutations directly — write-flow tools stage a row in
 *      `ai_action_drafts` and the user must click "Setujui & Posting"
 *      to call `commitDraft` (re-checks the *target* permission).
 *
 * The registry exposes:
 *   - `listAvailableTools(ctx)` — tools whose permission the caller has;
 *      used to build the OpenAI-compatible `tools` array.
 *   - `executeTool(ctx, name, args, deps?)` — single entrypoint the
 *      conversation runner calls when the model returns a tool_call.
 *      Runs the permission check + audit log, then dispatches to the
 *      implementation. `deps` carries sessionId / messageId for tools
 *      that need to associate state to the chat (drafts).
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import type { z } from 'zod';
import { can } from '../../iam';
import type { AiToolDefinition } from '../client';
import {
  CreateManualSaleDraftInputSchema,
  type CreateManualSaleDraftToolDeps,
  createManualSaleDraftTool,
} from './create-manual-sale-draft';
import { GetProductInputSchema, getProductTool } from './get-product';
import { GetRecentOrdersInputSchema, getRecentOrdersTool } from './get-recent-orders';
import { GetStockInputSchema, getStockTool } from './get-stock';
import {
  GetTodaySalesSummaryInputSchema,
  getTodaySalesSummaryTool,
} from './get-today-sales-summary';
import {
  LogComplaintDraftInputSchema,
  type LogComplaintDraftToolDeps,
  logComplaintDraftTool,
} from './log-complaint-draft';
import { OcrReceiptStrukInputSchema, ocrReceiptStrukTool } from './ocr-receipt';
import { ReadFileInputSchema, readFileTool } from './read-file';
import { RequestAdminHelpInputSchema, requestAdminHelpTool } from './request-admin-help';
import { SearchCodebaseInputSchema, searchCodebaseTool } from './search-codebase';

/**
 * Optional execution dependencies passed by the conversation runner to
 * tools that need to know which session they're running inside (e.g.
 * draft creators that persist sessionId / messageId on the draft row).
 */
export interface ToolExecutionDeps {
  sessionId?: string;
  messageId?: string;
}

export interface AiTool<TIn, TOut> {
  /** Name exposed to the model. Snake_case, no namespace dots. */
  name: string;
  /** Plain-English description of what the tool does + when to use it. */
  description: string;
  /** Zod schema for the input. Generates `parameters` JSON schema. */
  inputSchema: z.ZodType<TIn>;
  /** Plain JSON schema (parameters block). Hand-written for clarity. */
  parameters: Record<string, unknown>;
  /** Permission code required to call this tool. */
  permission: string;
  /** Whether the tool can mutate data. Draft creators are `false` —
   *  they only stage a row; the commit happens via the confirm flow. */
  mutates: boolean;
  /** Implementation. */
  execute: (input: TIn, ctx: AuditContext, deps?: ToolExecutionDeps) => Promise<TOut>;
}

// Internal-only union — registering a tool through `registerTool` is the
// only way to make it discoverable.
type AnyTool = AiTool<unknown, unknown>;

const TOOLS: Record<string, AnyTool> = {};

function registerTool<TIn, TOut>(tool: AiTool<TIn, TOut>): void {
  TOOLS[tool.name] = tool as unknown as AnyTool;
}

// ───────────────────────────────────────────────────────────────────────
// Tool registrations
// ───────────────────────────────────────────────────────────────────────

registerTool({
  name: 'request_admin_help',
  description:
    'Produce a structured admin-help chat template for the caller to forward when they hit an error or a blocked workflow. Does NOT contact the admin directly.',
  inputSchema: RequestAdminHelpInputSchema,
  parameters: {
    type: 'object',
    properties: {
      error_summary: {
        type: 'string',
        description: 'One-sentence summary of what the user was doing when the error appeared.',
      },
      observed_message: {
        type: 'string',
        description:
          'The exact toast / banner / error message the user saw (optional but strongly recommended).',
      },
      current_url: {
        type: 'string',
        description: 'Current page URL the user is on, e.g. /pos/orders.',
      },
      time_of_event: {
        type: 'string',
        description: 'When the issue happened, e.g. "tadi sekitar 14:30 WIB".',
      },
    },
    required: ['error_summary'],
  },
  permission: 'ai.assistant.use',
  mutates: false,
  execute: requestAdminHelpTool,
});

registerTool({
  name: 'search_codebase',
  description:
    'Search the source tree (allow-listed to apps/, packages/, docs/, scripts/) for a literal substring or simple regex. Returns up to 25 matches with file path, line number, and a short excerpt.',
  inputSchema: SearchCodebaseInputSchema,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text or POSIX-style regex to search for. Case-insensitive.',
      },
      file_glob: {
        type: 'string',
        description: 'Optional file extension filter, e.g. ".ts" or ".md".',
      },
      max_results: {
        type: 'integer',
        description: 'Cap on returned matches (1–25, default 10).',
      },
    },
    required: ['query'],
  },
  permission: 'ai.assistant.use',
  mutates: false,
  execute: searchCodebaseTool,
});

registerTool({
  name: 'get_recent_orders',
  description:
    'List the most recent sales orders for an outlet so the assistant can answer "what did I sell today" or help a cashier reconcile. Scoped to the caller\'s tenant and the requested location.',
  inputSchema: GetRecentOrdersInputSchema,
  parameters: {
    type: 'object',
    properties: {
      location_id: {
        type: 'string',
        description: 'Outlet ID. Defaults to the caller\'s session location when omitted.',
      },
      limit: { type: 'integer', description: 'Cap on returned orders (1–25, default 10).' },
      since_minutes: {
        type: 'integer',
        description:
          'Optional age filter — only return orders newer than N minutes (e.g. 240 = last 4 hours).',
      },
    },
  },
  permission: 'reporting.view',
  mutates: false,
  execute: getRecentOrdersTool,
});

registerTool({
  name: 'read_file',
  description:
    'Read up to 200 lines of a specific file in the repo, gated to the same allow-list as search_codebase. Use this after search_codebase to quote exact context.',
  inputSchema: ReadFileInputSchema,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Repo-relative path, e.g. "packages/services/src/pos/manual-sales.ts".',
      },
      start_line: { type: 'integer', description: 'Start line (default 1).' },
      line_count: { type: 'integer', description: 'Number of lines (1–200, default 80).' },
    },
    required: ['path'],
  },
  permission: 'ai.assistant.use',
  mutates: false,
  execute: readFileTool,
});

registerTool({
  name: 'get_product',
  description:
    'Look up a product by SKU and return its variants and prices so you can answer questions like "berapa harga T01 Large?".',
  inputSchema: GetProductInputSchema,
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Product SKU (case-sensitive).' },
    },
    required: ['code'],
  },
  permission: 'inventory.product.read',
  mutates: false,
  execute: getProductTool,
});

registerTool({
  name: 'get_stock',
  description:
    'Return current on-hand stock for a product (optionally a specific variant) at one outlet. Use this for "berapa sisa tea_leaf di Malioboro?".',
  inputSchema: GetStockInputSchema,
  parameters: {
    type: 'object',
    properties: {
      product_code: { type: 'string', description: 'Product SKU.' },
      location: {
        type: 'string',
        description: 'Outlet code OR ID. Defaults to caller\'s session location when omitted.',
      },
      variant_code: { type: 'string', description: 'Optional variant SKU.' },
    },
    required: ['product_code'],
  },
  permission: 'inventory.view',
  mutates: false,
  execute: getStockTool,
});

registerTool({
  name: 'get_today_sales_summary',
  description:
    'Daily sales summary for one outlet (gross/net/PB1/refunds/payment breakdown/top products). Defaults to today (WIB).',
  inputSchema: GetTodaySalesSummaryInputSchema,
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'YYYY-MM-DD; defaults to today.' },
      location_id: {
        type: 'string',
        description: 'Outlet ID. Defaults to caller\'s session location.',
      },
    },
  },
  permission: 'reporting.view',
  mutates: false,
  execute: getTodaySalesSummaryTool,
});

registerTool({
  name: 'create_manual_sale_draft',
  description:
    'Stage a manual-sales closing as a draft so the cashier can confirm it in the chat UI. NEVER posts directly — the user must click "Setujui & Posting", which re-checks pos.transact permission and dispatches to createManualSalesClosing.',
  inputSchema: CreateManualSaleDraftInputSchema,
  parameters: {
    type: 'object',
    properties: {
      location_id: { type: 'string', description: 'Outlet ID; defaults to session location.' },
      sales_date: { type: 'string', description: 'YYYY-MM-DD of the sales day.' },
      channel: { type: 'string', description: 'walk_in | gofood | grabfood | shopeefood | …' },
      payment_method: {
        type: 'string',
        description: 'cash | qris | bank_transfer | ewallet | …',
      },
      gross_sales: { type: 'string', description: 'Total rupiah as integer string (e.g. "320000").' },
      discount_total: { type: 'string', description: 'Optional discount rupiah integer string.' },
      transaction_count: { type: 'integer', description: 'Optional transaction count.' },
      source_reference: { type: 'string', description: 'Optional reference, e.g. receipt file.' },
      notes: { type: 'string', description: 'Operator notes / OCR caveats.' },
    },
    required: ['sales_date', 'gross_sales'],
  },
  permission: 'pos.transact',
  mutates: false,
  execute: (
    input: import('./create-manual-sale-draft').CreateManualSaleDraftInput,
    ctx: AuditContext,
    deps?: ToolExecutionDeps,
  ) => createManualSaleDraftTool(input, ctx, deps as CreateManualSaleDraftToolDeps | undefined),
});

registerTool({
  name: 'log_complaint_draft',
  description:
    'Stage a customer-complaint intake as a draft. The user must click "Setujui & Posting" to commit, which re-checks crm.logComplaint permission and writes the row via the real CRM service.',
  inputSchema: LogComplaintDraftInputSchema,
  parameters: {
    type: 'object',
    properties: {
      customer_name: { type: 'string', description: 'Nama pelanggan (opsional).' },
      customer_phone: { type: 'string', description: 'Nomor telepon (opsional, akan dienkripsi).' },
      member_id: { type: 'string', description: 'ID member jika sudah terdaftar.' },
      order_number: { type: 'string', description: 'Nomor order terkait (T01-…).' },
      occurred_at: {
        type: 'string',
        description: 'YYYY-MM-DD atau YYYY-MM-DDTHH:MM. Default: hari ini.',
      },
      category: {
        type: 'string',
        description:
          'product_quality | service | delivery | payment | hygiene | staff | other',
      },
      description: {
        type: 'string',
        description: 'Detail keluhan; 5–2000 karakter.',
      },
      priority: {
        type: 'string',
        description: 'low | medium | high | urgent (default medium).',
      },
    },
    required: ['category', 'description'],
  },
  // Mirrors the UI's "log complaint" permission so the AI can never
  // help a user file complaints they couldn't have filed manually.
  permission: 'crm.logComplaint',
  mutates: false,
  execute: (
    input: import('./log-complaint-draft').LogComplaintDraftInput,
    ctx: AuditContext,
    deps?: ToolExecutionDeps,
  ) => logComplaintDraftTool(input, ctx, deps as LogComplaintDraftToolDeps | undefined),
});

registerTool({
  name: 'ocr_receipt_struk',
  description:
    'OCR a photographed receipt printed by the legacy POS. Extracts the date / channel / payment / gross_sales / discount / transaction_count, then stages a manual-sales draft for the cashier to confirm.',
  inputSchema: OcrReceiptStrukInputSchema,
  parameters: {
    type: 'object',
    properties: {
      attachment_url: {
        type: 'string',
        description:
          'URL of an image previously uploaded via /api/uploads (area=ai-attachments).',
      },
      location_id: { type: 'string', description: 'Outlet ID; defaults to session location.' },
      channel: { type: 'string', description: 'Override channel hint.' },
      payment_method: { type: 'string', description: 'Override payment hint.' },
    },
    required: ['attachment_url'],
  },
  permission: 'pos.transact',
  mutates: false,
  execute: (
    input: import('./ocr-receipt').OcrReceiptStrukInput,
    ctx: AuditContext,
    deps?: ToolExecutionDeps,
  ) => ocrReceiptStrukTool(input, ctx, deps as CreateManualSaleDraftToolDeps | undefined),
});

// ───────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────

export async function listAvailableTools(ctx: AuditContext): Promise<AiToolDefinition[]> {
  const out: AiToolDefinition[] = [];
  for (const tool of Object.values(TOOLS)) {
    const allowed = await can(ctx.userId, tool.permission, { locationId: ctx.locationId });
    if (!allowed) continue;
    out.push({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    });
  }
  return out;
}

export interface ToolExecutionLog {
  toolName: string;
  permission: string;
  arguments: unknown;
  outcome: 'ok' | 'forbidden' | 'invalid' | 'error';
  output?: unknown;
  errorMessage?: string;
}

export async function executeTool(
  ctx: AuditContext,
  name: string,
  rawArgsJson: string,
  deps?: ToolExecutionDeps,
): Promise<Result<{ output: unknown; log: ToolExecutionLog }>> {
  const tool = TOOLS[name];
  if (!tool) {
    return err(AppError.notFound('ai.tool.unknown', { name }));
  }

  // Parse args defensively — the model sends a JSON-encoded string.
  let parsedArgs: unknown;
  try {
    parsedArgs = rawArgsJson ? JSON.parse(rawArgsJson) : {};
  } catch {
    parsedArgs = {};
  }
  const validated = tool.inputSchema.safeParse(parsedArgs);
  if (!validated.success) {
    const log: ToolExecutionLog = {
      toolName: name,
      permission: tool.permission,
      arguments: parsedArgs,
      outcome: 'invalid',
      errorMessage: validated.error.issues.map((i) => i.message).join('; '),
    };
    await writeToolAudit(ctx, log);
    return err(
      AppError.validation('ai.tool.invalidArguments', {
        tool: name,
        issues: validated.error.issues,
      }),
    );
  }

  const allowed = await can(ctx.userId, tool.permission, { locationId: ctx.locationId });
  if (!allowed) {
    const log: ToolExecutionLog = {
      toolName: name,
      permission: tool.permission,
      arguments: validated.data,
      outcome: 'forbidden',
    };
    await writeToolAudit(ctx, log);
    return err(AppError.forbidden('ai.tool.forbidden', { tool: name, permission: tool.permission }));
  }

  try {
    const output = await tool.execute(validated.data, ctx, deps);
    const log: ToolExecutionLog = {
      toolName: name,
      permission: tool.permission,
      arguments: validated.data,
      outcome: 'ok',
      output,
    };
    await writeToolAudit(ctx, log);
    return ok({ output, log });
  } catch (e) {
    const log: ToolExecutionLog = {
      toolName: name,
      permission: tool.permission,
      arguments: validated.data,
      outcome: 'error',
      errorMessage: e instanceof Error ? e.message : String(e),
    };
    await writeToolAudit(ctx, log);
    return err(AppError.internal('ai.tool.executionFailed', e));
  }
}

async function writeToolAudit(ctx: AuditContext, log: ToolExecutionLog): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'submit',
      entityType: 'ai_tool_call',
      entityId: log.toolName,
      before: null,
      after: {
        tool: log.toolName,
        permission: log.permission,
        outcome: log.outcome,
        argsPreview: JSON.stringify(log.arguments).slice(0, 400),
        outputPreview: log.output ? JSON.stringify(log.output).slice(0, 400) : null,
        errorMessage: log.errorMessage ?? null,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });
  } catch {
    // Audit write is best-effort.
  }
}

/**
 * Test-only — clears the registry between tests so registration order is
 * deterministic. Guarded to refuse running outside test/dev to avoid the
 * "operator accidentally emptied production tools" footgun.
 */
export function _resetToolsForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('_resetToolsForTests cannot run in production');
  }
  for (const key of Object.keys(TOOLS)) delete TOOLS[key];
}
