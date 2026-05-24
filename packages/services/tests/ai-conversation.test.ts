/**
 * AI assistant — conversation runner regression.
 *
 * Covers:
 *  - rate-limit gate (>= cap rejects without provider call)
 *  - empty / oversized content rejection
 *  - provider stub records both user and assistant turns
 *  - kill-switch via AI_ASSISTANT_ENABLED=false
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
vi.mock('../src/ai/client', () => ({
  aiComplete: (...args: unknown[]) => aiComplete(...args),
  isAiAssistantEnabled: () => process.env.AI_ASSISTANT_ENABLED !== 'false',
  loadProviderConfig: () => ({
    baseUrl: 'http://stub',
    apiKey: 'test-key',
    model: 'deepseek-chat',
    reasoningModel: 'deepseek-reasoner',
    temperature: 0.4,
    maxTokens: 2048,
  }),
  resetProviderConfigCache: () => undefined,
  AiProviderError: class extends Error {},
}));

import { sendChatMessage } from '../src/ai/conversation';

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: '' };

beforeEach(() => {
  selectQueue = [];
  inserts.length = 0;
  updates.length = 0;
  aiComplete.mockReset();
  delete process.env.AI_ASSISTANT_ENABLED;
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

  it('returns disabled error when AI_ASSISTANT_ENABLED=false', async () => {
    process.env.AI_ASSISTANT_ENABLED = 'false';
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

  it('rejects when rate-limit cap reached', async () => {
    process.env.AI_ASSISTANT_PER_USER_HOURLY_CAP = '5';
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
