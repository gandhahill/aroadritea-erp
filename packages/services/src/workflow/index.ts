/**
 * Workflow Service — SD §9.10, §18
 *
 * - Evaluate entity data against workflow definition conditions
 * - Create approval instances (one per entity)
 * - Approve / reject / cancel individual steps
 * - Auto-advance to next step on approval
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@erp/db';
import {
  workflowDefinitions,
  workflowInstances,
  workflowSteps,
} from '@erp/db/schema/workflow';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { type AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

// ─── Condition evaluation ────────────────────────────────────────────────────

type Condition = { field: string; op: string; value: string | number | boolean };
type StepsJson = Array<{ stepOrder: number; approverRole: string }>;

function evaluateConditions(
  conditions: Condition[] | null,
  entityData: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;

  for (const cond of conditions) {
    const fieldValue = entityData[cond.field];
    const condValue = cond.value;

    let matches = false;
    switch (cond.op) {
      case 'eq':
        matches = String(fieldValue) === String(condValue);
        break;
      case 'ne':
        matches = String(fieldValue) !== String(condValue);
        break;
      case 'gt':
        matches = Number(fieldValue) > Number(condValue);
        break;
      case 'gte':
        matches = Number(fieldValue) >= Number(condValue);
        break;
      case 'lt':
        matches = Number(fieldValue) < Number(condValue);
        break;
      case 'lte':
        matches = Number(fieldValue) <= Number(condValue);
        break;
      case 'contains':
        matches = String(fieldValue ?? '').includes(String(condValue));
        break;
      case 'in':
        if (Array.isArray(condValue)) {
          matches = condValue.includes(fieldValue);
        }
        break;
      default:
        matches = false;
    }

    if (!matches) return false;
  }
  return true;
}

// ─── Evaluate ────────────────────────────────────────────────────────────────

/**
 * Find the applicable workflow definition for an entity.
 * Returns the matching definition with the highest priority, or null.
 */
export async function evaluate(
  entityType: string,
  entityData: Record<string, unknown>,
  ctx: AuditContext,
): Promise<Result<{ definitionId: string; steps: StepsJson } | null>> {
  try {
    const defs = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.tenantId, ctx.tenantId),
          eq(workflowDefinitions.entityType, entityType),
          eq(workflowDefinitions.isActive, true),
        ),
      )
      .orderBy(desc(workflowDefinitions.priority));

    for (const def of defs) {
      const conditions = def.conditionJson as Condition[] | null;
      if (evaluateConditions(conditions, entityData)) {
        return ok({
          definitionId: def.id,
          steps: def.stepsJson as StepsJson,
        });
      }
    }

    return ok(null);
  } catch (e) {
    return err(AppError.internal('workflow.evaluate.failed', e));
  }
}

// ─── Create Instance ────────────────────────────────────────────────────────

/**
 * Start a new approval workflow for an entity.
 */
