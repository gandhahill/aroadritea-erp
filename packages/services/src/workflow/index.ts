/**
 * Workflow Service — SD §9.10, §18
 *
 * - Evaluate entity data against workflow definition conditions
 * - Create approval instances (one per entity)
 * - Approve / reject / cancel individual steps
 * - Auto-advance to next step on approval
 */

import { db } from '@erp/db';
import { workflowDefinitions, workflowInstances, workflowSteps } from '@erp/db/schema/workflow';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { roles, userRoles } from '@erp/db/schema/auth';
import { requirePermission } from '../iam';
import { auditRecord } from '../audit';

// ─── Condition evaluation ────────────────────────────────────────────────────

type Condition = { field: string; op: string; value: string | number | boolean };
export type StepsJson = Array<{ stepOrder: number; approverRole: string }>;

export interface ApprovalGateInput {
  entityType: string;
  entityId: string;
  transition: string;
  entityData?: Record<string, unknown>;
  entitySummary?: string;
  workflowEntityType?: string;
}

export type ApprovalGateDecision =
  | {
      status: 'approved';
      approvalRequired: false;
      workflowEntityType: string;
      transition: string;
      workflowInstanceId?: string;
      definitionId?: string;
    }
  | {
      status: 'pending_approval';
      approvalRequired: true;
      workflowEntityType: string;
      transition: string;
      workflowInstanceId: string;
      definitionId: string;
      reusedExisting: boolean;
      steps?: StepsJson;
    };

export interface PendingWorkflowInstance {
  id: string;
  definitionId: string;
  currentStepIndex: number;
}

export interface ApprovedWorkflowInstance {
  id: string;
  definitionId: string;
}

export interface ApprovalGateDependencies {
  evaluateWorkflow?: typeof evaluate;
  createWorkflowInstance?: typeof createInstance;
  findPendingWorkflowInstance?: (
    input: { entityType: string; entityId: string },
    ctx: AuditContext,
  ) => Promise<Result<PendingWorkflowInstance | null>>;
  findApprovedWorkflowInstance?: (
    input: { entityType: string; entityId: string; definitionId: string },
    ctx: AuditContext,
  ) => Promise<Result<ApprovedWorkflowInstance | null>>;
}

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

async function findPendingWorkflowInstance(
  input: { entityType: string; entityId: string },
  ctx: AuditContext,
): Promise<Result<PendingWorkflowInstance | null>> {
  try {
    const existing = await db
      .select({
        id: workflowInstances.id,
        definitionId: workflowInstances.definitionId,
        currentStepIndex: workflowInstances.currentStepIndex,
      })
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.tenantId, ctx.tenantId),
          eq(workflowInstances.entityType, input.entityType),
          eq(workflowInstances.entityId, input.entityId),
          eq(workflowInstances.status, 'pending'),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return ok(existing);
  } catch (e) {
    return err(AppError.internal('workflow.findPending.failed', e));
  }
}

async function findApprovedWorkflowInstance(
  input: { entityType: string; entityId: string; definitionId: string },
  ctx: AuditContext,
): Promise<Result<ApprovedWorkflowInstance | null>> {
  try {
    const approved = await db
      .select({
        id: workflowInstances.id,
        definitionId: workflowInstances.definitionId,
      })
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.tenantId, ctx.tenantId),
          eq(workflowInstances.entityType, input.entityType),
          eq(workflowInstances.entityId, input.entityId),
          eq(workflowInstances.definitionId, input.definitionId),
          eq(workflowInstances.status, 'approved'),
        ),
      )
      .orderBy(desc(workflowInstances.resolvedAt), desc(workflowInstances.triggeredAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return ok(approved);
  } catch (e) {
    return err(AppError.internal('workflow.findApproved.failed', e));
  }
}

