/**
 * DeepSeek chat-completions client — ADR-0013 + T-0171 (Phase 2).
 *
 * Documentation reference (fetched 2026-05-24):
 *   - https://api-docs.deepseek.com/quick_start/pricing
 *   - https://api-docs.deepseek.com/guides/function_calling
 *   - https://api-docs.deepseek.com/guides/thinking_mode
 *   - https://api-docs.deepseek.com/guides/tool_calls
 *
 * Important model notes:
 *   - Legacy aliases `deepseek-chat` and `deepseek-reasoner` are scheduled
 *     for deprecation on 2026-07-24 and map to `deepseek-v4-flash`.
 *   - `deepseek-v4-pro` is the thinking model the owner asked for and
 *     supports tool calling. Per the docs, when thinking mode is active
 *     the parameters `temperature`, `top_p`, `presence_penalty`, and
 *     `frequency_penalty` are silently ignored — we omit them.
 *   - Thinking mode returns `reasoning_content` alongside `content`; on
 *     subsequent turns that contain `tool_calls` the previous
 *     `reasoning_content` MUST be replayed or the API answers 400.
 */

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_THINKING_MODEL = 'deepseek-v4-pro';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | AiContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
  /** Returned only by thinking models; we replay it in follow-up turns. */
  reasoning_content?: string;
}

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AiCompletionRequest {
  model?: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** OpenAI-compatible tools array. Pass only what the caller's RBAC allows. */
  tools?: AiToolDefinition[];
  /** Tell the model whether it must use a tool. Defaults to 'auto'. */
  toolChoice?: 'auto' | 'none' | 'required';
  /** When true, omit unsupported parameters and surface reasoning_content. */
  thinkingMode?: boolean;
}

export interface AiCompletionResponse {
  content: string;
  modelUsed: string;
  promptTokens?: number;
  completionTokens?: number;
  toolCalls?: AiToolCall[];
  reasoningContent?: string;
}

export interface AiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningModel: string;
  temperature: number;
  maxTokens: number;
}

let cachedConfig: AiProviderConfig | null = null;

export function isAiAssistantEnabled(): boolean {
  return process.env['AI_ASSISTANT_ENABLED'] !== 'false';
}

export function loadProviderConfig(): AiProviderConfig {
  if (cachedConfig?.apiKey) return cachedConfig;
  const apiKey = process.env['DEEPSEEK_API_KEY'] ?? process.env['AI_PROVIDER_KEY'] ?? '';
  const config = {
    baseUrl: process.env['AI_PROVIDER_BASE_URL'] ?? DEFAULT_BASE_URL,
    apiKey,
    model: process.env['AI_PROVIDER_MODEL'] ?? DEFAULT_MODEL,
    reasoningModel: process.env['AI_PROVIDER_REASONING_MODEL'] ?? DEFAULT_THINKING_MODEL,
    temperature: Number.parseFloat(process.env['AI_PROVIDER_TEMPERATURE'] ?? '0.4'),
    maxTokens: Number.parseInt(process.env['AI_PROVIDER_MAX_TOKENS'] ?? '2048', 10),
  };
  if (apiKey) {
    cachedConfig = config;
  }
  return config;
}

export function resetProviderConfigCache(): void {
  cachedConfig = null;
}

export function isThinkingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  // The v4-pro family always reasons; reasoner is the legacy alias.
  return lower.includes('reasoner') || lower.includes('-pro');
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export async function aiComplete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
  const config = loadProviderConfig();
  if (!config.apiKey) {
    throw new AiProviderError(
      'AI provider API key is not configured. Set DEEPSEEK_API_KEY in the environment.',
      500,
    );
  }
  const model = req.model ?? config.model;
  const thinking = req.thinkingMode ?? isThinkingModel(model);

  const payload: Record<string, unknown> = {
    model,
    messages: req.messages,
    max_tokens: req.maxTokens ?? config.maxTokens,
  };

  // Per docs §thinking_mode, these parameters are silently ignored by
  // thinking models. We omit them to keep the request payload clean.
  if (!thinking) {
    payload.temperature = req.temperature ?? config.temperature;
  }

  if (req.tools && req.tools.length > 0) {
    payload.tools = req.tools;
    payload.tool_choice = req.toolChoice ?? 'auto';
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    // 60 s safety bound — thinking mode can take ~10-20 s on long
    // conversations; 60 s gives margin while still timing out a hang.
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    throw new AiProviderError(
      `AI provider responded with ${response.status}`,
      response.status,
      body,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        reasoning_content?: string;
        tool_calls?: AiToolCall[];
      };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };

  const message = data.choices?.[0]?.message ?? {};
  return {
    content: message.content ?? '',
    modelUsed: data.model ?? model,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    toolCalls: message.tool_calls && message.tool_calls.length > 0 ? message.tool_calls : undefined,
    reasoningContent: message.reasoning_content,
  };
}
