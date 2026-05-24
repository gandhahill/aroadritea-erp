/**
 * @erp/services/ai — AI assistant module (User Req 1, ADR-0013).
 *
 * Phase 1 (chat foundation): provider client, session CRUD, message
 * persistence, audit trail, rate limit, conversation runner.
 *
 * Phase 2/3 will add tool calling, OCR vision, web search.
 */

export * from './client';
export * from './session';
export * from './conversation';
