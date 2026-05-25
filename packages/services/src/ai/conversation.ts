/**
 * Conversation runner — ADR-0013 + T-0171 (Phase 2).
 *
 * Takes a user's new message (optionally with image attachments), loads
 * the session history, optionally exposes RBAC-scoped tools to the model,
 * loops tool-call rounds until the model returns plain text, and
 * persists every turn + every tool call.
 *
 * Hard limits:
 *   - 30 messages / user / hour (env override AI_ASSISTANT_PER_USER_HOURLY_CAP).
 *   - Last 20 stored messages are passed back to the provider; older
 *     context is summarised by a "[truncated previous messages]" stub.
 *   - The user message is truncated to 8000 chars before send.
 *   - Each turn allows at most 4 tool-call rounds (defends against
 *     models stuck in infinite tool loops).
 *
 * Thinking-mode caveat (per DeepSeek docs): when a tool call is made,
 * the previous `reasoning_content` MUST be replayed in the next request
 * or the API returns 400. We persist it on the assistant turn row and
 * replay it via the in-memory `providerMessages` queue.
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import {
  type AiChatMessage,
  type AiContentPart,
  AiProviderError,
  type AiToolCall,
  aiComplete,
  isAiAssistantEnabled,
  isThinkingModel,
  loadProviderConfig,
} from './client';
import { getAiSession, getRecentUserMessageCount, recordChatMessage } from './session';
import { executeTool, listAvailableTools } from './tools/registry';

const HARD_USER_TURN_CAP_PER_HOUR = Number.parseInt(
  process.env.AI_ASSISTANT_PER_USER_HOURLY_CAP ?? '30',
  10,
);
const HISTORY_CONTEXT_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 4;

function buildSystemPrompt(ctx: AuditContext, toolsExposed: number): string {
  const lines: string[] = [
    'You are the Aroadri Tea ERP in-product assistant.',
    'You help cashiers, supervisors, accountants, and management at a small',
    'Indonesian bubble-tea shop. Reply in the same language the user wrote',
    'in (Bahasa Indonesia, English, or Mandarin). Default to Bahasa',
    'Indonesia when unsure.',
    '',
    'Caller identity (do NOT echo verbatim):',
    `- user_id: ${ctx.userId}`,
    `- tenant_id: ${ctx.tenantId}`,
    `- location_id: ${ctx.locationId ?? 'unknown'}`,
    '',
    'House rules:',
    '- You may not invent transaction numbers, journal IDs, prices,',
    '  product names, or employee IDs. If you do not know, say so.',
    '- You may not give legal, tax, or medical advice. Refer them to the',
    '  Accountant or HR Manager.',
    '- Keep replies short: 3–6 sentences unless walking through a workflow.',
  ];

  if (toolsExposed > 0) {
    lines.push('');
    lines.push('Tool guidance:');
    lines.push(
      `- You have ${toolsExposed} tool(s) available. Use them when the user asks about live data, codebase questions, or error reports — do NOT guess.`,
    );
    lines.push(
      '- Tools you can call are read-only in this phase; you cannot create, edit, or delete data.',
    );
    lines.push(
      '- When the user reports a real bug, broken page, or system error, call `log_helpdesk_ticket_draft`. The draft surfaces a confirmation card; once they click Setujui the ticket goes to handlers automatically (in-app + email). Do NOT tell them to "kontak admin" or "email IT" — file the ticket for them.',
    );
    lines.push(
      '- Use `request_admin_help` only for ambiguous "I am stuck, please help" requests where filing a ticket would be premature — it just drafts a forwardable template the user copies.',
    );
  } else {
    lines.push('');
    lines.push(
      "- You currently have NO tools. If the user asks you to read live data or create/edit records, explain that the feature isn't enabled and point them to the relevant page (e.g. /pos/orders, /hr/sop, /accounting/journals).",
    );
  }

  return lines.join('\n');
}

export interface SendChatMessageInput {
  sessionId: string;
  content: string;
  /** Optional image attachments — pass an URL the AI provider can fetch
   *  or a `data:image/...;base64,…` URI. */
  attachments?: Array<{ url: string; mimeType: string }>;
  useReasoning?: boolean;
}

export async function sendChatMessage(
  input: SendChatMessageInput,
  ctx: AuditContext,
): Promise<
  Result<{
    assistantMessageId: string;
    reply: string;
    toolRoundsExecuted: number;
  }>
