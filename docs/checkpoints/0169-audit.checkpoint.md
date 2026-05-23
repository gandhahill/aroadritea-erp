# Checkpoint: T-0169 8-Dimension Systematic Codebase Audit

**Task ID**: T-0169
**Status**: 🟨 IN_PROGRESS
**Owner**: Antigravity
**Started**: 2026-05-23
**Last Updated**: 2026-05-23 14:43 WIB

## Description
Comprehensive 12-dimension audit and staged fixes of the Aroadri Tea ERP system as requested by the principal engineer.

## Plan
1. Phase 1: Functional Bug Hunting (Done: Accounting, POS. Pending: Inventory, HR, Purchasing).
2. Phase 9: Backend ↔ UI Parity (Done).
3. Phase 10: Whistleblower/Audit Trail Rules (Done).
4. Phase 11: MCP Tools Audit (Done: Decided not to expand).
5. Phase 12: SEO & UI Consolidation (Done: Migrated 90+ files to `@erp/ui` via AST script).
6. Remaining Audits: Dimensi 1 (Inventory, HR, Purchasing), Dimensi 2-8.

## Next step
Lanjutkan ke **Dimensi 1: Functional Bug Hunting (Inventory Integrity)**.
1. Baca `packages/db/src/schema/inventory.ts` dan `packages/services/src/inventory/`.
2. Cari race conditions pada Transfer, Adjustment, atau perhitungan stok BOM.
3. Buat plan bila ada celah integritas yang berpotensi menyebabkan double-deduction stok.
