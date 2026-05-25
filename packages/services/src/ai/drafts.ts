/**
 * AI action drafts — T-0172 (Phase 3).
 *
 * Persists "the assistant would like to perform action X" so the user
 * can confirm before any mutation runs. The client only ever holds the
 * `draftId`; the server re-fetches the validated payload, re-checks the
 * permission of the *target* action, then dispatches to the real
 * service.
 *
 * Why DB-backed (not in the chat message payload):
 *   - Client tampering: a malicious browser could change "post Rp 50k"
 *     to "post Rp 5M" between the assistant's proposal and the user's
 *     click. The DB row freezes the payload at proposal time.
 *   - Audit clarity: drafts are first-class rows with timestamps so we
 *     can answer "what did the AI suggest, when, and did the user
 *     commit it" later.
 *   - TTL: each draft expires 30 min after creation. Stale drafts can
 *     be cleaned up; if the user comes back tomorrow they have to
 *     re-ask the assistant.
 */

import { and, db, eq, isNull } from '@erp/db';
import { aiActionDrafts } from '@erp/db/schema/ai';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

const DRAFT_TTL_MINUTES = 30;

export type DraftKind = 'manual_sale' | 'complaint' | 'helpdesk_ticket';

export interface DraftRow {
  id: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  locationId: string | null;
  kind: DraftKind;
  summary: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'committed' | 'cancelled' | 'expired';
  resultRef: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function rowOf(raw: typeof aiActionDrafts.$inferSelect): DraftRow {
  return {
    id: raw.id,
    sessionId: raw.sessionId,
    tenantId: raw.tenantId,
    userId: raw.userId,
    locationId: raw.locationId,
    kind: raw.kind as DraftKind,
    summary: raw.summary,
    payload: (raw.payload ?? {}) as Record<string, unknown>,
    status: raw.status as DraftRow['status'],
    resultRef: raw.resultRef,
    expiresAt: raw.expiresAt!,
    consumedAt: raw.consumedAt,
    createdAt: raw.createdAt!,
  };
}

export async function createDraft(input: {
  sessionId: string;
  messageId?: string;
  kind: DraftKind;
  summary: string;
  payload: Record<string, unknown>;
  ctx: AuditContext;
}): Promise<{ id: string; expiresAt: Date }> {
  const id = generateId();
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MINUTES * 60 * 1000);
  await db.insert(aiActionDrafts).values({
    id,
    sessionId: input.sessionId,
    messageId: input.messageId ?? null,
    tenantId: input.ctx.tenantId,
    userId: input.ctx.userId,
    locationId: input.ctx.locationId ?? null,
    kind: input.kind,
    summary: input.summary.slice(0, 1000),
    payload: input.payload as never,
    status: 'pending',
    expiresAt,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: input.ctx.tenantId,
    userId: input.ctx.userId,
    action: 'submit',
    entityType: 'ai_action_draft',
    entityId: id,
    before: null,
    after: { kind: input.kind, summary: input.summary, status: 'pending' },
    metadata: { sessionId: input.sessionId },
  });

  return { id, expiresAt };
}

export async function getDraftForUser(
  draftId: string,
  ctx: AuditContext,
): Promise<Result<DraftRow>> {
  const [raw] = await db
    .select()
    .from(aiActionDrafts)
    .where(
      and(
        eq(aiActionDrafts.id, draftId),
        eq(aiActionDrafts.tenantId, ctx.tenantId),
        eq(aiActionDrafts.userId, ctx.userId),
      ),
    )
    .limit(1);
  if (!raw) return err(AppError.notFound('ai.draft.notFound', { id: draftId }));
  return ok(rowOf(raw));
}

/**
 * Cancel a draft without committing — user clicked "Batal" or the
 * draft expired and we are sweeping it.
 */
export async function cancelDraft(
  draftId: string,
  ctx: AuditContext,
  reason: 'user_cancel' | 'expired' = 'user_cancel',
): Promise<Result<void>> {
  const draftResult = await getDraftForUser(draftId, ctx);
  if (!draftResult.ok) return draftResult;
  const draft = draftResult.value;
  if (draft.status !== 'pending') {
    return err(AppError.businessRule('ai.draft.notPending', { status: draft.status }));
  }

  await db
    .update(aiActionDrafts)
    .set({
      status: reason === 'expired' ? 'expired' : 'cancelled',
      consumedAt: new Date(),
      consumedBy: ctx.userId,
    })
    .where(
      and(
        eq(aiActionDrafts.id, draftId),
        eq(aiActionDrafts.tenantId, ctx.tenantId),
        isNull(aiActionDrafts.consumedAt),
      ),
    );

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'cancel',
    entityType: 'ai_action_draft',
    entityId: draftId,
    before: { status: 'pending' },
    after: { status: reason === 'expired' ? 'expired' : 'cancelled', reason },
    metadata: null,
  });

  return ok(undefined);
}

