/**
 * ai-action-drafts-sweeper — T-0173.
 *
 * Marks any `ai_action_drafts` row that is still `pending` past its
 * `expires_at` timestamp as `expired`. Runs daily; the drafts only
 * live 30 min so the worst-case stale-pending window is < 24 h.
 *
 * Each transition is also recorded in `audit_log` so admins can see
 * why a draft never committed (e.g. user walked away).
 */

import { and, db, eq, lt } from '@erp/db';
import { aiActionDrafts } from '@erp/db/schema/ai';
import { auditLog } from '@erp/db/schema/audit';
import { generateId } from '@erp/shared/id';

export interface AiActionDraftsSweeperJobData {
  /** Optional tenant filter; default: all tenants. */
  tenantId?: string;
}

export async function aiActionDraftsSweeperHandler(
  data: AiActionDraftsSweeperJobData = {},
): Promise<{ expired: number }> {
  const now = new Date();

  const conditions = [eq(aiActionDrafts.status, 'pending'), lt(aiActionDrafts.expiresAt, now)];
  if (data.tenantId) conditions.push(eq(aiActionDrafts.tenantId, data.tenantId));

  const expiredRows = await db
    .select({
      id: aiActionDrafts.id,
      tenantId: aiActionDrafts.tenantId,
      userId: aiActionDrafts.userId,
      kind: aiActionDrafts.kind,
    })
    .from(aiActionDrafts)
    .where(and(...conditions))
    .limit(500);

  if (expiredRows.length === 0) {
    return { expired: 0 };
  }

  await db
    .update(aiActionDrafts)
    .set({ status: 'expired', consumedAt: now, consumedBy: 'system_sweeper' })
    .where(and(...conditions));

  // Best-effort audit fan-out so admins see the sweep as a real event,
  // not just a status flip with no story.
  for (const row of expiredRows) {
    try {
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: row.tenantId,
        userId: row.userId,
        action: 'cancel',
        entityType: 'ai_action_draft',
        entityId: row.id,
        before: { status: 'pending' },
        after: { status: 'expired', reason: 'sweeper', kind: row.kind },
        metadata: { sweepRunAt: now.toISOString() },
      });
    } catch {
      // Audit failure must not block the sweep itself.
    }
  }

  return { expired: expiredRows.length };
}
