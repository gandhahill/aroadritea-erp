# T-0073 + T-0075 Checkpoint — Stock Opname Schema + Service

**Task**: Stock opname schema + service workflow
**Status**: 🟨 IN_PROGRESS
**Started**: 2026-05-10
**Owner**: Claude Opus 4.6

---

## Scope

- T-0073: Schema `stock_opname_sessions`, `stock_opname_lines`, `stock_movement_manual`
- T-0075: Service `stockOpname.create`, `submit`, `approve` (variance JE)

**Note**: T-0074 (Excel import) dan T-0076 (UI) termasuk Phase 2.5 tapi akan dibuat setelah schema + service.

---

## Step 1 — Schema (T-0073)

Files to create:
- `packages/db/schema/stock-opname.ts` — 3 tables
- `packages/db/migrations/XXXX_create_stock_opname.sql` — Drizzle migration

**Tables**:

### `stock_opname_sessions`
| Field | Tipe | Catatan |
|-------|------|--------|
| id | text PK (ULID) | |
| tenant_id | text | |
| location_id | text FK | |
| number | text UNIQUE | `SO-2026-05-0001` |
| sessionDate | date | tanggal stok opname |
| periodCode | text | linked accounting period for JE |
| status | text CHECK | `'draft' \| 'in_progress' \| 'submitted' \| 'approved' \| 'cancelled'` |
| preparedBy | text FK users | |
| preparedAt | timestamp | |
| submittedBy | text FK users | |
| submittedAt | timestamp | |
| approvedBy | text FK users | |
| approvedAt | timestamp | |
| notes | text | |
| version | int DEFAULT 1 | |
| created_at, updated_at, deleted_at, created_by, updated_by | | |

### `stock_opname_lines`
| Field | Tipe | Catatan |
|-------|------|--------|
| id | text PK (ULID) | |
| sessionId | text FK | |
| lineNo | int | |
| productId | text FK | |
| variantId | text FK nullable | |
| uom | text | |
| systemQty | numeric(14,3) | qty_on_hand dari stock_levels (snapshot saat generate) |
| countedQty | numeric(14,3) nullable | input fisik dari penghitung |
| varianceQty | numeric(14,3) nullable | countedQty - systemQty |
| varianceValue | bigint nullable | varianceQty × avgUnitCost (untuk JE) |
| isCounted | boolean DEFAULT false | sudah diinput belum |
| notes | text | |
| created_at, updated_at, deleted_at, created_by, updated_by | | |

### `stock_movement_manual`
For T-0074 (Excel import), track manual movements that come from imported Excel.
This table allows importing stock movements from Sheet 2 of the template without
going through the opname workflow. It acts as a staging table.

| Field | Tipe | Catatan |
|-------|------|--------|
| id | text PK (ULID) | |
| tenant_id | text | |
| location_id | text FK | |
| movementDate | date | |
| productId | text FK | |
| variantId | text FK nullable | |
| qtyDelta | numeric(14,3) | can be positive or negative |
| uom | text | |
| reason | text | 'manual_import' |
| reference | text | source document or notes |
| created_at, deleted_at, created_by | | |

---

## Step 2 — Migration

File: `packages/db/migrations/0001_create_stock_opname.sql`

Create the 3 tables with proper indexes.

---

## Step 3 — Number Generator

File: `packages/services/src/inventory/number-generator.ts`
Add `generateOpnameNumber(tenantId, locationId, sessionDate)` → `SO-YYYY-MM-NNNN`

---

## Step 4 — Service

File: `packages/services/src/inventory/opname-service.ts`

Workflow (SD §25.9.3):

1. **createOpnameSession(input, ctx)** → `draft`
   - Generate number
   - Snapshot `systemQty` from `stock_levels` for all active tracked products at location
   - Creates lines with systemQty = current qty_on_hand, countedQty = null

2. **recordCount(sessionId, lines[], ctx)** → `in_progress`
   - Updates countedQty + isCounted on each line
   - Calculates varianceQty = countedQty - systemQty

3. **submitOpname(sessionId, ctx)** → `submitted`
   - All lines must be isCounted = true
   - Calculate varianceValue per line = varianceQty × avgUnitCost
   - Status → submitted

4. **approveOpname(sessionId, ctx)** → `approved`
   - Requires director role (isDirector)
   - For each line with varianceQty ≠ 0:
     - Create `stock_movement` with reason='adjustment' and reference=(opname session)
     - Update `stock_levels` qty_on_hand = countedQty
   - Create balancing JE:
     - If total variance negative (shortage): DR Beban Operasional (6-1110), CR Inventory (1-1210)
     - If total variance positive (surplus): DR Inventory, CR Pendapatan Lainnya (4-2020)
     - Amount = |totalVarianceValue|
   - Audit log

5. **cancelOpname(sessionId, ctx)** → `cancelled` (only if draft/in_progress)

---

## Next step

Start with Step 1: Create `packages/db/schema/stock-opname.ts`