export async function runApprovalGate(
  input: ApprovalGateInput,
  ctx: AuditContext,
  deps: ApprovalGateDependencies = {},
): Promise<Result<ApprovalGateDecision>> {
  if (!input.entityType.trim() || !input.entityId.trim() || !input.transition.trim()) {
    return err(AppError.validation('workflow.approvalGate.invalidInput'));
  }

  const workflowEntityType = input.workflowEntityType ?? input.entityType;
  const findPending = deps.findPendingWorkflowInstance ?? findPendingWorkflowInstance;
  const pending = await findPending({ entityType: workflowEntityType, entityId: input.entityId }, ctx);
  if (!pending.ok) return pending;

  if (pending.value) {
    return ok({
      status: 'pending_approval',
      approvalRequired: true,
      workflowEntityType,
      transition: input.transition,
      workflowInstanceId: pending.value.id,
      definitionId: pending.value.definitionId,
      reusedExisting: true,
    });
  }

  const evaluateWorkflow = deps.evaluateWorkflow ?? evaluate;
  const gateData = {
    ...(input.entityData ?? {}),
    entityType: input.entityType,
    entityId: input.entityId,
    transition: input.transition,
  };
  const workflow = await evaluateWorkflow(workflowEntityType, gateData, ctx);
  if (!workflow.ok) return workflow;

  if (!workflow.value) {
    return ok({
      status: 'approved',
      approvalRequired: false,
      workflowEntityType,
      transition: input.transition,
    });
  }

  const findApproved = deps.findApprovedWorkflowInstance ?? findApprovedWorkflowInstance;
  const approved = await findApproved(
    {
      entityType: workflowEntityType,
      entityId: input.entityId,
      definitionId: workflow.value.definitionId,
    },
    ctx,
  );
  if (!approved.ok) return approved;

  if (approved.value) {
    return ok({
      status: 'approved',
      approvalRequired: false,
      workflowEntityType,
      transition: input.transition,
      workflowInstanceId: approved.value.id,
      definitionId: approved.value.definitionId,
    });
  }

  const createWorkflowInstance = deps.createWorkflowInstance ?? createInstance;
  const created = await createWorkflowInstance(
    {
      definitionId: workflow.value.definitionId,
      entityType: workflowEntityType,
      entityId: input.entityId,
      entitySummary: input.entitySummary,
    },
    ctx,
  );
  if (!created.ok) return created;

  return ok({
    status: 'pending_approval',
    approvalRequired: true,
    workflowEntityType,
    transition: input.transition,
    workflowInstanceId: created.value.instanceId,
    definitionId: workflow.value.definitionId,
    reusedExisting: false,
    steps: workflow.value.steps,
  });
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
    // Tenant-scope the definition lookup — otherwise a caller from
    // tenant A could trigger a workflow defined for tenant B by passing
    // the foreign definitionId.
    const def = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.id, input.definitionId),
          eq(workflowDefinitions.tenantId, ctx.tenantId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!def)
      return err(AppError.notFound('workflow.definitionNotFound', { id: input.definitionId }));

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

    await auditRecord({
      action: 'submit',
      entityType: 'workflow_instance',
      entityId: instanceId,
      before: null,
      after: {
        definitionId: input.definitionId,
        entityType: input.entityType,
        entityId: input.entityId,
        entitySummary: input.entitySummary ?? null,
        status: 'pending',
      },
      metadata: { stepCount: steps.length },
      ctx,
    });

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
      .where(
        and(
          eq(workflowInstances.id, input.instanceId),
          eq(workflowInstances.tenantId, ctx.tenantId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!instance)
      return err(AppError.notFound('workflow.instanceNotFound', { id: input.instanceId }));
    if (instance.status !== 'pending') {
      return err(AppError.businessRule('workflow.instanceNotPending', { status: instance.status }));
    }

    const stepOrder = instance.currentStepIndex + 1;

    // Find the current step record
    const currentStep = await db
      .select()
      .from(workflowSteps)
      .where(
        and(eq(workflowSteps.instanceId, input.instanceId), eq(workflowSteps.stepOrder, stepOrder)),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!currentStep) {
      return err(AppError.notFound('workflow.stepNotFound', { stepOrder }));
    }

    // Check user has the right role for this step
    const userRoleCheck = await db
      .select({ id: userRoles.roleId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, ctx.userId),
          eq(roles.code, currentStep.approverRole),
          eq(roles.tenantId, ctx.tenantId)
        )
      )
      .limit(1);

    if (userRoleCheck.length === 0) {
      return err(AppError.forbidden('workflow.resolveStep.unauthorizedRole', { requiredRole: currentStep.approverRole }));
    }

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
          and(eq(workflowSteps.instanceId, input.instanceId), eq(workflowSteps.status, 'pending')),
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

        await auditRecord({
          action: 'approve',
          entityType: 'workflow_instance',
          entityId: input.instanceId,
          before: { currentStepIndex: instance.currentStepIndex, status: instance.status },
          after: { currentStepIndex: nextIdx, status: 'pending' },
          metadata: {
            stepOrder,
            approverRole: currentStep.approverRole,
            notes: input.notes ?? null,
          },
          ctx,
        });

      }

      // All steps approved - mark instance approved
      await db
        .update(workflowInstances)
        .set({
          status: 'approved',
          resolvedBy: ctx.userId,
          resolvedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(workflowInstances.id, input.instanceId));

      await auditRecord({
        action: 'approve',
        entityType: 'workflow_instance',
        entityId: input.instanceId,
        before: { currentStepIndex: instance.currentStepIndex, status: instance.status },
        after: { currentStepIndex: instance.currentStepIndex, status: 'approved' },
        metadata: {
          stepOrder,
          approverRole: currentStep.approverRole,
          notes: input.notes ?? null,
        },
        ctx,
      });

      return ok({ nextStepIndex: null, instanceStatus: 'approved' });
    }

    // Reject - mark current step rejected and all remaining steps skipped
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
        and(eq(workflowSteps.instanceId, input.instanceId), eq(workflowSteps.status, 'pending')),
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

    await auditRecord({
      action: 'reject',
      entityType: 'workflow_instance',
      entityId: input.instanceId,
      before: { currentStepIndex: instance.currentStepIndex, status: instance.status },
      after: { currentStepIndex: instance.currentStepIndex, status: 'rejected' },
      metadata: {
        stepOrder,
        approverRole: currentStep.approverRole,
        notes: input.notes ?? null,
      },
      ctx,
    });

    return ok({ nextStepIndex: null, instanceStatus: 'rejected' });
  } catch (e) {
    return err(AppError.internal('workflow.resolveStep.failed', e));
  }
}

// ─── Cancel Instance ─────────────────────────────────────────────────────────

/**
 * Cancel a pending workflow instance (e.g. user cancels their own request).
 */
export async function cancelInstance(instanceId: string, ctx: AuditContext): Promise<Result<void>> {
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

    await auditRecord({
      action: 'cancel',
      entityType: 'workflow_instance',
      entityId: instanceId,
      before: { currentStepIndex: instance.currentStepIndex, status: instance.status },
      after: { currentStepIndex: instance.currentStepIndex, status: 'cancelled' },
      metadata: {
        entityType: instance.entityType,
        entityId: instance.entityId,
      },
      ctx,
    });

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

    return ok({
      instance: instance as Record<string, unknown>,
      steps: steps as Record<string, unknown>[],
    });
  } catch (e) {
    return err(AppError.internal('workflow.getInstance.failed', e));
  }
}
