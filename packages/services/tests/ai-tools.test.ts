/**
 * AI tools — T-0171 (Phase 2).
 *
 * Covers:
 *  - request_admin_help template generation (no DB writes required).
 *  - search_codebase allow-list + max_results cap.
 *  - registry.executeTool guards: permission denied, invalid arguments,
 *    audit log written for every outcome.
 *  - conversation.sendChatMessage tool-call loop:
 *      • first round returns tool_calls → tools execute → second round
 *        returns plain text → assistant turn persisted.
 *      • reasoning_content is replayed on the assistant tool-call turn.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Resolve the repo root by walking up from the current working directory
// until we find the workspace marker (pnpm-workspace.yaml). This works
// whether vitest is launched from packages/services or the workspace root.
function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}

const REPO_ROOT = findRepoRoot(process.cwd());

interface SelectStep {
  rows: unknown[];
}

let selectQueue: SelectStep[] = [];
const inserts: Array<{ table: string; values: unknown }> = [];

function nextSelectRows(): unknown[] {
  return selectQueue.shift()?.rows ?? [];
}

function tableName(table: unknown): string {
  return String(
    (table as { _: { name?: string } })?._?.name ??
      (table as { name?: string })?.name ??
      'unknown',
  );
}

vi.mock('@erp/db', () => ({
  db: {
    select: () => ({
      from: () => {
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
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ id: 'x' }]) }),
      }),
    }),
  },
  and: () => undefined,
  asc: () => undefined,
  desc: () => undefined,
  eq: () => undefined,
  gte: () => undefined,
  isNull: () => undefined,
  sql: () => undefined,
}));

// `iam.can` is the gate every tool runs through — we control it per test.
const canMock = vi.fn(async () => true);
vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => ({ ok: true })),
  can: (...args: unknown[]) => canMock(...(args as [])),
}));

const ctx = { userId: 'u1', tenantId: 'tenant-1', locationId: 'loc-1' };

beforeEach(() => {
  selectQueue = [];
  inserts.length = 0;
  canMock.mockReset();
  canMock.mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ───────────────────────────────────────────────────────────────────────
// request_admin_help
// ───────────────────────────────────────────────────────────────────────

describe('request_admin_help tool', () => {
  it('produces a template that mentions caller + URL + error summary', async () => {
    const { requestAdminHelpTool } = await import('../src/ai/tools/request-admin-help');
    const out = await requestAdminHelpTool(
      {
        error_summary: 'POS gagal void',
        observed_message: 'pos.void.versionMismatch',
        current_url: '/pos/orders',
        time_of_event: 'tadi sekitar 14:30 WIB',
      },
      ctx,
    );

    expect(out.template).toContain('POS gagal void');
    expect(out.template).toContain('/pos/orders');
    expect(out.template).toContain('pos.void.versionMismatch');
    expect(out.template).toContain('u1');
    expect(out.template).toContain('tenant-1');
    expect(out.fields_used.user_id).toBe('u1');
    expect(out.fields_used.location_id).toBe('loc-1');
    expect(out.recommended_action).toContain('admin');
  });

  it('still works with only the required summary', async () => {
    const { requestAdminHelpTool } = await import('../src/ai/tools/request-admin-help');
    const out = await requestAdminHelpTool({ error_summary: 'Form macet' }, ctx);
    expect(out.template).toContain('Form macet');
    expect(out.fields_used.observed_message).toBeNull();
    expect(out.fields_used.current_url).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────
// search_codebase
// ───────────────────────────────────────────────────────────────────────

describe('search_codebase tool', () => {
  // Use a tiny fixture tree so the test never walks the full repo (which
  // flakes under heavy parallel vitest load). The budget override gives
  // headroom on slow Windows runners.
  const FIXTURE_ROOT = path.resolve(__dirname, 'fixtures/codebase-stub');

  beforeEach(() => {
    process.env.AROADRI_REPO_ROOT = FIXTURE_ROOT;
    process.env.AROADRI_SEARCH_BUDGET_MS = '15000';
  });

  it(
    'finds a known string under packages/',
    async () => {
      const { searchCodebaseTool } = await import('../src/ai/tools/search-codebase');
      const out = await searchCodebaseTool({ query: 'sopDocuments', max_results: 5 }, ctx);
      expect(out.matches.length).toBeGreaterThan(0);
      expect(
        out.matches.every(
          (m) =>
            m.file.startsWith('packages/') ||
            m.file.startsWith('docs/') ||
            m.file.startsWith('apps/') ||
            m.file.startsWith('scripts/'),
        ),
      ).toBe(true);
    },
    15_000,
  );

  it(
    'caps results at max_results',
    async () => {
      const { searchCodebaseTool } = await import('../src/ai/tools/search-codebase');
      const out = await searchCodebaseTool({ query: 'export', max_results: 3 }, ctx);
      expect(out.matches.length).toBeLessThanOrEqual(3);
    },
    15_000,
  );

  it(
    'never returns paths outside the allow-list',
    async () => {
      const { searchCodebaseTool } = await import('../src/ai/tools/search-codebase');
      const out = await searchCodebaseTool({ query: 'TODO', max_results: 5 }, ctx);
      for (const m of out.matches) {
        expect(m.file.startsWith('node_modules')).toBe(false);
        expect(m.file.startsWith('.git')).toBe(false);
        expect(m.file.startsWith('storage')).toBe(false);
        expect(m.file).not.toMatch(/^\.env/);
      }
    },
    15_000,
  );
});

// ───────────────────────────────────────────────────────────────────────
// registry.executeTool — permission + audit + invalid args
// ───────────────────────────────────────────────────────────────────────

describe('executeTool', () => {
  it('refuses when caller lacks the required permission', async () => {
    canMock.mockResolvedValueOnce(false);
    const { executeTool } = await import('../src/ai/tools/registry');
    const result = await executeTool(
      ctx,
      'request_admin_help',
      JSON.stringify({ error_summary: 'POS macet saat close shift' }),
    );
    expect(result.ok).toBe(false);
    // Audit row must still be written so the refusal stays attributable.
    const auditRows = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_tool_call',
    );
    expect(auditRows.length).toBe(1);
    expect((auditRows[0]?.values as { after: { outcome: string } }).after.outcome).toBe(
      'forbidden',
    );
  });

  it('rejects malformed arguments before calling the executor', async () => {
    const { executeTool } = await import('../src/ai/tools/registry');
    // request_admin_help requires error_summary; we omit it.
    const result = await executeTool(ctx, 'request_admin_help', JSON.stringify({}));
    expect(result.ok).toBe(false);
    const auditRows = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_tool_call',
    );
    expect(auditRows.length).toBe(1);
    expect((auditRows[0]?.values as { after: { outcome: string } }).after.outcome).toBe(
      'invalid',
    );
  });

  it('returns ok and writes an audit row for a successful run', async () => {
    const { executeTool } = await import('../src/ai/tools/registry');
    const result = await executeTool(
      ctx,
      'request_admin_help',
      JSON.stringify({ error_summary: 'POS hang saat close shift' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.output as { template: string }).template).toContain('POS hang');
    }
    const auditRows = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        (i.values as { entityType?: string }).entityType === 'ai_tool_call',
    );
    expect(auditRows.length).toBe(1);
    expect((auditRows[0]?.values as { after: { outcome: string } }).after.outcome).toBe('ok');
  });

  it('returns NOT_FOUND for an unknown tool', async () => {
    const { executeTool } = await import('../src/ai/tools/registry');
    const result = await executeTool(ctx, 'fly_to_the_moon', '{}');
    expect(result.ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────
// conversation tool-call loop integration
// ───────────────────────────────────────────────────────────────────────

describe('sendChatMessage tool-call loop', () => {
  // Override the registry mock locally to exercise the real loop logic.
  // Resetting individual mocks isn't enough because vitest hoists vi.mock,
  // so we mock per-test via vi.doMock with dynamic import.

  it('loops until the model returns plain text and persists the round count', async () => {
    vi.resetModules();

    selectQueue = [
      {
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
      { rows: [] }, // messages list
      { rows: [{ count: 0 }] }, // hourly user count
    ];

    const aiCompleteMock = vi
      .fn()
      // round 1: model wants to call request_admin_help
      .mockResolvedValueOnce({
        content: '',
        modelUsed: 'deepseek-v4-pro',
        reasoningContent: 'thinking-step',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'request_admin_help',
              arguments: JSON.stringify({ error_summary: 'POS gagal close shift' }),
            },
          },
        ],
      })
      // round 2: model produces the user-facing text
      .mockResolvedValueOnce({
        content: 'Berikut template untuk dikirim ke admin: ...',
        modelUsed: 'deepseek-v4-pro',
      });

    vi.doMock('@erp/db', () => ({
      db: {
        select: () => ({
          from: () => {
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
        update: () => ({
          set: () => ({
            where: () => ({ returning: () => Promise.resolve([{ id: 'x' }]) }),
          }),
        }),
      },
      and: () => undefined,
      asc: () => undefined,
      desc: () => undefined,
      eq: () => undefined,
      gte: () => undefined,
      isNull: () => undefined,
      sql: () => undefined,
    }));
    vi.doMock('../src/iam', () => ({
      requirePermission: vi.fn(async () => ({ ok: true })),
      can: vi.fn(async () => true),
    }));
    vi.doMock('../src/ai/client', () => ({
      aiComplete: aiCompleteMock,
      isAiAssistantEnabled: () => true,
      isThinkingModel: () => true,
      loadProviderConfig: () => ({
        baseUrl: 'http://stub',
        apiKey: 'test-key',
        model: 'deepseek-v4-flash',
        reasoningModel: 'deepseek-v4-pro',
        temperature: 0.4,
        maxTokens: 2048,
      }),
      resetProviderConfigCache: () => undefined,
      AiProviderError: class extends Error {},
    }));

    const { sendChatMessage } = await import('../src/ai/conversation');
    const result = await sendChatMessage(
      { sessionId: 's1', content: 'Tolong bantu lapor ke admin', useReasoning: true },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolRoundsExecuted).toBe(1);
      expect(result.value.reply).toContain('template');
    }
    expect(aiCompleteMock).toHaveBeenCalledTimes(2);

    // Provider must have received reasoning_content on the assistant
    // tool-call turn in the second request (otherwise DeepSeek 400s).
    const secondCallMessages = (aiCompleteMock.mock.calls[1]?.[0] as {
      messages: Array<Record<string, unknown>>;
    }).messages;
    const assistantToolCallTurn = secondCallMessages.find(
      (m) => m.role === 'assistant' && Array.isArray((m as { tool_calls?: unknown[] }).tool_calls),
    );
    expect(assistantToolCallTurn).toBeDefined();
    expect((assistantToolCallTurn as { reasoning_content?: string }).reasoning_content).toBe(
      'thinking-step',
    );

    // Persisted turn count: user + tool + assistant = 3 message rows.
    const messageInserts = inserts.filter(
      (i) =>
        typeof i.values === 'object' &&
        i.values !== null &&
        'role' in (i.values as Record<string, unknown>),
    );
    const roles = messageInserts.map((i) => (i.values as { role: string }).role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
    expect(roles).toContain('tool');
  });
});