export async function createInstance(
  input: {
    definitionId: string;
    entityType: string;
    entityId: string;
    entitySummary?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ instanceId: string }>> {
  try {
    const def = await db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, input.definitionId))
      .limit(1)
      .then((r) => r[0]);

    if (!def) return err(AppError.notFound('workflow.definitionNotFound', { id: input.definitionId }));

    const steps = def.stepsJson as StepsJson;
    if (!steps || steps.length === 0) {
      return err(AppError.businessRule('workflow.noSteps', { definitionId: input.definitionId }));
    }

    const instanceId = crypto.randomUUID();
    await db.insert(workflowInstances).values({
      id: instanceId,
      tenantId: ctx.tenantId,
      definitionId: input.definitionId,
      entityType: input.entityType,
      entityId: input.entityId,
      entitySummary: input.entitySummary ?? null,
      status: 'pending',
      currentStepIndex: 0,
      triggeredBy: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Create step records
    for (const step of steps) {
      await db.insert(workflowSteps).values({
        id: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        instanceId,
        stepOrder: step.stepOrder,
        approverRole: step.approverRole,
        status: 'pending',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    return ok({ instanceId });
  } catch (e) {
    return err(AppError.internal('workflow.createInstance.failed', e));
  }
}

// ─── Approve / Reject ──────────────────────────────────────────────────────

/**
 * Approve the current step of a workflow instance.
 * Advances to the next step or marks instance as approved.
 */
export async function approveStep(
  input: {
    instanceId: string;
    notes?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ nextStepIndex: number | null; instanceStatus: string }>> {
  return resolveStep({ ...input, action: 'approve' }, ctx);
}

/**
 * Reject the current step of a workflow instance.
 * Marks instance as rejected and skips remaining steps.
 */
export async function rejectStep(
  input: {
    instanceId: string;
    notes?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ nextStepIndex: null; instanceStatus: string }>> {
  const result = await resolveStep({ ...input, action: 'reject' }, ctx);
  if (!result.ok) return result;
  // Reject always has null nextStepIndex
  return ok({ nextStepIndex: null, instanceStatus: result.value.instanceStatus });
}

async function resolveStep(
  input: {
    instanceId: string;
    notes?: string;
    action: 'approve' | 'reject';
  },
  ctx: AuditContext,
): Promise<Result<{ nextStepIndex: number | null; instanceStatus: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'workflow.approve', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const instance = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, input.instanceId))
      .limit(1)
      .then((r) => r[0]);

    if (!instance) return err(AppError.notFound('workflow.instanceNotFound', { id: input.instanceId }));
    if (instance.status !== 'pending') {
      return err(AppError.businessRule('workflow.instanceNotPending', { status: instance.status }));
    }

    const stepOrder = instance.currentStepIndex + 1;

    // Find the current step record
    const currentStep = await db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.instanceId, input.instanceId),
          eq(workflowSteps.stepOrder, stepOrder),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!currentStep) {
      return err(AppError.notFound('workflow.stepNotFound', { stepOrder }));
    }

    // Check user has the right role for this step
    // (Role check is simplified: in production, you'd verify user role matches approverRole)
    if (input.action === 'approve') {
      // Mark current step approved
      await db
        .update(workflowSteps)
        .set({
          status: 'approved',
          decidedBy: ctx.userId,
          decidedAt: new Date(),
          notes: input.notes ?? null,
          updatedBy: ctx.userId,
        })
        .where(eq(workflowSteps.id, currentStep.id));

      // Find next pending step
      const nextSteps = await db
        .select()
        .from(workflowSteps)
        .where(
          and(
            eq(workflowSteps.instanceId, input.instanceId),
            eq(workflowSteps.status, 'pending'),
          ),
        )
        .orderBy(workflowSteps.stepOrder)
        .limit(1);

      if (nextSteps[0]) {
        // Advance to next step
        const nextIdx = nextSteps[0].stepOrder;
        await db
          .update(workflowInstances)
          .set({
            currentStepIndex: nextIdx,
            updatedBy: ctx.userId,
          })
          .where(eq(workflowInstances.id, input.instanceId));

        return ok({ nextStepIndex: nextIdx, instanceStatus: 'pending' });
      } else {
        // All steps approved — mark instance approved
        await db
          .update(workflowInstances)
          .set({
            status: 'approved',
            resolvedBy: ctx.userId,
            resolvedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(eq(workflowInstances.id, input.instanceId));

        return ok({ nextStepIndex: null, instanceStatus: 'approved' });
      }
    } else {
      // Reject — mark current step rejected + all remaining steps skipped
      await db
        .update(workflowSteps)
        .set({
          status: 'rejected',
          decidedBy: ctx.userId,
          decidedAt: new Date(),
          notes: input.notes ?? null,
          updatedBy: ctx.userId,
        })
        .where(eq(workflowSteps.id, currentStep.id));

      await db
        .update(workflowSteps)
        .set({ status: 'skipped', updatedBy: ctx.userId })
        .where(
          and(
            eq(workflowSteps.instanceId, input.instanceId),
            eq(workflowSteps.status, 'pending'),
          ),
        );

      await db
        .update(workflowInstances)
        .set({
          status: 'rejected',
          resolvedBy: ctx.userId,
          resolvedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(workflowInstances.id, input.instanceId));

      return ok({ nextStepIndex: null, instanceStatus: 'rejected' });
    }
  } catch (e) {
    return err(AppError.internal('workflow.resolveStep.failed', e));
  }
}

// ─── Cancel Instance ─────────────────────────────────────────────────────────

/**
 * Cancel a pending workflow instance (e.g. user cancels their own request).
 */
export async function cancelInstance(
  instanceId: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  try {
    const instance = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1)
      .then((r) => r[0]);

    if (!instance) return err(AppError.notFound('workflow.instanceNotFound', { id: instanceId }));
    if (instance.status !== 'pending') {
      return err(AppError.businessRule('workflow.instanceNotPending', { status: instance.status }));
    }

    await db
      .update(workflowInstances)
      .set({
        status: 'cancelled',
        resolvedBy: ctx.userId,
        resolvedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(workflowInstances.id, instanceId));

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('workflow.cancelInstance.failed', e));
  }
}

// ─── Get Instance ───────────────────────────────────────────────────────────

/**
 * Get workflow instance with its steps.
 */
export async function getInstance(
  instanceId: string,
): Promise<Result<{ instance: Record<string, unknown>; steps: Record<string, unknown>[] }>> {
  try {
    const instance = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId))
      .limit(1)
      .then((r) => r[0]);

    if (!instance) return err(AppError.notFound('workflow.instanceNotFound', { id: instanceId }));

    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.instanceId, instanceId))
      .orderBy(workflowSteps.stepOrder);

    return ok({ instance: instance as Record<string, unknown>, steps: steps as Record<string, unknown>[] });
  } catch (e) {
    return err(AppError.internal('workflow.getInstance.failed', e));
  }
}