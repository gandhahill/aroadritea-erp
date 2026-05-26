import { and, db, eq, ilike, or, sql } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

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

export async function findLocationCandidates(
  raw: string,
  ctx: AuditContext,
  limit = 5,
): Promise<LocationCandidate[]> {
  const query = normalise(raw);
  if (!query) return [];
  const pattern = `%${query}%`;
  const matchCondition = or(
    eq(locations.id, query),
    ilike(locations.code, query),
    ilike(locations.code, pattern),
    sql`${locations.name}->>'id' ILIKE ${pattern}`,
    sql`${locations.name}->>'en' ILIKE ${pattern}`,
    sql`${locations.name}->>'zh' ILIKE ${pattern}`,
  );
  if (!matchCondition) return [];

  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      status: locations.status,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), matchCondition))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name as Record<string, unknown>,
    type: r.type,
    status: r.status,
  }));
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
