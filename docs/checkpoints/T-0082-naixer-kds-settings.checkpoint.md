# T-0082 — UI Settings → Integrations → Naixer KDS

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §33.7, ADR-0007

## Goal

Admin UI for managing Naixer KDS integration mappings:
1. Product code mapping CRUD table
2. Modifier code mapping CRUD table
3. QR format config per location (form)
4. Preview QR button

## Plan

1. Server actions for CRUD (fetch, create, update, delete product/modifier codes + format config)
2. Page at `/settings/integrations/naixer/page.tsx`
3. Tabbed UI: Products | Modifiers | Format Config
4. Add sidebar nav item
5. MCP tools for kitchen (T-0082 scope)

## Files

- `apps/web/app/(dash)/settings/integrations/naixer/page.tsx`
- `apps/web/app/(dash)/settings/integrations/naixer/actions.ts`
- `apps/web/app/(dash)/settings/integrations/naixer/product-codes-table.tsx`
- `apps/web/app/(dash)/settings/integrations/naixer/modifier-codes-table.tsx`
- `apps/web/app/(dash)/settings/integrations/naixer/format-config-form.tsx`

## Next step

Create server actions + page.
