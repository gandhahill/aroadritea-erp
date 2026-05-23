# Architecture Summary: Aroadri Tea ERP

This document outlines the core architectural rules, boundaries, and security constraints for the Aroadri Tea ERP, derived from the Source of Truth, System Design, and Architecture Decision Records (ADRs).

## 1. High-Level Architecture & Boundaries
*   **Resource Constraints**: The system runs on a strict 1 vCPU, 2 GB RAM, and 60 GB Disk VPS. High-memory dependencies like Prisma, Bun, or Odoo/ERPNext are strictly forbidden. The DB is offloaded to a managed PostgreSQL (Neon).
*   **Modular Monolith (4 Apps)**:
    *   `apps/site`: Public website & member portal (`aroadritea.com`). Only has restricted, whitelisted access to services (e.g., read-only inventory, member auth).
    *   `apps/web`: Internal ERP UI (`erp.aroadritea.com`). Requires RBAC login. POS operates as a PWA here.
    *   `apps/mcp`: Local AI interaction layer (`/mcp`).
    *   `apps/worker`: Cron and queue jobs (Node + pg-boss).
*   **Service Layer Boundary**: All business logic resides in `packages/services/*` returning `Result<T, AppError>`. No HTTP/Next.js logic in services. Cross-app direct communication is forbidden; all routing goes through the services/DB layer.

## 2. Security & Compliance Constraints
*   **Military-Level Security**:
    *   **Data-at-Rest**: PII (phone, email, KTP) must be encrypted at rest using `pgcrypto` / AES-256-GCM.
    *   **Anti-Abuse**: Rate limiting (e.g., max 5 login fails/15 mins) and Cloudflare Turnstile Captcha on all public forms/login.
*   **Authentication Separation**: `apps/site` (Member auth) and `apps/web` (Staff auth) have distinct sessions and cookies (`__Host-member-session` vs `__Host-session`) powered by `better-auth`. Members authenticate via Email + OTP.
*   **Immutable Audit Log**: *Every* data mutation must write to `audit_log` (append-only). No silent updates.
*   **Idempotency**: All mutation APIs (REST/MCP) must accept and handle an `Idempotency-Key` (cached for 24 hours) to prevent duplicate actions.

## 3. Permission Engine Rules (RBAC)
*   **Database-Driven**: Roles and permissions are stored in the database (`permissions`, `roles`, `role_permissions`). 
*   **No Hardcoded Roles**: Code like `if (user.role === 'admin')` is strictly forbidden. Instead, use atomic permission checks: `if (await iam.can(user, 'accounting.journal.post', { locationId }))`.
*   **Location Scoping**: Permissions can be scoped to a specific `location_id`. If `location_id` is NULL, the role is global.
*   **MCP Parity**: Every MCP tool must enforce the exact same permission checks as the corresponding UI action.

## 4. Accounting & Tax Rules
*   **Strict Double-Entry**: Total debit must exactly equal total credit for every journal entry. Server-side validation will reject any unbalanced journal.
*   **Money Data Type**: Currency must be stored as `bigint` (no decimals for IDR). Avoid `float` or `decimal`.
*   **Multi-Location Dimension**: Every transactional document and every `journal_line` MUST include a `location_id`. Reports (Balance Sheet, P&L, etc.) must filterable by location.
*   **Tax Engine (Opt-In PPN)**:
    *   **PB1 (10% Inclusive)**: Default for retail F&B sales. Automatically backed out of the gross price (`tax_base = gross / 1.10`).
    *   **PPN Masukan (Vat In)**: Always active for purchases from PKP suppliers.
    *   **PPN Keluaran (Vat Out)**: Engine is "opt-in" ready via `tax_rules`, but is **default OFF** for retail to prevent double taxation with PB1. 

## 5. Offline-First POS (PWA) Rules
*   **Resilience (RPO=0, RTO<=2m)**: The POS must continue to function even if the internet drops or the server is down. 
*   **PWA Sandbox**: Uses Serwist (Service Worker) and IndexedDB (`aroadri-pos`) to cache master data (products, prices, taxes) and store a local outbox (`pending_orders`).
*   **Append-Only Sync**: When online, the outbox syncs in the background using `client_order_uuid` as the idempotency key. The server generates the final `placed_at` timestamp.
*   **Demo Mode Isolation**: POS Demo mode uses a completely separate IndexedDB sandbox (`aroadri-pos-demo`). It never syncs with the server and prefixes QR codes with `DEMO-` to avoid cross-contamination with the Naixer KDS integration.
