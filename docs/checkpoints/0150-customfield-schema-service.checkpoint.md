# Checkpoint: T-0150 — Custom Fields schema + service

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-13 23:05
- **Last updated**: 2026-05-13 23:05
- **Status**: 🟨 IN_PROGRESS
- **Phase**: 6
- **Branch**: master (direct)

## Goal

Implement Phase 6 — Custom Fields schema/service (T-0150/151) + Workflow schema/service (T-0153/154). Spec: SYSTEM-DESIGN §9.9, §17, §9.10, §18.

**Definition of Done (T-0150):**
- [ ] `custom_field_definitions` table with data_type enum (string/number/boolean/date/enum/reference)
- [ ] `custom_field_values` table with composite PK (definition_id, entity_id)
- [ ] Exports from `packages/db/index.ts`
- [ ] typecheck passes all apps

**Definition of Done (T-0151):**
- [ ] `customfield.createDefinition`, `updateDefinition`, `listDefinitions`, `deleteDefinition`
- [ ] `customfield.setValue`, `getValue`, `getValuesByEntity`, `deleteValue`
- [ ] `customfield.search` (entityType + op eq/in/contains)
- [ ] typecheck passes

**Definition of Done (T-0153):**
- [ ] `workflow_definitions` table
- [ ] `workflow_instances` table
- [ ] `workflow_steps` table
- [ ] Exports from `packages/db/index.ts`

**Definition of Done (T-0154):**
- [ ] `workflow.evaluate` — evaluate conditions against entity data
- [ ] `workflow.createInstance` — start approval workflow
- [ ] `workflow.approveStep` — approve a step
- [ ] `workflow.rejectStep` — reject/terminate workflow
- [ ] typecheck passes

## Plan

1. [ ] Create `packages/db/schema/customfield.ts` (definitions + values tables)
2. [ ] Export from `packages/db/index.ts`
3. [ ] Create `packages/services/src/customfield/index.ts`
4. [ ] Create `packages/db/schema/workflow.ts` (definitions + instances + steps)
5. [ ] Export from `packages/db/index.ts`
6. [ ] Create `packages/services/src/workflow/index.ts`
7. [ ] typecheck all apps

## Next step

Create `packages/db/schema/customfield.ts` with:
- `custom_field_definitions`: id, tenantId, entityType, key, name (jsonb LocaleString), dataType, enumOptions (jsonb nullable), refEntityType, isRequired, isIndexed, validationRegex, displayOrder, auditCols
- `custom_field_values`: definitionId (FK), entityId, value (jsonb), composite PK on (definitionId, entityId)