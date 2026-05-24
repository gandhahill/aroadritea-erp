/**
 * AI session + message persistence — ADR-0013.
 *
 * All operations honour ai.assistant.use; admins with ai.assistant.admin
 * can also read everyone else's sessions in their tenant.
 */

import { and, asc, db, desc, eq, isNull, sql } from '@erp/db';
import {
  aiChatAttachments,
  aiChatMessages,
  aiChatSessions,
} from '@erp/db/schema/ai';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { can, requirePermission } from '../iam';

export interface SessionRow {
  id: string;
  title: string;
  status: string;
  allowWebSearch: boolean;
  modelKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownerUserId: string;
}

function rowOf(raw: typeof aiChatSessions.$inferSelect): SessionRow {
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    allowWebSearch: raw.allowWebSearch === 'true',
    modelKey: raw.modelKey,
    createdAt: raw.createdAt!,
    updatedAt: raw.updatedAt!,
    ownerUserId: raw.userId,
  };
}

export async function listMyAiSessions(
  ctx: AuditContext,
): Promise<Result<SessionRow[]>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.use');
  if (!perm.ok) return perm;
  const rows = await db
    .select()
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.tenantId, ctx.tenantId),
        eq(aiChatSessions.userId, ctx.userId),
        isNull(aiChatSessions.deletedAt),
      ),
    )
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(100);
  return ok(rows.map(rowOf));
}

export async function listAllAiSessionsAdmin(
  ctx: AuditContext,
): Promise<Result<SessionRow[]>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.admin');
  if (!perm.ok) return perm;
  const rows = await db
    .select()
    .from(aiChatSessions)
    .where(
      and(eq(aiChatSessions.tenantId, ctx.tenantId), isNull(aiChatSessions.deletedAt)),
    )
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(500);
  return ok(rows.map(rowOf));
}

export async function createAiSession(
  input: { title?: string; allowWebSearch?: boolean },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.use');
  if (!perm.ok) return perm;

  const id = generateId();
  const now = new Date();
  await db.insert(aiChatSessions).values({
    id,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    title: (input.title?.trim() || 'Percakapan baru').slice(0, 200),
    status: 'active',
    allowWebSearch: input.allowWebSearch ? 'true' : 'false',
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'ai_chat_session',
    entityId: id,
    before: null,
    after: { title: input.title, allowWebSearch: !!input.allowWebSearch },
    metadata: null,
  });

  return ok({ id });
}

export async function getAiSession(
  id: string,
  ctx: AuditContext,
): Promise<Result<{
  session: SessionRow;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    toolName: string | null;
    toolPayload: unknown;
    createdAt: Date;
    requiresConfirmation: boolean;
  }>;
}>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.use');
  if (!perm.ok) return perm;

  const [session] = await db
    .select()
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.tenantId, ctx.tenantId),
        eq(aiChatSessions.id, id),
        isNull(aiChatSessions.deletedAt),
      ),
    )
    .limit(1);
  if (!session) return err(AppError.notFound('ai.session.notFound', { id }));

  // Owner OR admin can read.
  const isAdmin = await can(ctx.userId, 'ai.assistant.admin');
  if (session.userId !== ctx.userId && !isAdmin) {
    return err(AppError.forbidden('ai.session.forbidden'));
  }

  const messages = await db
    .select()
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, id))
    .orderBy(asc(aiChatMessages.createdAt));

  return ok({
    session: rowOf(session),
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolPayload: m.toolPayload,
      createdAt: m.createdAt!,
      requiresConfirmation: m.requiresConfirmation === 'true',
    })),
  });
}

export async function renameAiSession(
  id: string,
  title: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.use');
  if (!perm.ok) return perm;
  const cleanTitle = (title || '').trim().slice(0, 200);
  if (!cleanTitle) return err(AppError.validation('ai.session.titleRequired'));

  const result = await db
    .update(aiChatSessions)
    .set({ title: cleanTitle, updatedAt: new Date(), updatedBy: ctx.userId })
    .where(
      and(
        eq(aiChatSessions.tenantId, ctx.tenantId),
        eq(aiChatSessions.id, id),
        eq(aiChatSessions.userId, ctx.userId),
        isNull(aiChatSessions.deletedAt),
      ),
    )
    .returning({ id: aiChatSessions.id });
  if (result.length === 0) {
    return err(AppError.notFound('ai.session.notFound', { id }));
  }
  return ok(undefined);
}

export async function archiveAiSession(
  id: string,
  ctx: AuditContext,
): Promise<Result<void>> {
  const perm = await requirePermission(ctx.userId, 'ai.assistant.use');
  if (!perm.ok) return perm;
  const now = new Date();
  const result = await db
    .update(aiChatSessions)
    .set({ status: 'archived', deletedAt: now, updatedAt: now, updatedBy: ctx.userId })
    .where(
      and(
        eq(aiChatSessions.tenantId, ctx.tenantId),
        eq(aiChatSessions.id, id),
        eq(aiChatSessions.userId, ctx.userId),
      ),
    )
    .returning({ id: aiChatSessions.id });
  if (result.length === 0) return err(AppError.notFound('ai.session.notFound', { id }));
  return ok(undefined);
}

export async function recordChatMessage(input: {
  sessionId: string;
  ctx: AuditContext;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolPayload?: unknown;
  promptTokens?: number;
  completionTokens?: number;
  requiresConfirmation?: boolean;
}): Promise<string> {
  const id = generateId();
  await db.insert(aiChatMessages).values({
    id,
    sessionId: input.sessionId,
    tenantId: input.ctx.tenantId,
    userId: input.ctx.userId,
    role: input.role,
    content: input.content,
    toolName: input.toolName ?? null,
    toolPayload: input.toolPayload ?? null,
    promptTokens: input.promptTokens ?? null,
    completionTokens: input.completionTokens ?? null,
    requiresConfirmation: input.requiresConfirmation ? 'true' : 'false',
  });

  // Audit every assistant turn (rate-limited via the per-user message cap
  // upstream) so admins can reconstruct AI behaviour after the fact.
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: input.ctx.tenantId,
    userId: input.ctx.userId,
    action: input.role === 'assistant' ? 'create' : 'submit',
    entityType: 'ai_chat_message',
    entityId: id,
    before: null,
    after: {
      sessionId: input.sessionId,
      role: input.role,
      contentPreview: input.content.slice(0, 280),
      toolName: input.toolName ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
    },
    metadata: null,
  });

  // Touch session updatedAt so list view stays sorted by recent activity.
  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, input.sessionId));

  return id;
}

/**
 * Per-user rate-limit gate. Returns the number of messages the user has
 * sent in the trailing hour. Caller compares against the configured cap.
 */
export async function getRecentUserMessageCount(ctx: AuditContext): Promise<number> {
  const [{ count = 0 } = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(aiChatMessages)
    .where(
      and(
        eq(aiChatMessages.tenantId, ctx.tenantId),
        eq(aiChatMessages.userId, ctx.userId),
        eq(aiChatMessages.role, 'user'),
        sql`created_at >= now() - interval '1 hour'`,
      ),
    );
  return count;
}

export async function attachToMessage(input: {
  messageId: string;
  sessionId: string;
  tenantId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<void> {
  await db.insert(aiChatAttachments).values({
    id: generateId(),
    messageId: input.messageId,
    sessionId: input.sessionId,
    tenantId: input.tenantId,
    fileKey: input.fileKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
  });
}
