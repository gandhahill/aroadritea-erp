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
