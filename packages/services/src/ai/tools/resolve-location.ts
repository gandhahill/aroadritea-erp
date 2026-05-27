import { and, db, eq, ilike, inArray, or, sql } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { getAuthorizedLocations } from '../../iam';
import { flattenLocalizedName, lookupTokens, normaliseLookup } from './lookup';

export const ResolveLocationInputSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(10).optional(),
});

export type ResolveLocationInput = z.infer<typeof ResolveLocationInputSchema>;

export interface LocationCandidate {
  id: string;
  code: string;
  name: Record<string, unknown>;
  type: string;
  status: string;
}

export interface ResolveLocationOutput {
  found: boolean;
  needs_clarification?: boolean;
  location?: LocationCandidate;
  candidates?: LocationCandidate[];
}

function normalise(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function toLocationCandidate(r: {
  id: string;
  code: string;
  name: unknown;
  type: string;
  status: string;
}): LocationCandidate {
  return {
    id: r.id,
    code: r.code,
    name: r.name as Record<string, unknown>,
    type: r.type,
    status: r.status,
  };
}

function locationSearchText(candidate: LocationCandidate): string {
  return normaliseLookup(
    [candidate.id, candidate.code, flattenLocalizedName(candidate.name), candidate.type].join(' '),
  );
}

function scoreLocationCandidate(
  candidate: LocationCandidate,
  query: string,
  tokens: string[],
): number {
  const normalizedQuery = normaliseLookup(query);
  const searchText = locationSearchText(candidate);
  let score = 0;
  if (normaliseLookup(candidate.id) === normalizedQuery) score += 120;
  if (normaliseLookup(candidate.code) === normalizedQuery) score += 110;
  if (normaliseLookup(flattenLocalizedName(candidate.name)) === normalizedQuery) score += 100;
  if (normaliseLookup(candidate.code).startsWith(normalizedQuery)) score += 40;
  if (searchText.includes(normalizedQuery)) score += 30;
  for (const token of tokens) {
    if (searchText.includes(token)) score += 12;
  }
  if (candidate.status === 'active') score += 4;
  if (candidate.type === 'store') score += 2;
  return score;
}

function rankLocationCandidates(
  rows: Array<{
    id: string;
    code: string;
    name: unknown;
    type: string;
    status: string;
  }>,
  query: string,
  tokens: string[],
  limit: number,
): LocationCandidate[] {
  const byId = new Map<string, LocationCandidate>();
  for (const row of rows) byId.set(row.id, toLocationCandidate(row));
  return [...byId.values()]
    .sort(
      (a, b) =>
        scoreLocationCandidate(b, query, tokens) - scoreLocationCandidate(a, query, tokens) ||
        a.code.localeCompare(b.code),
    )
    .slice(0, limit);
}

export async function findLocationCandidates(
  raw: string,
  ctx: AuditContext,
  limit = 5,
): Promise<LocationCandidate[]> {
  const query = normalise(raw);
  if (!query) return [];
  const pattern = `%${query}%`;
  const tokens = lookupTokens(query);
  const matchCondition = or(
    eq(locations.id, query),
    ilike(locations.code, query),
    ilike(locations.code, pattern),
    sql`${locations.name}->>'id' ILIKE ${pattern}`,
    sql`${locations.name}->>'en' ILIKE ${pattern}`,
    sql`${locations.name}->>'zh' ILIKE ${pattern}`,
  );
  if (!matchCondition) return [];
  const scope = await getAuthorizedLocations(ctx.userId, 'ai.assistant.use');
  if (scope.scope === 'location' && scope.locationIds.length === 0) return [];

  const locationScopeCondition =
    scope.scope === 'global' ? undefined : inArray(locations.id, scope.locationIds);

  const selectRows = (condition: ReturnType<typeof or>, rowLimit: number) =>
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        type: locations.type,
        status: locations.status,
      })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), condition, locationScopeCondition))
      .limit(rowLimit);

  let rows = await selectRows(matchCondition, limit);
  if (rows.length === 0 && tokens.length > 0) {
    const tokenCondition = and(
      ...tokens.map((token) => {
        const tokenPattern = `%${token}%`;
        return or(
          ilike(locations.code, tokenPattern),
          sql`${locations.name}->>'id' ILIKE ${tokenPattern}`,
          sql`${locations.name}->>'en' ILIKE ${tokenPattern}`,
          sql`${locations.name}->>'zh' ILIKE ${tokenPattern}`,
        );
      }),
    );
    if (tokenCondition) rows = await selectRows(tokenCondition, Math.max(limit, 10));
  }

  return rankLocationCandidates(rows, query, tokens, limit);
}

export async function resolveLocationRef(
  raw: string | undefined,
  ctx: AuditContext,
): Promise<LocationCandidate | null> {
  const query = normalise(raw || ctx.locationId || '');
  if (!query) return null;
  const candidates = await findLocationCandidates(query, ctx, 5);
  if (candidates.length === 0) return null;
  const exact =
    candidates.find(
      (c) =>
        c.id === query ||
        c.code.toLowerCase() === query.toLowerCase() ||
        String((c.name as { id?: unknown }).id ?? '').toLowerCase() === query.toLowerCase() ||
        String((c.name as { en?: unknown }).en ?? '').toLowerCase() === query.toLowerCase(),
    ) ?? candidates[0];
  return exact ?? null;
}

export async function resolveLocationTool(
  input: ResolveLocationInput,
  ctx: AuditContext,
): Promise<ResolveLocationOutput> {
  const candidates = await findLocationCandidates(input.query, ctx, input.limit ?? 5);
  if (candidates.length === 0) return { found: false, candidates: [] };
  if (candidates.length === 1) return { found: true, location: candidates[0] };
  return { found: true, needs_clarification: true, candidates };
}
