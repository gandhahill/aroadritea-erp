/**
 * Helpdesk list page — T-0184.
 *
 * Anyone with `helpdesk.view` sees their own tickets; users with
 * `helpdesk.handle` see everything in the tenant. The service does
 * the scoping.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listTicketsAction } from './actions';

export const metadata: Metadata = { title: 'Helpdesk' };

export default async function HelpdeskPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const t = await getTranslations('helpdesk');
  const result = await listTicketsAction({
    status: params.status,
    mine: params.mine === 'true',
  });

  return (
    <main className="space-y-6 p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/helpdesk/new"
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
          >
            {t('newTicket')}
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['', 'open', 'in_progress', 'waiting_reporter', 'resolved', 'closed'] as const).map(
          (s) => (
            <Link
              key={s || 'all'}
              href={`/helpdesk${s ? `?status=${s}` : ''}`}
              className={`rounded-full px-3 py-1 text-xs font-medium border ${
                params.status === s || (!params.status && !s)
                  ? 'bg-brand-ink text-white border-brand-ink'
                  : 'bg-card text-brand-ink-2 border-brand-cream-3 hover:bg-brand-cream-2'
              }`}
            >
              {s ? t(`status.${s}` as 'status.open') : t('status.all')}
            </Link>
          ),
        )}
      </div>

      {result.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {result.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-3 py-2">{t('table.number')}</th>
              <th className="px-3 py-2">{t('table.subject')}</th>
              <th className="px-3 py-2">{t('table.reporter')}</th>
              <th className="px-3 py-2">{t('table.assignee')}</th>
              <th className="px-3 py-2">{t('table.priority')}</th>
              <th className="px-3 py-2">{t('table.status')}</th>
              <th className="px-3 py-2">{t('table.via')}</th>
            </tr>
          </thead>
          <tbody>
            {!result.items || result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              result.items.map((row) => (
                <tr key={row.id} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/helpdesk/${row.id}`} className="text-brand-red hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-brand-ink">{row.subject}</td>
                  <td className="px-3 py-2 text-brand-ink-2">{row.reporterName ?? '—'}</td>
                  <td className="px-3 py-2 text-brand-ink-2">{row.assigneeName ?? '—'}</td>
                  <td className="px-3 py-2">
                    <PriorityBadge
                      p={row.priority}
                      label={t(`priority.${row.priority}` as 'priority.normal')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      s={row.status}
                      label={t(`status.${row.status}` as 'status.open')}
                    />
                  </td>
                  <td className="px-3 py-2 text-brand-ink-3 text-xs">
                    {row.createdVia === 'ai_chat' ? `🤖 ${t('viaAi')}` : t('viaManual')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function PriorityBadge({ p, label }: { p: string; label: string }) {
  const tone =
    p === 'urgent'
      ? 'bg-rose-50 text-rose-700'
      : p === 'high'
        ? 'bg-amber-50 text-amber-700'
        : p === 'low'
          ? 'bg-brand-cream-2 text-brand-ink-3'
          : 'bg-blue-50 text-blue-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ s, label }: { s: string; label: string }) {
  const tone =
    s === 'resolved' || s === 'closed'
      ? 'bg-emerald-50 text-emerald-700'
      : s === 'in_progress'
        ? 'bg-blue-50 text-blue-700'
        : s === 'waiting_reporter'
          ? 'bg-amber-50 text-amber-700'
          : 'bg-brand-cream-2 text-brand-ink-2';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
