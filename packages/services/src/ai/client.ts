/**
 * DeepSeek chat-completions client — ADR-0013.
 *
 * DeepSeek exposes an OpenAI-compatible /v1/chat/completions endpoint, so
 * we use the bare REST API rather than pulling in the openai SDK.
 *
 * Config priority (highest wins):
 *  1. DB row `cms_settings.ai.provider.config` (set via Settings UI).
 *  2. Environment variables `DEEPSEEK_API_KEY` / `AI_PROVIDER_*`.
 *  3. Built-in defaults (DeepSeek v4 pro thinking).
 *
 * `AI_ASSISTANT_ENABLED=false` disables the assistant entirely; the UI
 * hides the chat widget when `isAiAssistantEnabled()` is false.
 */

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_THINKING_MODEL = 'deepseek-reasoner';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_call_id?: string;
}

export interface AiCompletionRequest {
  model?: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiCompletionResponse {
  content: string;
  modelUsed: string;
  promptTokens?: number;
  completionTokens?: number;
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
  return process.env.AI_ASSISTANT_ENABLED !== 'false';
}

export function loadProviderConfig(): AiProviderConfig {
  if (cachedConfig) return cachedConfig;
  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.AI_PROVIDER_KEY ?? '';
  cachedConfig = {
    baseUrl: process.env.AI_PROVIDER_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    model: process.env.AI_PROVIDER_MODEL ?? DEFAULT_MODEL,
    reasoningModel: process.env.AI_PROVIDER_REASONING_MODEL ?? DEFAULT_THINKING_MODEL,
    temperature: Number.parseFloat(process.env.AI_PROVIDER_TEMPERATURE ?? '0.4'),
    maxTokens: Number.parseInt(process.env.AI_PROVIDER_MAX_TOKENS ?? '2048', 10),
  };
  return cachedConfig;
}

/** Reset the cached provider config — used by tests and after the
 *  admin saves a new value via the Settings UI. */
export function resetProviderConfigCache(): void {
  cachedConfig = null;
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
  const payload = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? config.temperature,
    max_tokens: req.maxTokens ?? config.maxTokens,
  };

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    // 60 s safety bound — DeepSeek "pro thinking" can be slow but should
    // never legitimately exceed a minute for one user turn.
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
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  return {
    content,
    modelUsed: data.model ?? model,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}
