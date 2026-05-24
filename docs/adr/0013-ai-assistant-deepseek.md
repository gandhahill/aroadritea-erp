# ADR 0013 — AI Assistant via DeepSeek (chat, RBAC-gated tools, OCR)

- **Status**: Accepted
- **Date**: 2026-05-24
- **Decision driver**: User Req 1 (2026-05-24) — owner wants every employee
  to have an in-product AI assistant that knows the codebase, can answer
  workflow questions, can OCR old-POS receipts and turn them into manual
  sales entries, and can flag errors to admins, all while respecting the
  caller's RBAC.

## Context

The ERP is solo-operated and used by non-technical retail staff at three
outlets in Yogyakarta. Pain points the owner observed during a demo:

1. Cashiers spend extra minutes typing yesterday's sales from a paper
   receipt printed by the legacy POS at end-of-shift / closing.
2. Employees stop using new modules because they can't find the right
   page or are unsure of the workflow.
3. When an error message appears, the employee either ignores it or
   sends a vague WhatsApp screenshot to the owner; root-cause hand-off
   takes hours.

A guided AI assistant addresses all three.

## Decision

1. **Provider — DeepSeek (v4 "pro thinking" tier)**. Reasoning:
   - Native multilingual (ID/EN/ZH) which matches the dashboard.
   - Vision support (for OCRing receipt photos).
   - Web-search add-on works for "look up documentation" queries.
   - Cheaper per-million-tokens than OpenAI / Anthropic at the volumes
     a single bubble-tea shop will hit.
   - Self-hostable fall-back exists if cost balloons; the rest of the
     architecture only depends on the OpenAI-compatible chat-completions
     contract, so swapping is feasible.
   The model is configurable in DB (`cms_settings.ai.provider.config`),
   not hard-coded, so we can move to another OpenAI-compatible vendor
   without a redeploy.
2. **Identity — every request runs under the caller's session**. The
   server attaches the caller's userId, tenantId, locationId, and role
   set to the assistant context. Tools the assistant invokes are
   funneled through the same `requirePermission()` engine the UI uses.
   "Super-AI" tokens are explicitly forbidden.
3. **Codebase access — read-only, allow-listed**. The assistant can
   call a `search_codebase(pattern)` and `read_file(path)` pair that
   are restricted to the repo root and reject any path containing
   `..`, `node_modules`, `.env*`, `.git`, `storage/`, or `apps/web/.next`.
   The assistant CANNOT edit code (no `write_file` tool). It can suggest
   diffs back to the user, who can apply them via normal git tooling.
4. **Mutations require explicit confirmation**. Any tool that writes to
   the database (manual sales, complaint logging, correspondence,
   inventory adjust) emits a structured "draft" payload that the UI
   renders for the caller to approve before the second call commits.
   The caller's permission is re-checked at commit time so a privilege
   drop between draft and commit is honored.
5. **Audit trail — non-optional**. Every assistant message, every tool
   call, every confirmation/refusal writes to `audit_log` via the same
   `auditRecord()` engine the rest of the system uses. Admins with
   `ai.assistant.admin` can list every conversation across users; non-
   admins can only see their own sessions.
6. **Sessions persist**. Users can open multiple parallel chats (one per
   workflow they're juggling). Sessions can be archived but not hard
   deleted from the UI — a soft-delete column keeps the audit trail
   intact.
7. **Receipt OCR**. The "import POS-lama struk" use case attaches an
   image to the message; the assistant parses it via the vision model,
   produces a structured manual-sales draft, and asks the cashier to
   confirm before posting through the existing manual-sales service.
8. **Web search**. The DeepSeek built-in web tool is enabled only for
   sessions where the user explicitly toggles "izinkan pencarian web".
   Default off — outlet staff usually don't need it and it costs more.

## Consequences

- We add a new `packages/services/src/ai/` module, the
  `ai_chat_sessions`, `ai_chat_messages`, and `ai_chat_attachments`
  tables (migration 0031), and two permission codes
  (`ai.assistant.use`, `ai.assistant.admin` — already seeded in
  0029 batch).
- The assistant's tool surface IS the audit risk surface. Every new tool
  added later must explicitly state its required permission, the
  confirmation requirement, and the affected rows-per-call cap (see
  MCP §B11 lessons learned).
- DeepSeek API key lives in `.env` as `DEEPSEEK_API_KEY` and is never
  shipped to the browser. Fallback `AI_ASSISTANT_ENABLED=false`
  disables the entire feature gracefully (the UI hides the chat widget).
- Cost cap: requests are rate-limited per user (DB-driven setting,
  default 30 messages / hour / user). Exceeding the cap returns a
  friendly error rather than billing surprises.

## Out of scope (Phase 1)

- Auto-applied code edits (the AI may NEVER `git push`).
- Fine-tuning / RAG embeddings of the codebase — `search_codebase` is
  literal grep, good enough for a small repo.
- Multi-tenant chat sharing (the assistant is single-tenant per
  Aroadri's deployment).

## Implementation phases

Phase 1 (this commit): schema, settings, plain chat, audit trail, UI
chat panel, admin viewer.
Phase 2: read-only tools (search code, read file, list orders, get
stock, request_admin_help template).
Phase 3: write tools with confirm-then-commit (manual sales draft from
OCR, log complaint, create correspondence) + vision OCR + web search
opt-in.