> {
  if (!isAiAssistantEnabled()) {
    return err(AppError.businessRule('ai.assistant.disabled'));
  }
  const trimmed = (input.content ?? '').trim();
  if (!trimmed && (!input.attachments || input.attachments.length === 0)) {
    return err(AppError.validation('ai.message.empty'));
  }
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

  // Build the new user turn — multimodal content when attachments are
  // present, plain string otherwise (cheaper to serialise).
  const userMessage: AiChatMessage =
    input.attachments && input.attachments.length > 0
      ? {
          role: 'user',
          content: [
            ...(trimmed ? [{ type: 'text' as const, text: trimmed }] : []),
            ...input.attachments.map((a) => ({
              type: 'image_url' as const,
              image_url: { url: a.url },
            })),
          ] satisfies AiContentPart[],
        }
      : { role: 'user', content: trimmed };

  // Persist the user turn first so the audit trail captures it even if
  // the provider call fails downstream.
  await recordChatMessage({
    sessionId: input.sessionId,
    ctx,
    role: 'user',
    content: trimmed,
    toolPayload: input.attachments ? { attachments: input.attachments } : undefined,
  });

  const config = loadProviderConfig();
  if (!config.apiKey) {
    return err(AppError.businessRule('ai.provider.notConfigured'));
  }

  const modelToUse = input.useReasoning ? config.reasoningModel : config.model;
  const thinking = isThinkingModel(modelToUse);

  // T-0177 — web_search is gated by the session-level opt-in flag.
  // Pass a hint into listAvailableTools so the registry can include /
  // exclude it without leaking the tool name to a non-opted-in session.
  const tools = await listAvailableTools(ctx, {
    includeWebSearch: session.allowWebSearch,
  });
  const history = messages.slice(-HISTORY_CONTEXT_MESSAGES);
  const providerMessages: AiChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx, tools.length) },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map<AiChatMessage>((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    userMessage,
  ];

  let assistantContent = '';
  let assistantReasoning: string | undefined;
  let lastTokensIn: number | undefined;
  let lastTokensOut: number | undefined;
  let roundsExecuted = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    let providerResponse;
    try {
      providerResponse = await aiComplete({
        model: modelToUse,
        messages: providerMessages,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: tools.length > 0 ? 'auto' : undefined,
        thinkingMode: thinking,
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
    lastTokensIn = providerResponse.promptTokens;
    lastTokensOut = providerResponse.completionTokens;
    assistantContent = providerResponse.content;
    assistantReasoning = providerResponse.reasoningContent;

    const toolCalls = providerResponse.toolCalls ?? [];
    if (toolCalls.length === 0) break;

    if (round === MAX_TOOL_ROUNDS) {
      // Force the model to stop calling tools by appending a system
      // nudge. We still record the partial assistant content so the
      // user sees what we got.
      providerMessages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: toolCalls,
        ...(assistantReasoning ? { reasoning_content: assistantReasoning } : {}),
      });
      providerMessages.push({
        role: 'system',
        content:
          'Tool-call budget exceeded. Summarise what you found in the tool calls and answer the user without calling more tools.',
      });
      continue;
    }

    roundsExecuted += 1;

    // Replay the assistant tool-call message + reasoning (required by
    // DeepSeek thinking mode) before the tool messages.
    providerMessages.push({
      role: 'assistant',
      content: assistantContent,
      tool_calls: toolCalls,
      ...(assistantReasoning ? { reasoning_content: assistantReasoning } : {}),
    });

    for (const call of toolCalls) {
      const result = await runToolCall(ctx, call, input.sessionId);
      providerMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  const assistantMessageId = await recordChatMessage({
    sessionId: input.sessionId,
    ctx,
    role: 'assistant',
    content: assistantContent,
    promptTokens: lastTokensIn,
    completionTokens: lastTokensOut,
    toolPayload: assistantReasoning ? { reasoning_content: assistantReasoning } : undefined,
  });

  return ok({
    assistantMessageId,
    reply: assistantContent,
    toolRoundsExecuted: roundsExecuted,
  });
}

async function runToolCall(
  ctx: AuditContext,
  call: AiToolCall,
  sessionId: string,
): Promise<string> {
  const result = await executeTool(ctx, call.function.name, call.function.arguments, {
    sessionId,
  });
  if (!result.ok) {
    // The tool message format expects a string. Surface the error code
    // and message so the model can apologise / retry differently.
    const payload = {
      ok: false,
      error: result.error.messageKey ?? 'tool_error',
      details: result.error.details ?? null,
    };
    await recordChatMessage({
      sessionId,
      ctx,
      role: 'tool',
      content: JSON.stringify(payload),
      toolName: call.function.name,
      toolPayload: { call_id: call.id, args_raw: call.function.arguments, payload },
    });
    return JSON.stringify(payload);
  }
  const payload = { ok: true, output: result.value.output };
  await recordChatMessage({
    sessionId,
    ctx,
    role: 'tool',
    content: JSON.stringify(payload),
    toolName: call.function.name,
    toolPayload: { call_id: call.id, args_raw: call.function.arguments, payload },
  });
  return JSON.stringify(payload);
}
