/**
 * Conversation runner — ADR-0013 + T-0171 (Phase 2).
 *
 * Takes a user's new message (optionally with image attachments), loads
 * the session history, optionally exposes RBAC-scoped tools to the model,
 * loops tool-call rounds until the model returns plain text, and
 * persists every turn + every tool call.
 *
 * Hard limits:
 *   - Per-user hourly cap configured in Settings -> AI Assistant.
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
  type AiCompletionRequest,
  type AiCompletionResponse,
  AiProviderError,
  type AiToolCall,
  aiComplete,
  aiCompleteStream,
  isAiAssistantEnabled,
  isThinkingModel,
  loadProviderConfig,
} from './client';
import { getAiSession, getRecentUserMessageCount, recordChatMessage } from './session';
import { getAiRuntimeConfig } from './settings';
import { executeTool, listAvailableTools } from './tools/registry';

const HISTORY_CONTEXT_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 4;

interface ChatAttachment {
  url: string;
  mimeType: string;
}

function buildAttachmentNote(attachments: ChatAttachment[] | undefined): string {
  if (!attachments || attachments.length === 0) return '';
  return [
    '',
    '[Uploaded attachments]',
    ...attachments.map((a, idx) => `${idx + 1}. ${a.url} (${a.mimeType})`),
    '',
    'Important: the current DeepSeek chat provider is text/tool-only and must not receive image_url content directly. If the user wants receipt OCR, call ocr_receipt_struk with the attachment URL; if OCR is not supported, ask the user for the missing receipt values in text.',
  ].join('\n');
}

function extractAttachmentsFromPayload(payload: unknown): ChatAttachment[] | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const raw = (payload as { attachments?: unknown }).attachments;
  if (!Array.isArray(raw)) return undefined;
  const out: ChatAttachment[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { url?: unknown }).url === 'string' &&
      typeof (item as { mimeType?: unknown }).mimeType === 'string'
    ) {
      out.push({
        url: (item as { url: string }).url,
        mimeType: (item as { mimeType: string }).mimeType,
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

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
    '- Resolve natural names first: when users mention product/outlet names like "Osmanthus Fresh Tea" or "Plaza 1", use ERP lookup tools with those names. Do not ask users for SKU, product ID, or location ID unless the lookup returns multiple ambiguous candidates.',
    '- If product/location lookup returns no match or ambiguous candidates, call list_products or list_locations, then ask "Mungkin maksud Anda..." with real options from the tool output. Never invent nearby product/outlet names.',
    '- If required business data is missing (qty, date, payment method, channel, nominal), ask one concise follow-up question with the missing fields.',
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
      '- Write-capable tools only create drafts; the user must approve a confirmation card before anything is committed.',
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
  attachments?: Array<{ url: string; mimeType: string; fileName?: string; fileSize?: number }>;
  useReasoning?: boolean;
}

export async function sendChatMessage(
  input: SendChatMessageInput,
  ctx: AuditContext,
  stream?: {
    onReasoningDelta?: (text: string) => void | Promise<void>;
    onContentDelta?: (text: string) => void | Promise<void>;
    onToolCall?: (toolName: string) => void | Promise<void>;
    onToolResult?: (toolName: string) => void | Promise<void>;
  },
): Promise<
  Result<{
    assistantMessageId: string;
    reply: string;
    reasoning?: string;
    toolRoundsExecuted: number;
  }>
> {
  const runtimeConfig = await getAiRuntimeConfig(ctx.tenantId);
  if (!isAiAssistantEnabled() || !runtimeConfig.enabled) {
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
  if (hourlyCount >= runtimeConfig.hourlyCap) {
    return err(
      AppError.businessRule('ai.message.rateLimit', {
        cap: runtimeConfig.hourlyCap,
        windowMinutes: 60,
      }),
    );
  }

  const attachmentNote = buildAttachmentNote(input.attachments);

  const userMessage: AiChatMessage = {
    role: 'user',
    content: `${trimmed}${attachmentNote}`.trim(),
  };

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

  const modelToUse = input.useReasoning ? runtimeConfig.reasoningModel : runtimeConfig.model;
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
      .map<AiChatMessage>((m) => {
        // Re-attach the [Uploaded attachments] note for past user turns
        // that carried images. Without this, on a follow-up turn the
        // model only sees plain text and "forgets" the receipt was ever
        // uploaded — which is exactly the bug the cashier hit when they
        // said "itu ada rincian itemnya" and the assistant asked them
        // to re-upload.
        if (m.role === 'user') {
          const note = buildAttachmentNote(extractAttachmentsFromPayload(m.toolPayload));
          return {
            role: 'user',
            content: note ? `${m.content}${note}`.trim() : m.content,
          };
        }
        return { role: 'assistant', content: m.content };
      }),
    userMessage,
  ];

  let assistantContent = '';
  let assistantReasoning: string | undefined;
  let lastTokensIn: number | undefined;
  let lastTokensOut: number | undefined;
  let roundsExecuted = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    let providerResponse: AiCompletionResponse;
    try {
      const completionRequest: AiCompletionRequest = {
        model: modelToUse,
        messages: providerMessages,
        provider: {
          baseUrl: runtimeConfig.baseUrl,
          model: runtimeConfig.model,
          reasoningModel: runtimeConfig.reasoningModel,
          temperature: runtimeConfig.temperature,
          maxTokens: runtimeConfig.maxTokens,
          supportsVision: runtimeConfig.supportsVision,
        },
        temperature: runtimeConfig.temperature,
        maxTokens: runtimeConfig.maxTokens,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: tools.length > 0 ? 'auto' : undefined,
        thinkingMode: thinking,
      };
      providerResponse = stream
        ? await aiCompleteStream(completionRequest, async (delta) => {
            if (delta.type === 'reasoning') await stream.onReasoningDelta?.(delta.text);
            if (delta.type === 'content') await stream.onContentDelta?.(delta.text);
          })
        : await aiComplete(completionRequest);
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
      await stream?.onToolCall?.(call.function.name);
      const result = await runToolCall(ctx, call, input.sessionId, runtimeConfig);
      await stream?.onToolResult?.(call.function.name);
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
    reasoning: assistantReasoning,
    toolRoundsExecuted: roundsExecuted,
  });
}

async function runToolCall(
  ctx: AuditContext,
  call: AiToolCall,
  sessionId: string,
  runtimeConfig: Awaited<ReturnType<typeof getAiRuntimeConfig>>,
): Promise<string> {
  const result = await executeTool(ctx, call.function.name, call.function.arguments, {
    sessionId,
    aiRuntimeConfig: runtimeConfig,
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
