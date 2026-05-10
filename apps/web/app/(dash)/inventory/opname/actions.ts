/**
 * inventory.opname — Server Actions (SD §25.9)
 *
 * Wraps inventory/opname-service functions for the Next.js layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  createOpnameDraft,
  recordCount,
  submitOpname,
  approveOpname,
  cancelOpname,
  getOpname,
} from '@erp/services/inventory/opname-service';
import { type AuditContext } from '@erp/shared/types';
import { db } from '@erp/db';
import { stockOpnameSessions } from '@erp/db/schema/stock-opname';
import { eq } from '@erp/db';

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: (user?.id as string) ?? 'unknown',
    tenantId: (user?.tenantId as string) ?? 'default',
    locationId: (user?.locationId as string) ?? '',
    ipAddress: '',
    userAgent: '',
  };
}

async function resolveLocationId(sessionId: string, ctx: AuditContext): Promise<void> {
  const opSession = await db
    .select({ locationId: stockOpnameSessions.locationId })
    .from(stockOpnameSessions)
    .where(eq(stockOpnameSessions.id, sessionId))
    .limit(1)
    .then((r) => r[0]);

  if (opSession) ctx.locationId = opSession.locationId;
}

// ─── Create session ───────────────────────────────────────────────────────────

export async function createOpnameSessionAction(params: {
  locationId: string;
  sessionDate: string;
  periodCode: string;
  notes?: string;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  ctx.locationId = params.locationId;

  const result = await createOpnameDraft(
    {
      sessionDate: params.sessionDate,
      periodCode: params.periodCode,
      notes: params.notes,
    },
    ctx,
  );
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

// ─── Record physical count ─────────────────────────────────────────────────────

export async function recordCountAction(params: {
  sessionId: string;
  /** Each count: productId + optional variantId + countedQty */
  lines: Array<{
    productId: string;
    variantId?: string | null;
    countedQty: string;
    notes?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  await resolveLocationId(params.sessionId, ctx);

  const result = await recordCount(
    { sessionId: params.sessionId, counts: params.lines },
    ctx,
  );
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

// ─── Submit opname ─────────────────────────────────────────────────────────────

export async function submitOpnameAction(sessionId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  await resolveLocationId(sessionId, ctx);

  const result = await submitOpname(sessionId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

// ─── Approve opname ────────────────────────────────────────────────────────────

export async function approveOpnameAction(sessionId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  await resolveLocationId(sessionId, ctx);

  const result = await approveOpname(sessionId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

// ─── Cancel opname ─────────────────────────────────────────────────────────────

export async function cancelOpnameAction(sessionId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  await resolveLocationId(sessionId, ctx);

  const result = await cancelOpname(sessionId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

// ─── Load session ─────────────────────────────────────────────────────────────

export async function loadOpnameSessionAction(sessionId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  await resolveLocationId(sessionId, ctx);

  const result = await getOpname(sessionId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}