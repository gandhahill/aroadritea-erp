'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { AuditTrailFilters, AuditTrailRow } from './actions';

export function AuditTrailClient({
  rows,
  filters,
}: {
  rows: AuditTrailRow[];
  filters: AuditTrailFilters;
}) {
  const t = useTranslations('audit');
  const router = useRouter();

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
                    <td className="px-4 py-3 font-mono text-xs text-brand-ink-3">{row.entityId}</td>
                    <td className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-brand-red">
                          {t('viewDiff')}
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-brand-cream p-3 text-xs text-brand-ink">
                          {JSON.stringify(
                            { before: row.before, after: row.after, metadata: row.metadata },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
