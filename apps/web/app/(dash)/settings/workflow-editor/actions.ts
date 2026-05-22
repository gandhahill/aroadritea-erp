/**
 * Workflow Editor Server Actions — SD §9.10, §18
 * CRUD for workflow definitions + steps.
 */

'use server';

import { and, db, desc, eq } from '@erp/db';
import { workflowDefinitions } from '@erp/db/schema/workflow';
import { auditLog } from '@erp/db/schema/audit';
import type { AuditContext } from '@erp/shared/types';

export interface WorkflowDefinitionItem {
  id: string;
  name: Record<string, string>;
  description: string | null;
  entityType: string;
  isActive: boolean;
  priority: number;
  conditionJson: Array<{ field: string; op: string; value: string | number | boolean }> | null;
  stepsJson: Array<{ stepOrder: number; approverRole: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepInput {
  stepOrder: number;
  approverRole: string;
}

export interface ConditionInput {
  field: string;
  op: string;
  value: string | number | boolean;
}

import { getSession } from '@/lib/auth';

/**
 * Fetch all workflow definitions for a tenant.
 */
export async function fetchWorkflowDefinitions(
  tenantIdRaw?: string,
  entityType?: string,
): Promise<WorkflowDefinitionItem[]> {
  const session = await getSession();
  if (!session?.user) return [];
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');

  const conditions = [eq(workflowDefinitions.tenantId, tenantId)];
  if (entityType) conditions.push(eq(workflowDefinitions.entityType, entityType));

  const rows = await db
    .select()
    .from(workflowDefinitions)
    .where(and(...conditions))
    .orderBy(desc(workflowDefinitions.priority), workflowDefinitions.createdAt);

  return rows as unknown as WorkflowDefinitionItem[];
}

/**
 * Create a workflow definition.
 */
export async function serverCreateWorkflowDefinition(
  input: {
    name: Record<string, string>;
    description?: string;
    entityType: string;
    isActive?: boolean;
    priority?: number;
    conditionJson?: ConditionInput[];
    stepsJson: WorkflowStepInput[];
  },
  ctxRaw?: AuditContext,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  const { requirePermission } = await import('@erp/services/iam');
  const perm = await requirePermission(userId, 'settings.manage');
  if (!perm.ok) return { success: false, error: 'Unauthorized' };

  try {
    if (input.stepsJson.length === 0) {
      return { success: false, error: 'At least one approval step is required.' };
    }

    // Validate step order sequence
    const orders = input.stepsJson.map((s) => s.stepOrder).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        return {
          success: false,
          error: `Step orders must be 1, 2, 3... (got ${orders.join(', ')})`,
        };
      }
    }

    const id = crypto.randomUUID();
    await db.insert(workflowDefinitions).values({
      id,
      tenantId,
      name: input.name as never,
      description: input.description ?? null,
      entityType: input.entityType,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      conditionJson: input.conditionJson ?? null,
      stepsJson: input.stepsJson as never,
      createdBy: userId,
      updatedBy: userId,
    });
    
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'create',
      entityType: 'workflow_definition',
      entityId: id,
      after: {
        name: input.name,
        description: input.description ?? null,
        entityType: input.entityType,
        isActive: input.isActive ?? true,
        priority: input.priority ?? 0,
      },
    });

    return { success: true, id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Update a workflow definition.
 */
export async function serverUpdateWorkflowDefinition(
  input: {
    id: string;
    name?: Record<string, string>;
    description?: string;
    isActive?: boolean;
    priority?: number;
    conditionJson?: ConditionInput[];
    stepsJson?: WorkflowStepInput[];
  },
  ctxRaw?: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  const { requirePermission } = await import('@erp/services/iam');
  const perm = await requirePermission(userId, 'settings.manage');
  if (!perm.ok) return { success: false, error: 'Unauthorized' };

  try {
    if (input.stepsJson !== undefined && input.stepsJson.length === 0) {
      return { success: false, error: 'At least one approval step is required.' };
    }
    if (input.stepsJson) {
      const orders = input.stepsJson.map((s) => s.stepOrder).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          return {
            success: false,
            error: `Step orders must be 1, 2, 3... (got ${orders.join(', ')})`,
          };
        }
      }
    }

    const existing = await db
      .select({ id: workflowDefinitions.id })
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.id, input.id),
          eq(workflowDefinitions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing[0]) return { success: false, error: 'Definition not found' };

    await db
      .update(workflowDefinitions)
      .set({
        name: input.name ? (input.name as never) : undefined,
        description: input.description !== undefined ? input.description : undefined,
        isActive: input.isActive ?? undefined,
        priority: input.priority ?? undefined,
        conditionJson:
          input.conditionJson !== undefined ? (input.conditionJson as never) : undefined,
        stepsJson: input.stepsJson as never,
        updatedBy: userId,
      })
      .where(eq(workflowDefinitions.id, input.id));
      
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'update',
      entityType: 'workflow_definition',
      entityId: input.id,
      after: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        priority: input.priority,
      },
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Delete a workflow definition.
 */
export async function serverDeleteWorkflowDefinition(
  id: string,
  ctxRaw?: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthenticated' };
  const tenantId = String((session.user as Record<string, unknown>).tenantId ?? 'default');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  const { requirePermission } = await import('@erp/services/iam');
  const perm = await requirePermission(userId, 'settings.manage');
  if (!perm.ok) return { success: false, error: 'Unauthorized' };

  try {
    const existing = await db
      .select({ id: workflowDefinitions.id })
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.id, id),
          eq(workflowDefinitions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing[0]) return { success: false, error: 'Definition not found' };

    await db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id));
    
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      tenantId,
      userId,
      action: 'delete',
      entityType: 'workflow_definition',
      entityId: id,
    });
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
