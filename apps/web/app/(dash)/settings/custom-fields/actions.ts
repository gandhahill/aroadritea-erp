/**
 * Custom Fields Server Actions — SD §9.9, §17
 * CRUD for custom field definitions and values.
 *
 * Security: AuditContext is derived server-side from the active session
 * on every action. The previous signature accepted `ctx: AuditContext`
 * from the client which was a textbook IDOR / cross-tenant data leak —
 * any logged-in user could spoof `userId`, `tenantId`, or `locationId`.
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { customFieldDefinitions, customFieldValues } from '@erp/db/schema/customfield';
import {
  createDefinition,
  deleteDefinition,
  updateDefinition,
} from '@erp/services/customfield';
import type { DataType } from '@erp/services/customfield';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

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

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return null;
  return {
    userId,
    tenantId,
    locationId: String(user.locationId ?? ''),
  };
}

/**
 * Fetch all custom field definitions for the current tenant (optionally
 * filter by entityType). Tenant is derived from session — clients cannot
 * request another tenant's fields.
 */
export async function fetchCustomFields(entityType?: string): Promise<CustomFieldItem[]> {
  const ctx = await resolveCtx();
  if (!ctx) return [];

  const conditions = [eq(customFieldDefinitions.tenantId, ctx.tenantId)];
  if (entityType) conditions.push(eq(customFieldDefinitions.entityType, entityType));

  const rows = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(...conditions))
    .orderBy(customFieldDefinitions.entityType, customFieldDefinitions.displayOrder);

  return rows as unknown as CustomFieldItem[];
}

/**
 * Create a new custom field definition. Permission is enforced inside
 * the service via `settings.manage`.
 */
export async function serverCreateCustomField(input: {
  entityType: string;
  key: string;
  name: Record<string, string>;
  dataType: DataType;
  enumOptions?: Array<{ value: string; label: string }>;
  refEntityType?: string;
  isRequired?: boolean;
  validationRegex?: string;
  displayOrder?: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { success: false, error: 'unauthenticated' };

  const result = await createDefinition(input, ctx);
  if (!result.ok) {
    return { success: false, error: result.error.messageKey ?? String(result.error) };
  }
  revalidatePath('/settings/custom-fields');
  return { success: true, id: result.value.id };
}

/**
 * Update a custom field definition.
 */
export async function serverUpdateCustomField(input: {
  id: string;
  name?: Record<string, string>;
  enumOptions?: Array<{ value: string; label: string }>;
  isRequired?: boolean;
  validationRegex?: string;
  displayOrder?: number;
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { success: false, error: 'unauthenticated' };

  const result = await updateDefinition(input, ctx);
  if (!result.ok) {
    return { success: false, error: result.error.messageKey ?? String(result.error) };
  }
  revalidatePath('/settings/custom-fields');
  return { success: true };
}

/**
 * Delete (soft) a custom field definition and its values.
 */
export async function serverDeleteCustomField(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { success: false, error: 'unauthenticated' };

  const result = await deleteDefinition(id, ctx);
  if (!result.ok) {
    return { success: false, error: result.error.messageKey ?? String(result.error) };
  }
  revalidatePath('/settings/custom-fields');
  return { success: true };
}

/**
 * Get custom field values for an entity within the current tenant.
 */
export async function fetchCustomFieldValues(
  entityId: string,
): Promise<Record<string, unknown>[]> {
  const ctx = await resolveCtx();
  if (!ctx) return [];

  const rows = await db
    .select({
      definitionId: customFieldValues.definitionId,
      value: customFieldValues.value,
    })
    .from(customFieldValues)
    .innerJoin(
      customFieldDefinitions,
      eq(customFieldDefinitions.id, customFieldValues.definitionId),
    )
    .where(
      and(
        eq(customFieldValues.entityId, entityId),
        eq(customFieldDefinitions.tenantId, ctx.tenantId),
      ),
    );

  return rows as Record<string, unknown>[];
}
