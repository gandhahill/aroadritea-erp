/**
 * AI Assistant — Server Actions wrapper (User Req 1, ADR-0013).
 *
 * AuditContext is always derived server-side from the active session.
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  archiveAiSession,
  cancelDraft,
  commitDraft,
  createAiSession,
  getAiRuntimeConfig,
  getAiSession,
  getDraftForUser,
  isAiAssistantEnabled,
  listAllAiSessionsAdmin,
  listMyAiSessions,
  renameAiSession,
  sendChatMessage,
  setSessionWebSearch,
} from '@erp/services/ai';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return null;
  return { userId, tenantId, locationId: String(user.locationId ?? '') };
}

export async function aiEnabledFlag() {
  const ctx = await resolveCtx();
  if (!ctx) return { enabled: false };
  const config = await getAiRuntimeConfig(ctx.tenantId);
  return { enabled: isAiAssistantEnabled() && config.enabled };
}

export async function fetchMySessions() {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await listMyAiSessions(ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  return { ok: true as const, items: r.value };
}

export async function fetchAllSessionsAdmin() {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await listAllAiSessionsAdmin(ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  return { ok: true as const, items: r.value };
}

export async function fetchSession(id: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await getAiSession(id, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  return { ok: true as const, ...r.value };
}

export async function startSessionAction(input: { title?: string; allowWebSearch?: boolean }) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await createAiSession(input, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  revalidatePath('/ai-assistant');
  return { ok: true as const, id: r.value.id };
}

export async function renameSessionAction(id: string, title: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await renameAiSession(id, title, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  revalidatePath('/ai-assistant');
  revalidatePath(`/ai-assistant/${id}`);
  return { ok: true as const };
}

export async function toggleSessionWebSearchAction(id: string, allow: boolean) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await setSessionWebSearch(id, allow, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  revalidatePath('/ai-assistant');
  revalidatePath(`/ai-assistant/${id}`);
  return { ok: true as const };
}

export async function archiveSessionAction(id: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await archiveAiSession(id, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  revalidatePath('/ai-assistant');
  return { ok: true as const };
}

export async function fetchDraftAction(draftId: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await getDraftForUser(draftId, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey ?? 'ai.draft.notFound' };
  return {
    ok: true as const,
    draft: {
      id: r.value.id,
      kind: r.value.kind,
      summary: r.value.summary,
      status: r.value.status,
      payload: r.value.payload,
      expiresAt: r.value.expiresAt.toISOString(),
      consumedAt: r.value.consumedAt?.toISOString() ?? null,
      resultRef: r.value.resultRef,
    },
  };
}

export async function confirmDraftAction(draftId: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await commitDraft(draftId, ctx);
  if (!r.ok) {
    return {
      ok: false as const,
      error: r.error.messageKey ?? 'ai.draft.commitFailed',
      details: r.error.details ?? null,
    };
  }
  revalidatePath('/ai-assistant');
  return {
    ok: true as const,
    draftId: r.value.draftId,
    kind: r.value.kind,
    resultRef: r.value.resultRef,
  };
}

export async function cancelDraftAction(draftId: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await cancelDraft(draftId, ctx, 'user_cancel');
  if (!r.ok) return { ok: false as const, error: r.error.messageKey ?? 'ai.draft.cancelFailed' };
  return { ok: true as const };
}

export async function sendMessageAction(input: {
  sessionId: string;
  content: string;
  useReasoning?: boolean;
  /** Optional uploaded attachments. Each `url` is the result of POSTing
   *  to /api/uploads with area=ai-attachments — the server-side service
   *  keeps the provider text-only unless an OCR/vision tool handles it. */
  attachments?: Array<{ url: string; mimeType: string }>;
}) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await sendChatMessage(input, ctx);
  if (!r.ok) {
    return {
      ok: false as const,
      error: r.error.messageKey ?? 'ai.message.failed',
      details: r.error.details ?? null,
    };
  }
  revalidatePath(`/ai-assistant/${input.sessionId}`);
  const refreshed = await getAiSession(input.sessionId, ctx);
  return {
    ok: true as const,
    reply: r.value.reply,
    reasoning: r.value.reasoning,
    messageId: r.value.assistantMessageId,
    toolRoundsExecuted: r.value.toolRoundsExecuted,
    messages: refreshed.ok ? refreshed.value.messages : null,
  };
}
