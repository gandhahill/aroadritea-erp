/**
 * MCP Helpers — response builders and serialization utilities.
 */

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
