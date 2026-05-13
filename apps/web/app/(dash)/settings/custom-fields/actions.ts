/**
 * Custom Fields Server Actions — SD §9.9, §17
 * CRUD for custom field definitions and values.
 */

'use server';

import { db, eq, and, desc } from '@erp/db';
import { customFieldDefinitions, customFieldValues } from '@erp/db/schema/customfield';
import { createDefinition, listDefinitions, updateDefinition, deleteDefinition } from '@erp/services/customfield';
import type { AuditContext } from '@erp/shared/types';
import type { DataType } from '@erp/services/customfield';

export interface CustomFieldItem {
  id: string;
  entityType: string;
  key: string;
  name: Record<string, string>;
  dataType: string;
  enumOptions: Array<{ value: string; label: string }> | null;
  refEntityType: string | null;
  isRequired: boolean;
  validationRegex: string | null;
  isIndexed: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetch all custom field definitions for a tenant (optionally filter by entityType).
 */
export async function fetchCustomFields(
  tenantId: string,
  entityType?: string,
): Promise<CustomFieldItem[]> {
  const conditions = [eq(customFieldDefinitions.tenantId, tenantId)];
  if (entityType) conditions.push(eq(customFieldDefinitions.entityType, entityType));

  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(...conditions))
    .orderBy(customFieldDefinitions.entityType, customFieldDefinitions.displayOrder);

  return rows as unknown as CustomFieldItem[];
}

/**
 * Create a new custom field definition.
 */
export async function serverCreateCustomField(
  input: {
    entityType: string;
    key: string;
    name: Record<string, string>;
    dataType: DataType;
    enumOptions?: Array<{ value: string; label: string }>;
    refEntityType?: string;
    isRequired?: boolean;
    validationRegex?: string;
    displayOrder?: number;
  },
  ctx: AuditContext,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const result = await createDefinition(input, ctx);
  if (!result.ok) {
    return { success: false, error: String(result.error) };
  }
  return { success: true, id: result.value.id };
}

/**
 * Update a custom field definition.
 */
export async function serverUpdateCustomField(
  input: {
    id: string;
    name?: Record<string, string>;
    enumOptions?: Array<{ value: string; label: string }>;
    isRequired?: boolean;
    validationRegex?: string;
    displayOrder?: number;
  },
  ctx: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  const result = await updateDefinition(input, ctx);
  if (!result.ok) {
    return { success: false, error: String(result.error) };
  }
  return { success: true };
}

/**
 * Delete a custom field definition and its values.
 */
export async function serverDeleteCustomField(
  id: string,
  ctx: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteDefinition(id, ctx);
  if (!result.ok) {
    return { success: false, error: String(result.error) };
  }
  return { success: true };
}

/**
 * Get custom field values for an entity.
 */
export async function fetchCustomFieldValues(
  tenantId: string,
  entityId: string,
): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select({
      definitionId: customFieldValues.definitionId,
      value: customFieldValues.value,
    })
    .from(customFieldValues)
    .where(eq(customFieldValues.entityId, entityId));

  return rows as Record<string, unknown>[];
}