/**
 * Permission code the *target* action requires. Kept here (not in the
 * client) so a tampered request cannot lie about which permission to
 * check. Update this map when adding a new draft kind.
 */
const COMMIT_PERMISSION_BY_KIND: Record<DraftKind, string> = {
  // `createManualSalesClosing` itself requires `pos.transact`. We mirror
  // that here so the AI commit path can never escalate beyond what the
  // cashier could do from the manual-sales UI.
  manual_sale: 'pos.transact',
  complaint: 'crm.logComplaint',
  helpdesk_ticket: 'helpdesk.create',
};

export interface CommitResult {
  draftId: string;
  kind: DraftKind;
  resultRef: string;
}

/**
 * Re-checks the target permission, dispatches to the real service,
 * and marks the draft committed. The dispatcher is dynamic-import-based
 * so this file does not pull every service into the AI bundle.
 */
export async function commitDraft(
  draftId: string,
  ctx: AuditContext,
): Promise<Result<CommitResult>> {
  const draftResult = await getDraftForUser(draftId, ctx);
  if (!draftResult.ok) return draftResult;
  const draft = draftResult.value;

  if (draft.status !== 'pending') {
    return err(AppError.businessRule('ai.draft.notPending', { status: draft.status }));
  }
  if (draft.expiresAt.getTime() < Date.now()) {
    await cancelDraft(draftId, ctx, 'expired');
    return err(AppError.businessRule('ai.draft.expired'));
  }

  const permission = COMMIT_PERMISSION_BY_KIND[draft.kind];
  if (!permission) {
    return err(AppError.internal('ai.draft.unknownKind', { kind: draft.kind }));
  }
  const permCheck = await requirePermission(ctx.userId, permission, {
    locationId: draft.locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  let resultRef: string;
  try {
    resultRef = await dispatchCommit(draft, ctx);
  } catch (e) {
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'cancel',
      entityType: 'ai_action_draft',
      entityId: draftId,
      before: { status: 'pending' },
      after: {
        status: 'cancelled',
        reason: 'commit_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      metadata: null,
    });
    return err(AppError.internal('ai.draft.commitFailed', e));
  }

  await db
    .update(aiActionDrafts)
    .set({
      status: 'committed',
      resultRef,
      consumedAt: new Date(),
      consumedBy: ctx.userId,
    })
    .where(eq(aiActionDrafts.id, draftId));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'approve',
    entityType: 'ai_action_draft',
    entityId: draftId,
    before: { status: 'pending' },
    after: { status: 'committed', resultRef, kind: draft.kind },
    metadata: null,
  });

  return ok({ draftId, kind: draft.kind, resultRef });
}

async function dispatchCommit(draft: DraftRow, ctx: AuditContext): Promise<string> {
  switch (draft.kind) {
    case 'manual_sale': {
      const { createManualSalesClosing } = await import('../pos');
      const result = await createManualSalesClosing(draft.payload as never, {
        ...ctx,
        locationId: draft.locationId ?? ctx.locationId,
      });
      if (!result.ok) {
        throw new Error(result.error.messageKey ?? 'manual_sales.commitFailed');
      }
      return (result.value as { id?: string }).id ?? '(unknown)';
    }
    case 'complaint': {
      const { logComplaint } = await import('../crm');
      const result = await logComplaint(draft.payload as never, {
        ...ctx,
        locationId: draft.locationId ?? ctx.locationId,
      });
      if (!result.ok) {
        throw new Error(result.error.messageKey ?? 'crm.commitFailed');
      }
      return (result.value as { id?: string }).id ?? '(unknown)';
    }
    case 'helpdesk_ticket': {
      const { createTicket } = await import('../helpdesk');
      const result = await createTicket(draft.payload, {
        ...ctx,
        locationId: draft.locationId ?? ctx.locationId,
      });
      if (!result.ok) {
        throw new Error(result.error.messageKey ?? 'helpdesk.commitFailed');
      }
      return result.value.id;
    }
    default: {
      throw new Error(`unsupported draft kind ${draft.kind}`);
    }
  }
}
