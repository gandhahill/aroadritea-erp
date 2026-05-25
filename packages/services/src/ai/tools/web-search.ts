/**
 * Tool: web_search — T-0177.
 *
 * Opt-in tool gated by `ai_chat_sessions.allow_web_search`. The tool
 * itself is dispatched from the conversation runner only when the
 * session row has the flag set, so the model never sees a hint that
 * web search exists unless the operator explicitly enabled it.
 *
 * Backend: Brave Search API (https://api.search.brave.com/) when
 * `BRAVE_SEARCH_API_KEY` is configured. Otherwise the tool returns a
 * friendly "not configured" structured result so the model can
 * apologise + advise the user.
 *
 * No PII goes to Brave — only the user's query string. The caller
 * already had to opt in at session level for this code path to even
 * load.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const WebSearchInputSchema = z.object({
  query: z.string().min(2).max(500),
  /** Cap on returned hits (1–10, default 5). */
  count: z.number().int().min(1).max(10).optional(),
});

export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  ok: boolean;
  reason?: 'not_configured' | 'upstream_error' | 'rate_limited';
  query: string;
  hits: WebSearchHit[];
}

interface BraveResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
}

export async function webSearchTool(
  input: WebSearchInput,
  _ctx: AuditContext,
): Promise<WebSearchOutput> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: 'not_configured',
      query: input.query,
      hits: [],
    };
  }

  const count = input.count ?? 5;
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', input.query);
  url.searchParams.set('count', String(count));
  url.searchParams.set('safesearch', 'moderate');

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return {
      ok: false,
      reason: 'upstream_error',
      query: input.query,
      hits: [],
    };
  }

  if (res.status === 429) {
    return { ok: false, reason: 'rate_limited', query: input.query, hits: [] };
  }
  if (!res.ok) {
    return { ok: false, reason: 'upstream_error', query: input.query, hits: [] };
  }

  const data = (await res.json().catch(() => null)) as BraveResponse | null;
  const hits = (data?.web?.results ?? []).slice(0, count).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.description ?? '',
  }));
  return { ok: true, query: input.query, hits };
}
