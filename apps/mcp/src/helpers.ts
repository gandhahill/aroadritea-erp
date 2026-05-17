/**
 * MCP Helpers — response builders and serialization utilities.
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { generateId } from '@erp/shared/id';
import type { McpContext } from './context';

/** Text content block for MCP responses */
export function textContent(text: string) {
  return { type: 'text' as const, text };
}

/** Error response for a tool call */
export function mcpError(code: string, message: string) {
  return {
    content: [textContent(`[${code}] ${message}`)],
    isError: true,
  };
}

/** Success response for a tool call */
export function mcpSuccess(data: unknown) {
  return {
    content: [textContent(JSON.stringify(data, null, 2))],
    isError: false,
  };
}

/**
 * Safety guard for write/destructive MCP tools.
 *
 * Pattern: every delete / bulk-update tool MUST accept a `confirm` field
 * whose value matches the entity primary key being affected. The MCP
 * agent has to be deliberate — it cannot pass `confirm: "yes"` and wipe
 * everything. This catches accidental "delete all" loops and mass
 * mutation by a hallucinating agent.
 *
 * `confirm` is also written to audit_log via logMcpToolCall so an
 * intentional destructive action stays attributable.
 */
export function requireConfirmation(
  expected: string,
  actual: string | undefined,
): { ok: true } | { error: ReturnType<typeof mcpError> } {
  if (!actual) {
    return {
      error: mcpError(
        'CONFIRMATION_REQUIRED',
        `Destructive operation requires "confirm" field equal to "${expected}".`,
      ),
    };
  }
  if (actual !== expected) {
    return {
      error: mcpError(
        'CONFIRMATION_MISMATCH',
        `"confirm" must equal "${expected}" (got "${actual}"). Refusing to act on the wrong entity.`,
      ),
    };
  }
  return { ok: true };
}

/**
 * Cap how many rows a single MCP tool call may affect at once.
 * Prevents an LLM from being asked to "loop through all employees and
 * deactivate them". Tools must check `assertBulkLimit(items.length)`.
 */
export function assertBulkLimit(
  count: number,
  max = 25,
): { ok: true } | { error: ReturnType<typeof mcpError> } {
  if (count > max) {
    return {
      error: mcpError(
        'BULK_LIMIT_EXCEEDED',
        `This tool refuses calls touching more than ${max} rows at a time (asked for ${count}). Split the request or use the admin UI.`,
      ),
    };
  }
  return { ok: true };
}

/** Serialize a Result<T, AppError> into an MCP response */
export function serializeResult(
  result: { ok: true; value: unknown } | { ok: false; error: unknown },
): { content: { type: 'text'; text: string }[]; isError: boolean } {
  if (result.ok) {
    return mcpSuccess(result.value);
  }
  const err = result.error as { code?: string; messageKey?: string; message?: string };
  const code = err.code ?? 'INTERNAL';
  const msg = err.message ?? err.messageKey ?? 'Unknown error';
  return mcpError(code, msg);
}

/**
 * Log MCP tool calls to audit_log for traceability.
 * SD §16 — MCP tools must go through same audit engine as UI.
 * Fire-and-forget: errors in logging should never break tool execution.
 */
export async function logMcpToolCall(
  ctx: McpContext,
  toolName: string,
  input: unknown,
  isError: boolean,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'mcp_call',
      entityType: 'mcp_tool',
      entityId: toolName,
      before: null,
      after: { input, isError },
      metadata: { source: 'mcp', locale: ctx.locale, locationId: ctx.locationId ?? null },
    });
  } catch {
    // Silently fail — audit logging must not break tool execution
  }
}
