/**
 * Workflow / Approval Schema — SD §9.10, §18
 *
 * Tables:
 * - workflow_definitions — approval rule templates per entity_type
 * - workflow_instances  — running approval instances
 * - workflow_steps      — individual approval steps within an instance
 */

import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { pk, tenantCol, auditCols } from './common';

// ─── workflow_definitions ─────────────────────────────────────────────────────

/**
 * Approval workflow template.
 * Each definition = one approval chain per entity_type.
 * Conditions in `condition_json` are evaluated against entity data to decide
 * whether this workflow applies.
 * Steps in `steps_json` define the sequential approval chain.
 * SD §18
 */
export const workflowDefinitions = pgTable('workflow_definitions', {
  ...pk,
  ...tenantCol,

  name: jsonb('name').notNull().default({ id: '', en: '', zh: '' }), // LocaleString
  description: text('description'),

  // Which entity type triggers this workflow
  entityType: text('entity_type').notNull(),
  // 'purchase_order' | 'journal_entry_manual' | 'leave_request' | 'stock_adjustment' | ...

  // Is this the default / active workflow for this entity type?
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0), // higher = evaluated first

  // Condition: JSON array of conditions to evaluate
  // e.g. [{ field: 'grandTotal', op: 'gt', value: '5000000' }]
  // Operators: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'
  conditionJson: jsonb('condition_json'),

  // Steps: JSON array of approval steps
  // e.g. [{ stepOrder: 1, approverRole: 'store_manager' }, { stepOrder: 2, approverRole: 'director' }]
  stepsJson: jsonb('steps_json').notNull(),

  ...auditCols,
}, (t) => [
  index('wfd_entity_type_idx').on(t.tenantId, t.entityType, t.isActive),
]);

// ─── workflow_instances ───────────────────────────────────────────────────────

/**
 * A running (or completed) approval instance.
 * Created when an entity triggers a workflow definition.
 * Status: 'pending' | 'approved' | 'rejected' | 'cancelled'
 * SD §18.2
 */
export const workflowInstances = pgTable('workflow_instances', {
  ...pk,
  ...tenantCol,

  // Reference to the workflow template
  definitionId: text('definition_id').notNull(), // FK workflow_definitions

  // Which entity this instance is approving
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(), // e.g. purchase_order.id
  entitySummary: text('entity_summary'), // human-readable summary of the entity

  // Current state
  status: text('status').notNull().default('pending'),
  // 'pending' | 'approved' | 'rejected' | 'cancelled'

  // Current step index (0-based, into stepsJson array)
  currentStepIndex: integer('current_step_index').notNull().default(0),

  // Triggered by
  triggeredBy: text('triggered_by').notNull(), // user ID who triggered
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),

  // Resolution
  resolvedBy: text('resolved_by'), // user who approved/rejected
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),

  ...auditCols,
}, (t) => [
  index('wfi_entity_idx').on(t.entityType, t.entityId),
  index('wfi_status_idx').on(t.tenantId, t.status),
  index('wfi_definition_idx').on(t.definitionId),
]);

// ─── workflow_steps ───────────────────────────────────────────────────────────

/**
 * Individual approval steps within an instance.
 * Each step represents one approver's decision.
 * SD §18.2
 */
export const workflowSteps = pgTable('workflow_steps', {
  ...pk,
  ...tenantCol,

  instanceId: text('instance_id').notNull(), // FK workflow_instances

  // Step metadata (copied from definition at instance creation)
  stepOrder: integer('step_order').notNull(),
  approverRole: text('approver_role').notNull(), // e.g. 'store_manager', 'director'

  // Status
  status: text('status').notNull().default('pending'),
  // 'pending' | 'approved' | 'rejected' | 'skipped'

  // Decision
  decidedBy: text('decided_by'), // user ID who acted
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  notes: text('notes'),

  ...auditCols,
}, (t) => [
  index('wfs_instance_idx').on(t.instanceId),
  index('wfs_status_idx').on(t.status),
]);