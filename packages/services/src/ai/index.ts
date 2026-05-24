/**
 * @erp/services/ai — AI assistant module (User Req 1, ADR-0013).
 *
 * Phase 1 (chat foundation): provider client, session CRUD, message
 * persistence, audit trail, rate limit, conversation runner.
 *
 * Phase 2 (T-0171): tool calling with RBAC-gated registry, model v4
 * defaults, vision-ready content type, reasoning-mode handling.
 *
 * Phase 3 (backlog): receipt-photo OCR draft → confirm → commit, write
 * tools (create manual sale, log complaint, create correspondence).
 */

export * from './client';
export * from './session';
export * from './conversation';
export {
  listAvailableTools,
  executeTool,
  _resetToolsForTests,
} from './tools/registry';
export type { ToolExecutionLog, AiTool } from './tools/registry';
