/**
 * AI Assistant — Server Actions wrapper (User Req 1, ADR-0013).
 *
 * AuditContext is always derived server-side from the active session.
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  archiveAiSession,
  createAiSession,
  getAiSession,
  isAiAssistantEnabled,
  listAllAiSessionsAdmin,
  listMyAiSessions,
  renameAiSession,
  sendChatMessage,
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
  return { enabled: isAiAssistantEnabled() };
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

export async function archiveSessionAction(id: string) {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false as const, error: 'unauthenticated' };
  const r = await archiveAiSession(id, ctx);
  if (!r.ok) return { ok: false as const, error: r.error.messageKey };
  revalidatePath('/ai-assistant');
  return { ok: true as const };
}

export async function sendMessageAction(input: {
  sessionId: string;
  content: string;
  useReasoning?: boolean;
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
  return { ok: true as const, reply: r.value.reply, messageId: r.value.assistantMessageId };
}
