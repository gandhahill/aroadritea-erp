/**
 * Member detail for management — T-0183.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchMemberDetailAction } from '../actions';
import { PointsAdjustClient } from './points-adjust-client';

export const metadata: Metadata = { title: 'Member Detail | Aroadri ERP' };

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');
  const { id } = await params;
  const t = await getTranslations('crm.members');
  const result = await fetchMemberDetailAction(id);
  if (result.error || !result.data) notFound();
  const m = result.data;
  const canAdjust = await can(userId, 'crm.member.adjustPoints');

  return (
    <div className="space-y-6">
      <PageHeader
        title={m.name}
        description={`${t('memberSince')} ${m.joinedAt.slice(0, 10)} · ${m.city ?? '—'}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t('table.tier')} value={m.tier} />
        <Card label={t('table.points')} value={m.points.toLocaleString('id-ID')} highlight />
        <Card label={t('table.lifetime')} value={m.lifetimePoints.toLocaleString('id-ID')} />
        <Card label={t('lastEarned')} value={m.lastEarnedAt ? m.lastEarnedAt.slice(0, 10) : '—'} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
          <h2 className="text-sm font-semibold text-brand-ink">{t('contactSection')}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-brand-ink-3">{t('email')}</dt>
            <dd className="text-brand-ink">{m.email ?? '—'}</dd>
            <dt className="text-brand-ink-3">{t('phone')}</dt>
            <dd className="text-brand-ink">{m.phone ?? '—'}</dd>
            <dt className="text-brand-ink-3">{t('address')}</dt>
            <dd className="text-brand-ink">{m.address ?? '—'}</dd>
            <dt className="text-brand-ink-3">{t('city')}</dt>
            <dd className="text-brand-ink">{m.city ?? '—'}</dd>
            <dt className="text-brand-ink-3">{t('birthDate')}</dt>
            <dd className="text-brand-ink">{m.birthDate ? m.birthDate.slice(0, 10) : '—'}</dd>
          </dl>
        </div>

        {canAdjust ? (
          <PointsAdjustClient memberId={m.id} currentBalance={m.points} />
        ) : (
          <div className="rounded-xl border border-brand-cream-3 bg-card p-4 text-sm text-brand-ink-3">
            {t('adjustNoPermission')}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card">
        <header className="border-b border-brand-cream-3 px-4 py-3">
          <h2 className="text-sm font-semibold text-brand-ink">{t('recentPoints')}</h2>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-3 py-2">{t('tx.date')}</th>
              <th className="px-3 py-2">{t('tx.type')}</th>
              <th className="px-3 py-2 text-right">{t('tx.delta')}</th>
              <th className="px-3 py-2 text-right">{t('tx.balanceAfter')}</th>
              <th className="px-3 py-2">{t('tx.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {m.recentTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-brand-ink-3">
                  {t('noTransactions')}
                </td>
              </tr>
            ) : (
              m.recentTransactions.map((t) => (
                <tr key={t.id} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2 text-brand-ink-3">{t.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2 capitalize text-brand-ink-2">{t.type}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      t.delta < 0 ? 'text-rose-600' : 'text-brand-jade'
                    }`}
                  >
                    {t.delta > 0 ? '+' : ''}
                    {t.delta.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {t.balanceAfter.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-brand-ink-3">{t.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p
        className={`mt-1 text-lg font-bold capitalize ${highlight ? 'text-brand-red' : 'text-brand-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}
