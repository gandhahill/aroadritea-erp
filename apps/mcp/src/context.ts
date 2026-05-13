/**
 * MCP Context — user context resolved from API token.
 * Passed to every tool handler.
 */

export interface McpContext {
  userId: string;
  tenantId: string;
  locale: string;
  locationId?: string;
}

export function createMcpContext(userId: string, tenantId: string, locale = 'id', locationId?: string): McpContext {
  return { userId, tenantId, locale, locationId };
}
