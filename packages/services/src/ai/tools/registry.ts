/**
 * AI tool registry — T-0171 (Phase 2).
 *
 * Tools are pure functions the assistant can invoke. Every tool MUST:
 *   1. Declare the permission code it requires (gated through the same
 *      `requirePermission()` engine the UI uses — never a "super-AI"
 *      bypass).
 *   2. Validate input via Zod before touching the DB.
 *   3. Return JSON-serializable output (becomes the tool message content).
 *   4. Refuse mutations unless explicitly marked write-capable (Phase 3).
 *
 * The registry exposes:
 *   - `listAvailableTools(ctx)` — tools whose permission the caller has;
 *      used to build the OpenAI-compatible `tools` array.
 *   - `executeTool(ctx, name, args)` — single entrypoint the conversation
 *      runner calls when the model returns a tool_call. It runs the
 *      permission check + audit log, then dispatches to the implementation.
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
import { GetRecentOrdersInputSchema, getRecentOrdersTool } from './get-recent-orders';
import { RequestAdminHelpInputSchema, requestAdminHelpTool } from './request-admin-help';
import { SearchCodebaseInputSchema, searchCodebaseTool } from './search-codebase';

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
  /** Whether the tool can mutate data. Phase 2 must be `false`. */
  mutates: boolean;
  /** Implementation. */
  execute: (input: TIn, ctx: AuditContext) => Promise<TOut>;
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
  // Reading source isn't sensitive data, but only assistants the operator
  // explicitly enabled can use it.
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
        description:
          'Outlet ID. Defaults to the caller\'s session location when omitted.',
      },
      limit: {
        type: 'integer',
        description: 'Cap on returned orders (1–25, default 10).',
      },
      since_minutes: {
        type: 'integer',
        description:
          'Optional age filter — only return orders newer than N minutes (e.g. 240 = last 4 hours).',
      },
    },
  },
  // Cashiers and supervisors already need pos.transact / reporting.view
  // to see orders in the UI; the same gates apply here.
  permission: 'reporting.view',
  mutates: false,
  execute: getRecentOrdersTool,
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
    const output = await tool.execute(validated.data, ctx);
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
