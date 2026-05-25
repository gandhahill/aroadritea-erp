/**
 * Tool: web_search — T-0179 (Exa Search backend, replaces Brave per
 * user request 2026-05-25).
 *
 * Opt-in tool gated by `ai_chat_sessions.allow_web_search`. The tool
 * itself is dispatched from the conversation runner only when the
 * session row has the flag set, so the model never sees a hint that
 * web search exists unless the operator explicitly enabled it.
 *
 * Backend: Exa Search API (https://api.exa.ai/search) when
 * `EXA_SEARCH_API_KEY` is configured. Otherwise the tool returns a
 * friendly "not configured" structured result so the model can
 * apologise + advise the user instead of throwing.
 *
 * Doc: https://exa.ai/docs/reference/search-api-guide-for-coding-agents
 *
 * No PII goes to Exa — only the user's query string. The caller
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
  /** Publication date if Exa knows it. ISO 8601 or empty string. */
  publishedDate?: string;
}

export interface WebSearchOutput {
  ok: boolean;
  reason?: 'not_configured' | 'upstream_error' | 'rate_limited';
  query: string;
  hits: WebSearchHit[];
}

/**
 * Subset of the Exa `/search` response shape — only the fields we
 * actually surface to the model. Exa returns additional fields like
 * `requestId`, `searchType`, `costDollars`, `output.grounding` that
 * we intentionally drop to keep the assistant's prompt slim and
 * focused on the snippet content.
 */
interface ExaResponse {
  results?: Array<{
    title?: string;
    url?: string;
    publishedDate?: string | null;
    text?: string;
    summary?: string;
    highlights?: string[];
  }>;
}

export async function webSearchTool(
  input: WebSearchInput,
  _ctx: AuditContext,
): Promise<WebSearchOutput> {
  const apiKey = process.env.EXA_SEARCH_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: 'not_configured',
      query: input.query,
      hits: [],
    };
  }

  const numResults = input.count ?? 5;

  // Exa rewards calling its `auto` search type for coding agents — it
  // picks between fast/instant/deep based on the query. We request
  // highlights (concise excerpts) instead of full `text` to keep the
  // tool result small enough for the next model turn.
  const body = JSON.stringify({
    query: input.query,
    type: 'auto',
    numResults,
    contents: {
      highlights: true,
      summary: true,
    },
  });

  let res: Response;
  try {
    res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body,
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

  const data = (await res.json().catch(() => null)) as ExaResponse | null;
  const hits = (data?.results ?? []).slice(0, numResults).map((r) => {
    // Prefer Exa's pre-computed summary, fall back to first highlight,
    // then to a truncated slice of `text`. Hard cap at 600 chars so a
    // single result doesn't blow up the model's context.
    const snippet =
      r.summary?.trim() ||
      r.highlights?.[0]?.trim() ||
      (r.text ?? '').slice(0, 600).trim();
    return {
      title: (r.title ?? '').trim(),
      url: (r.url ?? '').trim(),
      snippet,
      publishedDate: r.publishedDate ?? '',
    };
  });
  return { ok: true, query: input.query, hits };
}
