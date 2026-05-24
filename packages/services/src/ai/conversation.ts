/**
 * Conversation runner — ADR-0013.
 *
 * Takes a user's new message, loads the session history, calls the
 * provider, persists both turns, and returns the assistant reply. Tool
 * orchestration will be added in Phase 2 — for now the assistant has
 * read-only chat capability and is briefed via a system prompt that
 * describes its scope and the user's RBAC.
 *
 * Hard limits:
 *   - 30 messages / user / hour (configurable later)
 *   - Last 20 messages are passed to the provider; older context is
 *     summarised by a "[truncated previous messages]" placeholder.
 *   - The user message is truncated to 8000 chars before send.
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import {
  type AiChatMessage,
  AiProviderError,
  aiComplete,
  isAiAssistantEnabled,
  loadProviderConfig,
} from './client';
import {
  getAiSession,
  getRecentUserMessageCount,
  recordChatMessage,
} from './session';

const HARD_USER_TURN_CAP_PER_HOUR = Number.parseInt(
  process.env.AI_ASSISTANT_PER_USER_HOURLY_CAP ?? '30',
  10,
);
const HISTORY_CONTEXT_MESSAGES = 20;

function buildSystemPrompt(ctx: AuditContext): string {
  return [
    'You are the Aroadri Tea ERP in-product assistant.',
    'You help cashiers, supervisors, accountants, and management at a small',
    'Indonesian bubble-tea shop. Reply in the same language the user',
    'wrote in (Bahasa Indonesia, English, or Mandarin). Default to Bahasa',
    'Indonesia when unsure.',
    '',
    `Caller identity (do NOT echo verbatim):`,
    `- user_id: ${ctx.userId}`,
    `- tenant_id: ${ctx.tenantId}`,
    `- location_id: ${ctx.locationId ?? 'unknown'}`,
    '',
    'House rules:',
    '- You currently have NO write tools. If the user asks you to create or',
    '  edit data, explain that the feature is being rolled out (Phase 2)',
    '  and link them to the relevant module path under /accounting, /pos,',
    '  /inventory, /hr, /correspondence, /settings, or /reporting.',
    '- You may not invent transaction numbers, journal IDs, prices,',
    '  product names, or employee IDs. If you do not know, say so.',
    '- You may not give legal, tax, or medical advice. Refer them to the',
    '  Accountant or HR Manager.',
    '- When the user reports an error, ask for the URL, the time, and a',
    '  short reproduction, then propose a chat template they can send to',
    '  the admin (no name-and-shame).',
    '- Keep replies short: 3–6 sentences unless walked through a workflow.',
  ].join('\n');
}

export async function sendChatMessage(
  input: { sessionId: string; content: string; useReasoning?: boolean },
  ctx: AuditContext,
): Promise<Result<{ assistantMessageId: string; reply: string }>> {
  if (!isAiAssistantEnabled()) {
    return err(AppError.businessRule('ai.assistant.disabled'));
  }
  const trimmed = (input.content ?? '').trim();
  if (!trimmed) return err(AppError.validation('ai.message.empty'));
  if (trimmed.length > 8000) {
    return err(AppError.validation('ai.message.tooLong', { max: 8000 }));
  }

  const sessionResult = await getAiSession(input.sessionId, ctx);
  if (!sessionResult.ok) return sessionResult;
  const { session, messages } = sessionResult.value;
  if (session.ownerUserId !== ctx.userId) {
    return err(AppError.forbidden('ai.session.forbidden'));
  }
  if (session.status !== 'active') {
    return err(AppError.businessRule('ai.session.archived'));
  }

  const hourlyCount = await getRecentUserMessageCount(ctx);
  if (hourlyCount >= HARD_USER_TURN_CAP_PER_HOUR) {
    return err(
      AppError.businessRule('ai.message.rateLimit', {
        cap: HARD_USER_TURN_CAP_PER_HOUR,
        windowMinutes: 60,
      }),
    );
  }

  // Persist the user turn first so the audit trail captures it even if
  // the provider call fails downstream.
  await recordChatMessage({
    sessionId: input.sessionId,
    ctx,
    role: 'user',
    content: trimmed,
  });

  const config = loadProviderConfig();
  if (!config.apiKey) {
    return err(AppError.businessRule('ai.provider.notConfigured'));
  }

  const history = messages.slice(-HISTORY_CONTEXT_MESSAGES);
  const providerMessages: AiChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...history.map((m) => ({
      role: (m.role === 'tool' ? 'assistant' : m.role) as
        | 'user'
        | 'assistant'
        | 'system',
      content: m.content,
    })),
    { role: 'user', content: trimmed },
  ];

  let providerResponse;
  try {
    providerResponse = await aiComplete({
      model: input.useReasoning ? config.reasoningModel : config.model,
      messages: providerMessages,
    });
  } catch (e) {
    if (e instanceof AiProviderError) {
      return err(
        AppError.internal('ai.provider.error', {
          status: e.status,
          message: e.message,
        }),
      );
    }
    return err(AppError.internal('ai.provider.error', e));
  }

  const assistantMessageId = await recordChatMessage({
    sessionId: input.sessionId,
    ctx,
    role: 'assistant',
    content: providerResponse.content,
    promptTokens: providerResponse.promptTokens,
    completionTokens: providerResponse.completionTokens,
  });

  return ok({ assistantMessageId, reply: providerResponse.content });
}
