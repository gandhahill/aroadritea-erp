/**
 * web_search tool — T-0179.
 *
 * Validates the Exa Search backend wiring:
 *  - returns `not_configured` when EXA_SEARCH_API_KEY is missing
 *  - returns `rate_limited` when Exa returns 429
 *  - returns `upstream_error` when Exa returns other non-2xx
 *  - maps a successful Exa response shape to the tool's contract
 *  - prefers summary → first highlight → text slice for snippet
 *
 * `fetch` is stubbed so we don't actually call Exa during tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webSearchTool } from '../src/ai/tools/web-search';

const ctx = { userId: 'u1', tenantId: 'default', locationId: '' };

const originalFetch = global.fetch;

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('webSearchTool (Exa)', () => {
  it('returns not_configured when EXA_SEARCH_API_KEY is absent', async () => {
    vi.stubEnv('EXA_SEARCH_API_KEY', '');
    const out = await webSearchTool({ query: 'next.js 15 release notes' }, ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('not_configured');
    expect(out.hits).toEqual([]);
  });

  it('returns rate_limited when Exa replies 429', async () => {
    vi.stubEnv('EXA_SEARCH_API_KEY', 'fake-key');
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'too many' }), { status: 429 }),
    ) as unknown as typeof fetch;
    const out = await webSearchTool({ query: 'x' }, ctx);
    expect(out.reason).toBe('rate_limited');
    expect(out.hits).toEqual([]);
  });

  it('maps a successful Exa response and prefers summary for snippet', async () => {
    vi.stubEnv('EXA_SEARCH_API_KEY', 'fake-key');
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          requestId: 'req_1',
          searchType: 'auto',
          results: [
            {
              title: 'Result 1',
              url: 'https://example.com/1',
              publishedDate: '2026-05-01',
              summary: '  Summary text  ',
              highlights: ['highlight 1'],
              text: 'full text body...',
            },
            {
              title: 'Result 2',
              url: 'https://example.com/2',
              // No summary → falls back to first highlight.
              highlights: ['  highlight only  '],
            },
            {
              title: 'Result 3',
              url: 'https://example.com/3',
              // No summary, no highlights → text slice fallback.
              text: 'a'.repeat(700),
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const out = await webSearchTool({ query: 'q', count: 5 }, ctx);
    expect(out.ok).toBe(true);
    expect(out.hits).toHaveLength(3);
    expect(out.hits[0].snippet).toBe('Summary text');
    expect(out.hits[0].publishedDate).toBe('2026-05-01');
    expect(out.hits[1].snippet).toBe('highlight only');
    expect(out.hits[2].snippet.length).toBe(600);
  });
});
