'use client';

import { Pagination } from '@/components/pagination';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { AuditTrailFilters, AuditTrailPageData } from './actions';

export function AuditTrailClient({
  data,
  filters,
}: {
  data: AuditTrailPageData;
  filters: AuditTrailFilters;
}) {
  const t = useTranslations('audit');
  const pagination = useTranslations('common.pagination');
  const router = useRouter();
  const rows = data.rows;
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const key of ['entityType', 'action', 'actor', 'from', 'to']) {
      const value = String(formData.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    router.push(`/audit?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <form
        action={applyFilters}
        className="grid gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 md:grid-cols-6"
      >
        <FilterInput label={t('entityType')} name="entityType" defaultValue={filters.entityType} />
        <label className="space-y-1">
          <span className="text-xs font-semibold text-brand-ink-3">{t('action')}</span>
          <select
            name="action"
            defaultValue={filters.action ?? ''}
            className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
          >
            <option value="">{t('allActions')}</option>
            {[
              'create',
              'update',
              'delete',
              'post',
              'reverse',
              'approve',
              'reject',
              'submit',
              'void',
              'refund',
              'open',
              'close',
              'login',
              'logout',
              'login_failed',
            ].map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <FilterInput label={t('actor')} name="actor" defaultValue={filters.actor} />
        <FilterInput label={t('from')} name="from" type="date" defaultValue={filters.from} />
        <FilterInput label={t('to')} name="to" type="date" defaultValue={filters.to} />
        <button
          type="submit"
          className="self-end rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
        >
          {t('apply')}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <div className="border-b border-brand-cream-3 px-4 py-3 text-sm font-semibold text-brand-ink">
          {t('latest', { count: rows.length })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-brand-cream-1 text-xs uppercase tracking-wide text-brand-ink-3">
              <tr>
                <th className="px-4 py-3 text-left">{t('time')}</th>
                <th className="px-4 py-3 text-left">{t('actor')}</th>
                <th className="px-4 py-3 text-left">{t('action')}</th>
                <th className="px-4 py-3 text-left">{t('entityType')}</th>
                <th className="px-4 py-3 text-left">{t('entityId')}</th>
                <th className="px-4 py-3 text-left">{t('change')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-2">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-brand-cream-1/50">
                    <td className="px-4 py-3 text-brand-ink-3">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(row.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-brand-ink">{row.userLabel}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-red/10 px-2 py-1 text-xs font-semibold text-brand-red">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink">{row.entityType}</td>
                    <td className="px-4 py-3 text-xs text-brand-ink-3">
                      {maskIdentifier(row.entityId)}
                    </td>
                    <td className="px-4 py-3">
                      <FieldDiff before={row.before} after={row.after} />
                      {row.metadata ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-semibold text-brand-ink-3 hover:text-brand-red">
                            Detail teknis
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-brand-cream p-2 text-[10px] text-brand-ink-3">
                            {JSON.stringify(
                              { before: row.before, after: row.after, metadata: row.metadata },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={data.page} totalItems={data.total} pageSize={data.pageSize} />
      </div>
    </div>
  );

  function goToPage(page: number) {
    const params = new URLSearchParams();
    for (const key of ['entityType', 'action', 'actor', 'from', 'to'] as const) {
      const value = filters[key];
      if (value) params.set(key, value);
    }
    params.set('page', String(page));
    router.push(`/audit?${params.toString()}`);
  }
}

/**
 * Render a human-readable diff of audit-log `before` / `after` JSON blobs.
 *
 * Strategy: union the keys, drop noise columns (timestamps, audit IDs),
 * and show only the fields that actually changed. Long values are
 * truncated. Nested objects are stringified compactly.
 */
function FieldDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeObj = isObject(before) ? before : {};
  const afterObj = isObject(after) ? after : {};
  const NOISE = new Set([
    'updatedAt',
    'updated_at',
    'createdAt',
    'created_at',
    'updatedBy',
    'updated_by',
    'version',
  ]);
  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).filter(
    (k) => !NOISE.has(k),
  );

  const rows = keys
    .map((key) => ({
      key,
      before: beforeObj[key],
      after: afterObj[key],
    }))
    .filter((r) => !shallowEqual(r.before, r.after));

  if (rows.length === 0) {
    if (Object.keys(beforeObj).length === 0 && Object.keys(afterObj).length === 0) {
      return <span className="text-xs text-brand-ink-3">—</span>;
    }
    return <span className="text-xs text-brand-ink-3">Tidak ada perubahan field</span>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-wrap items-baseline gap-1">
          <span className="font-semibold text-brand-ink">{humanizeKey(r.key)}:</span>
          {Object.keys(beforeObj).length > 0 ? (
            <>
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">
                {renderValue(r.before)}
              </span>
              <span className="text-brand-ink-3">→</span>
            </>
          ) : null}
          <span className="rounded bg-brand-jade/10 px-1.5 py-0.5 text-brand-jade">
            {renderValue(r.after)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function renderValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') {
    return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const s = JSON.stringify(value);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return '[object]';
  }
}

function maskIdentifier(value: string): string {
  if (!value) return '-';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return 'internal-record';
  }
  return value.length > 24 ? `${value.slice(0, 21)}...` : value;
}

function FilterInput({
  label,
  name,
  type = 'text',
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-brand-ink-3">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red"
      />
    </label>
  );
}
