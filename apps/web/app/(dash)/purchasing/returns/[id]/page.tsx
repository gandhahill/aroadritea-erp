/**
 * Purchase Return detail page — T-0180.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { fetchPurchaseReturnAction } from '../actions';
import { ReturnActions } from './return-actions-client';

export const metadata: Metadata = { title: 'Purchase Return Detail' };

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export default async function PurchaseReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  const t = await getTranslations('purchasing.returns');
  const result = await fetchPurchaseReturnAction(id);
  if (result.error || !result.data) notFound();
  const r = result.data;

  return (
    <div className="space-y-6">
      <PageHeader title={`${t('detailTitle')} ${r.number}`} description={r.reason} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t('table.status')} value={t(`status.${r.status}` as 'status.draft')} />
        <Card label={t('table.returnDate')} value={r.returnDate} />
        <Card label={t('table.supplier')} value={r.supplierId} />
        <Card label={t('table.grandTotal')} value={IDR.format(Number(BigInt(r.grandTotal)))} />
      </div>

      <ReturnActions returnId={r.id} status={r.status} />

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t('lineHeader.product')}</th>
              <th className="px-3 py-2 text-right">{t('lineHeader.qty')}</th>
              <th className="px-3 py-2">{t('lineHeader.uom')}</th>
              <th className="px-3 py-2 text-right">{t('lineHeader.unitCost')}</th>
              <th className="px-3 py-2 text-right">{t('lineHeader.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id} className="border-t border-brand-cream-3">
                <td className="px-3 py-2 text-brand-ink-3">{l.lineNo}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.productId}</td>
                <td className="px-3 py-2 text-right font-mono">{l.qtyReturned}</td>
                <td className="px-3 py-2 text-brand-ink-2">{l.uom}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {IDR.format(Number(BigInt(l.unitCost)))}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {IDR.format(Number(BigInt(l.lineTotal)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.journalEntryId ? (
        <p className="text-xs text-brand-ink-3">
          {t('journalEntryRef')}:{' '}
          <span className="font-mono text-brand-ink-2">{r.journalEntryId}</span>
        </p>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  );
}
