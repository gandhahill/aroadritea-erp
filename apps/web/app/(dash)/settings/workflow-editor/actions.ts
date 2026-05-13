/**
 * Workflow Editor Server Actions — SD §9.10, §18
 * CRUD for workflow definitions + steps.
 */

'use server';

import { and, db, desc, eq } from '@erp/db';
import { workflowDefinitions } from '@erp/db/schema/workflow';
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

/**
 * Fetch all workflow definitions for a tenant.
 */
export async function fetchWorkflowDefinitions(
  tenantId: string,
  entityType?: string,
): Promise<WorkflowDefinitionItem[]> {
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
  ctx: AuditContext,
): Promise<{ success: boolean; id?: string; error?: string }> {
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
      tenantId: ctx.tenantId,
      name: input.name as never,
      description: input.description ?? null,
      entityType: input.entityType,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      conditionJson: input.conditionJson ?? null,
      stepsJson: input.stepsJson as never,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
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
  ctx: AuditContext,
): Promise<{ success: boolean; error?: string }> {
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
      .where(eq(workflowDefinitions.id, input.id))
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
        updatedBy: ctx.userId,
      })
      .where(eq(workflowDefinitions.id, input.id));

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
  ctx: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id));
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
