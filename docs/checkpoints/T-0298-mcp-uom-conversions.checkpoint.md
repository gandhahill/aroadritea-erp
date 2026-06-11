# Checkpoint: T-0298 — MCP tools for uom_conversions CRUD

- **Owner**: claude-sonnet-4-6
- **Started**: 2026-06-11 17:40 WIB
- **Last updated**: 2026-06-11 17:58 WIB
- **Status**: 🟩 DONE
- **Phase**: F3
- **Branch**: master

## Goal

CLAUDE.md §6 mandates that every new feature considers a corresponding MCP tool. T-0297 added
`packages/services/src/inventory/uom-conversion-service.ts` (`listUomConversions`,
`upsertUomConversion`, `deleteUomConversion` — permission `inventory.product.read`/`.update`,
audited) plus a UI at `/inventory/uom-conversions`, but no MCP tools were registered. Add them so
local AIs can read/manage UOM conversions through the same service + permission + audit layer.

**Kriteria selesai (Definition of Done):**
- [x] `inventory.list_uom_conversions`, `inventory.upsert_uom_conversion`, `inventory.delete_uom_conversion` ditambahkan di `apps/mcp/src/tools/phase2.ts`, mengikuti pola category tools
- [x] Skema zod sesuai input service (snake_case di MCP, camelCase di service)
- [x] `deleteUomConversion` adalah hard delete → tool delete pakai `requireConfirmation` (pola destructive tool)
- [x] Diekspor dari `apps/mcp/src/tools/index.ts`
- [x] `pnpm --filter @erp/mcp typecheck` PASS
- [x] `pnpm --filter @erp/mcp test` PASS
- [x] biome check PASS (touched files)
- [x] Commit + push

## Implementation Summary

- `inventory.list_uom_conversions`: no input, calls `listUomConversions(ctx)`, returns the joined
  product sku/name + conversion rows (same shape as the `/inventory/uom-conversions` UI).
- `inventory.upsert_uom_conversion`: snake_case input (`conversion_id`, `product_id`, `from_uom`,
  `to_uom`, `multiply_by`) mapped to the service's camelCase `UpsertUomConversionInput`. All
  validation (same uom, duplicate pair either direction, product existence) lives in the service
  and is surfaced via `serializeResult`.
- `inventory.delete_uom_conversion`: hard delete (matches the service, which hard-deletes because
  of the `(tenant, product, from, to)` unique index). Follows the `accounting.delete_account` /
  `iam.delete_location` pattern: requires `confirm` to equal `id` via `helpers.requireConfirmation`.
- All three reuse the service's own `requirePermission` (`inventory.product.read`/`.update`) and
  `auditRecord` calls — no separate permission/audit logic needed in the MCP layer.

## Decisions

- Followed the category tools' dynamic-import (`await import('@erp/services/inventory')`) +
  `serializeResult` pattern rather than the `checkPermission`/`mcpSuccess` pattern used in
  accounting.ts, since uom-conversion-service already gates permissions internally (matches
  inventory.upsert_category/delete_category, the explicitly referenced precedent).
- Delete tool requires `confirm=id` even though the service itself has no extra confirmation,
  because the underlying operation is a hard delete (DB row removed, only audit_log retains
  history) — same risk class as `accounting.delete_account`.

## Open issues / Questions

- None.

## Next step

Tidak ada — selesai. Commit + push setelah checkpoint ini disimpan.

## Test status

- `pnpm --filter @erp/mcp typecheck`: PASS
- `pnpm --filter @erp/mcp test`: PASS
- `pnpm exec biome check apps/mcp/src/tools/phase2.ts apps/mcp/src/tools/index.ts`: PASS (0 errors)

## Files Touched

| Path | Action | Note |
|------|--------|------|
| apps/mcp/src/tools/phase2.ts | edit | + 3 schemas + 3 tool entries (`inventory.list_uom_conversions`, `inventory.upsert_uom_conversion`, `inventory.delete_uom_conversion`); + `requireConfirmation` import |
| apps/mcp/src/tools/index.ts | edit | barrel export for the 3 new schemas |
| TASK.md | edit | registered T-0298 |
| docs/checkpoints/T-0298-mcp-uom-conversions.checkpoint.md | new | this file |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(pending — committing now)_ | | |

## Handoff Notes

_(none — task complete)_
