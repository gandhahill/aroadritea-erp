import { AppError } from '@erp/shared/errors';
import { err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { describe, expect, it, vi } from 'vitest';
import { runApprovalGate } from '../src/workflow';

const ctx: AuditContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  locationId: 'loc-1',
};

describe('runApprovalGate', () => {
  it('allows the transition immediately when no workflow matches', async () => {
    const evaluateWorkflow = vi.fn().mockResolvedValue(ok(null));
    const createWorkflowInstance = vi.fn();

    const result = await runApprovalGate(
      {
        entityType: 'purchase_order',
        entityId: 'po-1',
        transition: 'submit',
        entityData: { grandTotal: 100_000 },
      },
      ctx,
      {
        evaluateWorkflow,
        createWorkflowInstance,
        findPendingWorkflowInstance: vi.fn().mockResolvedValue(ok(null)),
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        status: 'approved',
        approvalRequired: false,
        workflowEntityType: 'purchase_order',
        transition: 'submit',
      });
    }
    expect(evaluateWorkflow).toHaveBeenCalledWith(
      'purchase_order',
      expect.objectContaining({
        entityType: 'purchase_order',
        entityId: 'po-1',
        transition: 'submit',
        grandTotal: 100_000,
      }),
      ctx,
    );
    expect(createWorkflowInstance).not.toHaveBeenCalled();
  });

  it('creates a workflow instance when a workflow matches', async () => {
    const evaluateWorkflow = vi.fn().mockResolvedValue(
      ok({
        definitionId: 'wfd-1',
        steps: [{ stepOrder: 1, approverRole: 'director' }],
      }),
    );
    const createWorkflowInstance = vi.fn().mockResolvedValue(ok({ instanceId: 'wfi-1' }));
    const findApprovedWorkflowInstance = vi.fn().mockResolvedValue(ok(null));

    const result = await runApprovalGate(
      {
        entityType: 'stock_adjustment',
        workflowEntityType: 'stock_adjustment.high_variance',
        entityId: 'adj-1',
        transition: 'post',
        entitySummary: 'Stock adjustment ADJ-1',
        entityData: { varianceAmount: 2_500_000 },
      },
      ctx,
      {
        evaluateWorkflow,
        createWorkflowInstance,
        findPendingWorkflowInstance: vi.fn().mockResolvedValue(ok(null)),
        findApprovedWorkflowInstance,
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        status: 'pending_approval',
        approvalRequired: true,
        workflowEntityType: 'stock_adjustment.high_variance',
        workflowInstanceId: 'wfi-1',
        definitionId: 'wfd-1',
        reusedExisting: false,
      });
    }
    expect(createWorkflowInstance).toHaveBeenCalledWith(
      {
        definitionId: 'wfd-1',
        entityType: 'stock_adjustment.high_variance',
        entityId: 'adj-1',
        entitySummary: 'Stock adjustment ADJ-1',
      },
      ctx,
    );
    expect(findApprovedWorkflowInstance).toHaveBeenCalledWith(
      {
        entityType: 'stock_adjustment.high_variance',
        entityId: 'adj-1',
        definitionId: 'wfd-1',
      },
      ctx,
    );
  });

  it('allows the transition when a matching workflow instance is already approved', async () => {
    const evaluateWorkflow = vi.fn().mockResolvedValue(
      ok({
        definitionId: 'wfd-approved',
        steps: [{ stepOrder: 1, approverRole: 'director' }],
      }),
    );
    const createWorkflowInstance = vi.fn();

    const result = await runApprovalGate(
      {
        entityType: 'journal_entry',
        workflowEntityType: 'journal_entry_manual',
        entityId: 'je-1',
        transition: 'post',
      },
      ctx,
      {
        evaluateWorkflow,
        createWorkflowInstance,
        findPendingWorkflowInstance: vi.fn().mockResolvedValue(ok(null)),
        findApprovedWorkflowInstance: vi.fn().mockResolvedValue(
          ok({
            id: 'wfi-approved',
            definitionId: 'wfd-approved',
          }),
        ),
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        status: 'approved',
        approvalRequired: false,
        workflowEntityType: 'journal_entry_manual',
        workflowInstanceId: 'wfi-approved',
        definitionId: 'wfd-approved',
      });
    }
    expect(createWorkflowInstance).not.toHaveBeenCalled();
  });

  it('reuses an existing pending workflow instance to avoid duplicate approvals', async () => {
    const evaluateWorkflow = vi.fn();
    const createWorkflowInstance = vi.fn();

    const result = await runApprovalGate(
      {
        entityType: 'journal_entry',
        entityId: 'je-1',
        transition: 'post',
      },
      ctx,
      {
        evaluateWorkflow,
        createWorkflowInstance,
        findPendingWorkflowInstance: vi.fn().mockResolvedValue(
          ok({
            id: 'wfi-existing',
            definitionId: 'wfd-existing',
            currentStepIndex: 0,
          }),
        ),
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        status: 'pending_approval',
        approvalRequired: true,
        workflowInstanceId: 'wfi-existing',
        definitionId: 'wfd-existing',
        reusedExisting: true,
      });
    }
    expect(evaluateWorkflow).not.toHaveBeenCalled();
    expect(createWorkflowInstance).not.toHaveBeenCalled();
  });

  it('returns validation failure for missing gate identity', async () => {
    const result = await runApprovalGate(
      {
        entityType: '',
        entityId: 'po-1',
        transition: 'submit',
      },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.messageKey).toBe('workflow.approvalGate.invalidInput');
    }
  });

  it('propagates workflow evaluation errors', async () => {
    const result = await runApprovalGate(
      {
        entityType: 'purchase_order',
        entityId: 'po-1',
        transition: 'submit',
      },
      ctx,
      {
        evaluateWorkflow: vi
          .fn()
          .mockResolvedValue(err(AppError.internal('workflow.evaluate.failed'))),
        findPendingWorkflowInstance: vi.fn().mockResolvedValue(ok(null)),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('workflow.evaluate.failed');
    }
  });
});
