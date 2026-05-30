/**
 * Admin AI log viewer — T-0173.
 *
 * Shows every AI tool call, draft proposal, and message turn across
 * users so the operator can audit how the assistant has been used.
 * Gated by `ai.assistant.admin` (defined in T-0170 seed).
 *
 * Server-rendered; the page itself only does SELECTs. Mutations are
 * not exposed here — the goal is observability, not management.
 */

import { FilterBar, FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { getSession } from '@/lib/auth';
import { and, db, desc, eq, inArray, sql } from '@erp/db';
import { aiActionDrafts, aiChatSessions } from '@erp/db/schema/ai';
import { auditLog } from '@erp/db/schema/audit';
import { users } from '@erp/db/schema/auth';
import { can } from '@erp/services/iam';
import { Table, TableBody, TableCell, TableHead } from '@erp/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ai.audit');
  return { title: `${t('title')}` };
}

export const dynamic = 'force-dynamic';

const ENTITY_FILTERS = [
  'ai_chat_session',
  'ai_chat_message',
  'ai_tool_call',
  'ai_action_draft',
] as const;
type EntityFilter = (typeof ENTITY_FILTERS)[number];

function renderCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    return value.length > 200 ? `${value.slice(0, 197)}...` : value;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 200 ? `${s.slice(0, 197)}...` : s;
  } catch {
    return '[object]';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function HumanReadablePayload({ payload, rawLabel }: { payload: unknown; rawLabel: string }) {
  if (!isObject(payload)) {
    return (
      <pre className="max-w-xs overflow-hidden whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-brand-ink-2">
        {renderCellValue(payload)}
      </pre>
    );
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) return <span className="text-brand-ink-3">—</span>;

  return (
    <div className="space-y-1">
      <ul className="text-[11px] leading-relaxed">
        {keys.map((k) => (
          <li key={k} className="flex flex-wrap items-baseline gap-1">
            <span className="font-semibold text-brand-ink">{humanizeKey(k)}:</span>
            <span className="rounded bg-brand-jade/10 px-1.5 py-0.5 text-brand-jade">
              {renderCellValue(payload[k])}
            </span>
          </li>
        ))}
      </ul>
      <details className="mt-1">
        <summary className="cursor-pointer text-[10px] font-semibold text-brand-ink-3 hover:text-brand-red">
          {rawLabel}
        </summary>
        <pre className="mt-1 max-h-32 max-w-xs overflow-auto rounded-md bg-brand-cream-1 p-2 font-mono text-[9px] leading-snug text-brand-ink-3">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function fmtDate(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export default async function AiAssistantLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string;
    user?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const sessionUser = session.user as Record<string, unknown>;
  const userId = String(sessionUser.id ?? '');
  const tenantId = String(sessionUser.tenantId ?? 'default');
  const [isAdmin, t] = await Promise.all([
    can(userId, 'ai.assistant.admin'),
    getTranslations('ai.audit'),
  ]);
  if (!isAdmin) notFound();

  const params = await searchParams;
  const entity = ENTITY_FILTERS.includes(params.entity as EntityFilter)
    ? (params.entity as EntityFilter)
    : null;
  const userFilter = params.user?.trim() || null;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize ?? '50') || 50));

  const conditions = [eq(auditLog.tenantId, tenantId)];
  if (entity) {
    conditions.push(eq(auditLog.entityType, entity));
  } else {
    conditions.push(inArray(auditLog.entityType, ENTITY_FILTERS as unknown as string[]));
  }
  if (userFilter) conditions.push(eq(auditLog.userId, userFilter));

  const whereClause = and(...conditions);

  const [{ count = 0 } = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(auditLog)
    .where(whereClause);

  const rows = await db
    .select()
    .from(auditLog)
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Hydrate display names so admins read "Lintang" not "ulid_abc123".
  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, displayName: users.displayName, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((u) => [u.id, u.displayName || u.email]));

  // Session count / draft count summary panel.
  const [sessionStat = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(aiChatSessions)
    .where(eq(aiChatSessions.tenantId, tenantId));
  const draftStat = await db
    .select({
      status: aiActionDrafts.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(aiActionDrafts)
    .where(eq(aiActionDrafts.tenantId, tenantId))
    .groupBy(aiActionDrafts.status);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
          <p className="text-xs uppercase tracking-wide text-brand-ink-3">{t('stat.sessions')}</p>
          <p className="mt-1 text-xl font-semibold text-brand-ink">{sessionStat.count}</p>
        </div>
        {draftStat.map((d) => (
          <div key={d.status} className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">
              {t('stat.draft')} {d.status}
            </p>
            <p className="mt-1 text-xl font-semibold text-brand-ink">{d.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET">
        <FilterBar>
          <FilterField label={t('table.entity')}>
            <select
              name="entity"
              defaultValue={entity ?? ''}
              className="h-9 w-44 rounded-md border border-brand-cream-3 bg-white px-3 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            >
              <option value="">{t('filter.all')}</option>
              {ENTITY_FILTERS.map((e) => (
                <option key={e} value={e}>
                  {t(`entities.${e}`) ?? e}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="User ID">
            <input
              name="user"
              defaultValue={userFilter ?? ''}
              placeholder="ulid…"
              className="h-9 w-72 rounded-md border border-brand-cream-3 bg-white px-3 font-mono text-xs focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </FilterField>
          <button
            type="submit"
            className="h-9 rounded-md bg-brand-red px-4 text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            {t('filter.show')}
          </button>
        </FilterBar>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <Table>
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <TableHead className="px-3 py-2">{t('table.time')}</TableHead>
              <TableHead className="px-3 py-2">{t('table.user')}</TableHead>
              <TableHead className="px-3 py-2">{t('table.action')}</TableHead>
              <TableHead className="px-3 py-2">{t('table.entity')}</TableHead>
              <TableHead className="px-3 py-2">{t('table.entityId')}</TableHead>
              <TableHead className="px-3 py-2">{t('table.detail')}</TableHead>
            </tr>
          </thead>
          <TableBody>
            {rows.length === 0 ? (
              <tr>
                <TableCell colSpan={6} className="px-3 py-8 text-center text-sm text-brand-ink-3">
                  {t('table.empty')}
                </TableCell>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-brand-cream-3 text-xs">
                  <TableCell className="px-3 py-2 font-mono text-[11px] text-brand-ink-2">
                    {fmtDate(row.createdAt!)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-brand-ink-2">
                    {userMap.get(row.userId) ?? row.userId}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-brand-cream-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink-2">
                      {row.action}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-brand-ink-2">
                    {t(`entities.${row.entityType as EntityFilter}`) ?? row.entityType}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-mono text-[11px] text-brand-ink-3">
                    {row.entityId}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <HumanReadablePayload
                      payload={row.after ?? row.before}
                      rawLabel={t('table.rawJson')}
                    />
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination currentPage={page} totalItems={count} pageSize={pageSize} />
    </div>
  );
}
