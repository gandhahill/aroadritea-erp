/**
 * Member browser for management — T-0183.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMembersAction } from './actions';

export const metadata: Metadata = { title: 'Member Database' };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const t = await getTranslations('crm.members');
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const limit = 30;

  const result = await listMembersAction({
    search: params.q,
    tier: params.tier,
    activeOnly: true,
    limit,
    offset: (page - 1) * limit,
  });
  const totalPages = result.total && result.total > 0 ? Math.ceil(result.total / limit) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Filter */}
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('search')}</span>
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder={t('searchPlaceholder')}
            className="w-64 rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('tier')}</span>
          <select
            name="tier"
            defaultValue={params.tier ?? ''}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm"
          >
            <option value="">{t('allTiers')}</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white"
        >
          {t('filter')}
        </button>
      </form>

      {result.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {result.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-3 py-2">{t('table.name')}</th>
              <th className="px-3 py-2">{t('table.tier')}</th>
              <th className="px-3 py-2 text-right">{t('table.points')}</th>
              <th className="px-3 py-2 text-right">{t('table.lifetime')}</th>
              <th className="px-3 py-2">{t('table.joinedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {!result.items || result.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              result.items.map((m) => (
                <tr key={m.id} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2">
                    <Link
                      href={`/crm/members/${m.id}`}
                      className="font-medium text-brand-red hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TierBadge tier={m.tier} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {m.points.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-brand-ink-3">
                    {m.lifetimePoints.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-brand-ink-3">{m.joinedAt.slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {result.total && result.total > limit ? (
        <div className="flex items-center justify-between text-xs text-brand-ink-3">
          <span>
            {t('pagination', {
              page,
              total: totalPages,
              count: result.total,
            })}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`?q=${params.q ?? ''}&tier=${params.tier ?? ''}&page=${page - 1}`}
                className="rounded-md border border-brand-cream-3 px-2 py-1 hover:bg-brand-cream-2"
              >
                ← {t('prev')}
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={`?q=${params.q ?? ''}&tier=${params.tier ?? ''}&page=${page + 1}`}
                className="rounded-md border border-brand-cream-3 px-2 py-1 hover:bg-brand-cream-2"
              >
                {t('next')} →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const tone =
    tier === 'gold'
      ? 'bg-amber-50 text-amber-700'
      : tier === 'silver'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-orange-50 text-orange-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}
    >
      {tier}
    </span>
  );
}
