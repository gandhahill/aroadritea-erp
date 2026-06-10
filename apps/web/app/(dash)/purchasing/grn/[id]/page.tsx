import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { fetchGrnDetail } from '../../actions';

export const metadata: Metadata = { title: 'GRN Detail' };

function fmtMoney(v: string | null): string {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const { id } = await params;
  const t = await getTranslations('purchasing.grnReport');
  const tg = await getTranslations('purchasing.grn');

  const grn = await fetchGrnDetail(id);
  if (!grn) notFound();

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-5 py-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title={
              <>
                {tg('grnDetail')} — {grn.number}
              </>
            }
          />
          <Link
            href="/purchasing/grn-report"
            className="shrink-0 text-sm text-brand-red hover:underline"
          >
            ← {t('title')}
          </Link>
        </div>

        <div className="grid gap-4 rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm md:grid-cols-2">
          <Field label={t('grnNumber')} value={grn.number} mono />
          <Field
            label={t('poNumber')}
            value={
              <Link href={`/purchasing/po/${grn.poId}`} className="text-brand-red hover:underline">
                {grn.poNumber}
              </Link>
            }
          />
          <Field label={t('supplierName')} value={grn.supplierName} />
          <Field label={t('locationName')} value={grn.locationName} />
          <Field label={t('receivedDate')} value={grn.receivedDate} />
          <Field
            label={t('status')}
            value={
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  grn.status === 'confirmed'
                    ? 'bg-brand-jade/10 text-brand-jade'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {grn.status === 'confirmed'
                  ? t('statusConfirmed') || 'Confirmed'
                  : t('statusDraft') || 'Draft'}
              </span>
            }
          />
          {grn.notes ? <Field label={tg('notes')} value={grn.notes} span2 /> : null}
        </div>

        <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-brand-cream-3 bg-brand-cream/50 text-xs uppercase tracking-wider text-brand-ink-2">
              <tr>
                <th className="px-4 py-3">{tg('product')}</th>
                <th className="px-4 py-3 text-right">{tg('receivingNow')}</th>
                <th className="px-4 py-3 text-right">{tg('qtyRejected')}</th>
                <th className="px-4 py-3">{tg('rejectReason')}</th>
                <th className="px-4 py-3 text-right">{tg('unitPrice')}</th>
                <th className="px-4 py-3">{tg('batchNo')}</th>
                <th className="px-4 py-3">{tg('expiryDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3">
              {grn.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-brand-ink">{l.productName}</td>
                  <td className="px-4 py-3 text-right font-mono text-brand-ink">
                    {l.qtyReceived} {l.uom}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {Number(l.qtyRejected) > 0 ? (
                      <span className="text-rose-600">
                        {l.qtyRejected} {l.uom}
                      </span>
                    ) : (
                      <span className="text-brand-ink-3">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">{l.rejectReason || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-brand-ink-2">
                    {fmtMoney(l.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-brand-ink-2">{l.batchNo || '—'}</td>
                  <td className="px-4 py-3 text-brand-ink-2">{l.expiryDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  span2 = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <p className="text-xs uppercase tracking-wider text-brand-ink-3">{label}</p>
      <p className={`mt-1 text-sm text-brand-ink ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
