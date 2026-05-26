/**
 * AI assistant — conversation runner regression.
 *
 * Covers:
 *  - rate-limit gate (>= cap rejects without provider call)
 *  - empty / oversized content rejection
 *  - provider stub records both user and assistant turns
 *  - UI/database kill-switch
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface SelectStep {
  table: string;
  rows: unknown[];
}

let selectQueue: SelectStep[] = [];
const inserts: Array<{ table: string; values: unknown }> = [];
const updates: Array<{ table: string; set: unknown }> = [];

function nextSelectRows(): unknown[] {
  return selectQueue.shift()?.rows ?? [];
}

vi.mock('@erp/db', () => {
  const tableName = (table: unknown) =>
    String(
      (table as { _: { name?: string } })?._?.name ??
        (table as { name?: string })?.name ??
        'unknown',
    );

  return {
    db: {
      select: () => ({
        from: () => {
          // Drizzle's chainable builder behaves like a thenable; tests
          // for sendChatMessage need both `.where().limit()` (session
          // lookup) and `.where().orderBy()` (messages list) to resolve
          // to the next queued row-set. We expose `then` so plain
          // `await chain` also returns rows.
          const chain: {
            where: () => typeof chain;
            orderBy: () => typeof chain;
            limit: () => Promise<unknown[]>;
            offset: () => typeof chain;
            then: (resolve: (value: unknown[]) => void) => void;
          } = {
            where: () => chain,
            orderBy: () => chain,
            limit: () => Promise.resolve(nextSelectRows()),
            offset: () => chain,
            // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
            then: (resolve) => resolve(nextSelectRows()),
          };
          return chain;
        },
      }),
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          inserts.push({ table: tableName(table), values });
          return Promise.resolve();
        },
      }),
      update: (table: unknown) => ({
        set: (set: unknown) => {
          updates.push({ table: tableName(table), set });
          return {
            where: () => ({ returning: () => Promise.resolve([{ id: 'session-1' }]) }),
          };
        },
      }),
    },
    and: () => undefined,
    asc: () => undefined,
    desc: () => undefined,
    eq: () => undefined,
    isNull: () => undefined,
    sql: () => undefined,
  };
});

vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => ({ ok: true })),
  can: vi.fn(async () => true),
}));

const aiComplete = vi.fn();
let runtimeConfig = {
  enabled: true,
  baseUrl: 'http://stub',
  model: 'deepseek-v4-flash',
  reasoningModel: 'deepseek-v4-pro',
  temperature: 0.4,
  maxTokens: 2048,
  hourlyCap: 30,
  supportsVision: false,
};
vi.mock('../src/ai/client', () => ({
  aiComplete: (...args: unknown[]) => aiComplete(...args),
  aiCompleteStream: (...args: unknown[]) => aiComplete(...args),
  isAiAssistantEnabled: () => true,
  isThinkingModel: (model: string) =>
    model.toLowerCase().includes('reasoner') || model.toLowerCase().includes('-pro'),
  loadProviderConfig: () => ({
    baseUrl: 'http://stub',
    apiKey: 'test-key',
    model: 'deepseek-v4-flash',
    reasoningModel: 'deepseek-v4-pro',
    temperature: 0.4,
    maxTokens: 2048,
    supportsVision: false,
  }),
  resetProviderConfigCache: () => undefined,
  AiProviderError: class extends Error {},
}));

vi.mock('../src/ai/settings', () => ({
  getAiRuntimeConfig: vi.fn(async () => runtimeConfig),
}));

// Phase 2 added a tool registry — short-circuit it so the existing chat
// tests don't depend on tool plumbing.
vi.mock('../src/ai/tools/registry', () => ({
  listAvailableTools: vi.fn(async () => []),
  executeTool: vi.fn(async () => ({ ok: true, value: { output: null, log: {} } })),
  _resetToolsForTests: () => undefined,
}));

import { sendChatMessage } from '../src/ai/conversation';

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: '' };

beforeEach(() => {
  selectQueue = [];
  inserts.length = 0;
  updates.length = 0;
  aiComplete.mockReset();
  runtimeConfig = {
    enabled: true,
    baseUrl: 'http://stub',
    model: 'deepseek-v4-flash',
    reasoningModel: 'deepseek-v4-pro',
    temperature: 0.4,
    maxTokens: 2048,
    hourlyCap: 30,
    supportsVision: false,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendChatMessage', () => {
  it('rejects empty content without hitting the provider', async () => {
    const result = await sendChatMessage({ sessionId: 's1', content: '   ' }, ctx);
    expect(result.ok).toBe(false);
    expect(aiComplete).not.toHaveBeenCalled();
  });

  it('rejects content over 8000 characters', async () => {
    const big = 'a'.repeat(8001);
    const result = await sendChatMessage({ sessionId: 's1', content: big }, ctx);
    expect(result.ok).toBe(false);
    expect(aiComplete).not.toHaveBeenCalled();
  });

  it('returns disabled error when the UI setting disables AI', async () => {
    runtimeConfig = { ...runtimeConfig, enabled: false };
    const result = await sendChatMessage({ sessionId: 's1', content: 'halo' }, ctx);
    expect(result.ok).toBe(false);
    expect(aiComplete).not.toHaveBeenCalled();
  });

  it('persists user + assistant turn when provider succeeds', async () => {
    // getAiSession: 1) session row, 2) messages list (empty)
    selectQueue = [
      {
        table: 'ai_chat_sessions',
        rows: [
          {
            id: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            title: 'Tes',
            status: 'active',
            allowWebSearch: 'false',
            modelKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      },
      { table: 'ai_chat_messages', rows: [] },
      // getRecentUserMessageCount: COUNT row
      { table: 'count', rows: [{ count: 0 }] },
    ];
    aiComplete.mockResolvedValueOnce({
      content: 'Halo! Apa yang bisa saya bantu?',
      modelUsed: 'deepseek-chat',
      promptTokens: 12,
      completionTokens: 8,
    });

    const result = await sendChatMessage({ sessionId: 's1', content: 'halo' }, ctx);
    expect(result.ok).toBe(true);
    expect(aiComplete).toHaveBeenCalledTimes(1);

    // The drizzle mock returns 'unknown' for table.name; identify
    // message inserts by their distinctive payload shape (`role` field).
    const messageInserts = inserts.filter(
      (i) => typeof i.values === 'object' && i.values !== null && 'role' in i.values,
    );
    expect(messageInserts.length).toBeGreaterThanOrEqual(2); // user + assistant
    const roles = messageInserts.map((i) => (i.values as { role: string }).role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');

    // Audit entries are inserts where `entityType === 'ai_chat_message'`.
    const auditInserts = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_chat_message',
    );
    expect(auditInserts.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps uploaded images out of the DeepSeek message payload', async () => {
    selectQueue = [
      {
        table: 'ai_chat_sessions',
        rows: [
          {
            id: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            title: 'Tes',
            status: 'active',
            allowWebSearch: 'false',
            modelKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      },
      { table: 'ai_chat_messages', rows: [] },
      { table: 'count', rows: [{ count: 0 }] },
    ];
    aiComplete.mockResolvedValueOnce({
      content: 'Saya butuh total penjualan di struk.',
      modelUsed: 'deepseek-v4-flash',
    });

    const result = await sendChatMessage(
      {
        sessionId: 's1',
        content: 'tolong baca struk ini',
        attachments: [{ url: '/api/uploads/ai-attachments/x.jpg', mimeType: 'image/jpeg' }],
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    const request = aiComplete.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const last = request.messages.at(-1);
    expect(typeof last?.content).toBe('string');
    expect(String(last?.content)).toContain('/api/uploads/ai-attachments/x.jpg');
    expect(String(last?.content)).not.toContain('"image_url"');
  });

  it('rejects when rate-limit cap reached', async () => {
    runtimeConfig = { ...runtimeConfig, hourlyCap: 5 };
    selectQueue = [
      {
        table: 'ai_chat_sessions',
        rows: [
          {
            id: 's1',
            tenantId: 'tenant-1',
            userId: 'u1',
            title: 'Tes',
            status: 'active',
            allowWebSearch: 'false',
            modelKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ],
      },
      { table: 'ai_chat_messages', rows: [] },
      { table: 'count', rows: [{ count: 500 }] },
    ];

    const result = await sendChatMessage({ sessionId: 's1', content: 'halo' }, ctx);
    expect(result.ok).toBe(false);
    expect(aiComplete).not.toHaveBeenCalled();
  });
});
