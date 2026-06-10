# Custom Field Engine

> Status: **operational** since T-0150. See SYSTEM-DESIGN §17.

## What it is

A database-driven extension mechanism for **adding new attributes to existing
entities without a schema migration**.

Two tables (see `packages/db/schema/customfield.ts`):

- `custom_field_definitions` — declares a field: `entityType` (e.g. `location`,
  `partner`, `employee`), `key` (e.g. `gps.lat`), `dataType`
  (`number` | `text` | `boolean` | `date`), `isRequired`, `isIndexed`,
  `displayOrder`.
- `custom_field_values` — stores actual values keyed by `(definitionId, entityId)`.

## When to use it

✅ **Yes — use a custom field when:**
- The attribute is **tenant- or outlet-specific** and not every deployment needs
  it (e.g. one franchisee tracks delivery driver SIM number, another does not).
- The attribute is **operational metadata**, not accounting-critical
  (e.g. preferred parking spot at an outlet, internal notes).
- The attribute may need to be **added or removed at runtime by an admin**.
- The attribute is **rarely queried in aggregate** — custom fields are joined
  per row, not indexed for analytics.

❌ **No — add a real column when:**
- The attribute is required for **business logic** (validation, accounting,
  tax). Real columns get type safety, constraints, and migrations.
- The attribute participates in **journal entries** or other financial pipelines.
- The attribute is **part of SOURCE-OF-TRUTH** — it's a permanent product
  decision, not a tenant customisation.
- The attribute must be **indexed for fast filter/sort** at scale (>10k rows).

## Real-world usage today

| Entity     | Field key                    | Purpose                                            |
| ---------- | ---------------------------- | -------------------------------------------------- |
| `location` | `gps.lat`, `gps.lon`         | Attendance geofencing radius (HR attendance)       |
| `location` | `gps.radius_m`               | Allowed attendance check-in radius in metres       |

The location GPS fields are seeded via `packages/db/seed/location-gps.ts` and
referenced by `packages/services/src/hr/attendance/check-in.ts` when validating
that a staff check-in originates from inside the outlet's geofence.

## How to add a new custom field

1. **Decide**: read the "When to use it" section. Real column wins if any
   business rule depends on it.
2. **In code (rare)**: insert a row into `custom_field_definitions` in a
   migration or seed. Example shape:

   ```ts
   await db.insert(customFieldDefinitions).values({
     id: generateId(),
     tenantId,
     entityType: 'location',
     key: 'parking.spots',
     name: { id: 'Slot Parkir', en: 'Parking Spots', zh: '停车位' },
     dataType: 'number',
     isRequired: false,
     isIndexed: false,
     displayOrder: 50,
   });
   ```

3. **In the UI (preferred)**: an admin opens `/settings/custom-fields`
   (T-0151 forthcoming), picks the entity type, fills the form. The field
   appears on the entity's detail page automatically.
4. **Reading values**: use `getCustomFieldValues(entityId, entityType)` from
   `@erp/services/customfield` to fetch the keyed map, falling back to
   defaults when absent.

## Why we kept it small on purpose

Every column added "just in case" makes:

- Schema diffs noisier.
- Selects wider.
- Migrations more dangerous in production.

The custom-field engine is the **escape hatch** for the genuine long tail
of per-tenant variations. Anything that's a real product decision should
be a real column. Anything that's bookkeeping or tax-related must be a
real column (SAK EP compliance + Coretax exports won't accept JSONB
attributes).

---

**See also:**

- `SYSTEM-DESIGN.md` §17 — formal spec.
- `docs/checkpoints/0150-customfield-schema-service.checkpoint.md` — original implementation notes.
- `packages/services/src/customfield/` — service entry points.
