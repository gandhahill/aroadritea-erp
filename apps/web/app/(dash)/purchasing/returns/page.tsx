/**
 * Purchase Returns list page — T-0180.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchPurchaseReturnsAction } from './actions';

export const metadata: Metadata = { title: 'Purchase Returns' };

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export default async function PurchaseReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const t = await getTranslations('purchasing.returns');
  const result = await fetchPurchaseReturnsAction({ status: params.status });

  return (
    <main className="space-y-6 p-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/purchasing/returns/new"
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
          >
            {t('newReturn')}
          </Link>
        }
      />

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(['', 'draft', 'submitted', 'approved', 'posted', 'cancelled'] as const).map((s) => (
          <Link
            key={s || 'all'}
            href={s ? `/purchasing/returns?status=${s}` : '/purchasing/returns'}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              params.status === s || (!params.status && !s)
                ? 'bg-brand-ink text-white border-brand-ink'
                : 'bg-card text-brand-ink-2 border-brand-cream-3 hover:bg-brand-cream-2'
            }`}
          >
            {s ? t(`status.${s}` as 'status.draft') : t('status.all')}
          </Link>
        ))}
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
              <th className="px-3 py-2">{t('table.returnDate')}</th>
              <th className="px-3 py-2">{t('table.supplier')}</th>
              <th className="px-3 py-2">{t('table.status')}</th>
              <th className="px-3 py-2 text-right">{t('table.grandTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {!result.data || result.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-brand-ink-3">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              result.data.map((row) => (
                <tr key={row.id} className="border-t border-brand-cream-3">
                  <td className="px-3 py-2">
                    <Link
                      href={`/purchasing/returns/${row.id}`}
                      className="font-mono text-brand-red hover:underline"
                    >
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-brand-ink-2">{row.returnDate}</td>
                  <td className="px-3 py-2 text-brand-ink-2">{row.supplierId}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={row.status}
                      label={t(`status.${row.status}` as 'status.draft')}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {IDR.format(Number(BigInt(row.grandTotal)))}
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

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'posted'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-rose-50 text-rose-700'
        : status === 'approved'
          ? 'bg-amber-50 text-amber-700'
          : status === 'submitted'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-brand-cream-2 text-brand-ink-2';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
