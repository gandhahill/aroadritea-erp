/**
 * Custom Fields Schema — SD §9.9, §17
 *
 * Tables:
 * - custom_field_definitions — field templates per entity_type
 * - custom_field_values      — typed values stored per entity
 *
 * Prohibition: do NOT use EAV for core data (money, accounting, stock).
 * Custom fields are ONLY for non-core business metadata.
 */

import { index, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { boolean, integer } from 'drizzle-orm/pg-core';
import { pk, tenantCol, auditCols } from './common';

// ─── custom_field_definitions ───────────────────────────────────────────────

/**
 * Field template registry.
 * Each row = one custom field definition, scoped to entity_type.
 * Keys are snake_case and unique per (tenant_id, entity_type).
 * SD §17
 */
export const customFieldDefinitions = pgTable('custom_field_definitions', {
  ...pk,
  ...tenantCol,

  // Which entity type this field applies to
  entityType: text('entity_type').notNull(),
  // 'product' | 'customer' | 'employee' | 'journal_entry' | 'purchase_order' | ...

  // Field identity
  key: text('key').notNull(), // snake_case, unique per entityType
  name: jsonb('name').notNull().default({ id: '', en: '', zh: '' }), // LocaleString

  // Type system
  dataType: text('data_type').notNull(),
  // 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference'
  enumOptions: jsonb('enum_options'), // [{value, label}] for enum type
  refEntityType: text('ref_entity_type'), // target entity_type for reference type

  // Validation
  isRequired: boolean('is_required').notNull().default(false),
  validationRegex: text('validation_regex'), // JS regex pattern string

  // Display
  isIndexed: boolean('is_indexed').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),

  ...auditCols,
}, (t) => [
  // Unique key per (tenant, entity_type)
  index('cfd_entity_type_idx').on(t.tenantId, t.entityType),
  index('cfd_key_unique_idx').on(t.tenantId, t.entityType, t.key),
]);

// ─── custom_field_values ─────────────────────────────────────────────────────

/**
 * Typed value storage for custom fields.
 * Composite PK on (definition_id, entity_id).
 * Value stored as JSONB — type coercion on read.
 * SD §17.2
 */
export const customFieldValues = pgTable('custom_field_values', {
  definitionId: text('definition_id').notNull(), // FK to custom_field_definitions
  entityId: text('entity_id').notNull(), // ID of the entity this value belongs to

  // The actual value — JSONB for maximum flexibility
  value: jsonb('value'),

  ...auditCols,
}, (t) => [
  // Composite PK
  primaryKey({ columns: [t.definitionId, t.entityId] }),
  // Index for entity lookups
  index('cfv_entity_idx').on(t.entityId),
]);