'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { syncPurchaseShipmentAction } from './actions';

interface PoRow {
  id: string;
  number: string;
  supplierName: string;
  locationName: string;
  orderDate: string;
  grandTotal: string;
  status: string;
  shippingCourierCode: string | null;
  shippingAwb: string | null;
  shippingTrackingStatus: string | null;
  shippingTrackingSyncedAt: string | null;
  shippingTrackingError: string | null;
}

const COURIERS = [
  'jne',
  'pos',
  'jnt',
  'jnt_cargo',
  'sicepat',
  'tiki',
  'anteraja',
  'wahana',
  'ninja',
  'lion',
  'pcp',
  'jet',
  'rex',
  'first',
  'ide',
  'shopee',
  'kgx',
  'sap',
  'jx',
  'rpx',
  'lazada',
  'indah',
  'dakota',
  'kurir_rekomendasi',
];

function formatIdr(value: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function statusClass(status: string): string {
  if (['approved', 'received', 'closed'].includes(status))
    return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
  if (['submitted', 'partial'].includes(status))
    return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3';
}

export function PoFilterTable({ purchaseOrders }: { purchaseOrders: PoRow[] }) {
  const t = useTranslations('purchasing');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (status && po.status !== status) return false;
      if (from && po.orderDate < from) return false;
      if (to && po.orderDate > to) return false;
      if (!ql) return true;
      return (
        po.number.toLowerCase().includes(ql) ||
        po.supplierName.toLowerCase().includes(ql) ||
        po.locationName.toLowerCase().includes(ql)
      );
    });
  }, [purchaseOrders, q, status, from, to]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-brand-cream-3 px-5 py-3">
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-40 flex-1 rounded-md border border-brand-cream-3 bg-card px-3 text-sm text-brand-ink focus:border-brand-red focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="partial">Partial</option>
          <option value="received">Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label={t('fromDate')}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="text-xs text-brand-ink-3">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label={t('toDate')}
          className="h-9 rounded-md border border-brand-cream-3 bg-card px-2 text-sm"
        />
        <span className="ml-auto text-xs text-brand-ink-3">
          {t('filteredCount', { filtered: filtered.length, total: purchaseOrders.length })}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
          <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
            <tr>
              <th className="px-4 py-3">{t('number')}</th>
              <th className="px-4 py-3">{t('supplierTitle')}</th>
              <th className="px-4 py-3">{t('location')}</th>
              <th className="px-4 py-3">{t('date')}</th>
              <th className="px-4 py-3 text-right">{t('total')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('shipmentTracking')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3 bg-card">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-ink-3">
                  {purchaseOrders.length === 0
                    ? t('emptyPo')
                    : t('emptyFilter')}
                </td>
              </tr>
            ) : (
              filtered.map((po) => (
                <tr key={po.id}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-ink">
                    {po.number}
                  </td>
                  <td className="px-4 py-3 text-brand-ink">{po.supplierName}</td>
                  <td className="px-4 py-3 text-brand-muted">{po.locationName}</td>
                  <td className="px-4 py-3 text-brand-muted">{po.orderDate}</td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-ink">
                    {formatIdr(po.grandTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(po.status)}`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="min-w-96 px-4 py-3">
                    <form
                      action={async (formData) => {
                        await syncPurchaseShipmentAction(formData);
                      }}
                      className="grid gap-2 md:grid-cols-[88px_1fr_84px_auto]"
                    >
                      <input type="hidden" name="poId" value={po.id} />
                      <select
                        name="courierCode"
                        defaultValue={po.shippingCourierCode ?? 'jne'}
                        className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                      >
                        {COURIERS.map((courier) => (
                          <option key={courier} value={courier}>
                            {courier}
                          </option>
                        ))}
                      </select>
                      <input
                        name="awb"
                        defaultValue={po.shippingAwb ?? ''}
                        placeholder={t('awb')}
                        className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                      />
                      <input
                        name="phoneLast5"
                        placeholder={t('phoneLast5')}
                        maxLength={5}
                        className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="h-8 rounded bg-brand-red px-3 text-xs font-semibold text-white"
                      >
                        {t('syncTracking')}
                      </button>
                    </form>
                    <p className="mt-1 text-xs text-brand-ink-3">
                      {po.shippingTrackingStatus
                        ? `${po.shippingTrackingStatus}${po.shippingTrackingSyncedAt ? ` | ${po.shippingTrackingSyncedAt.slice(0, 10)}` : ''}`
                        : t('notSynced')}
                      {po.shippingTrackingError ? ` | ${po.shippingTrackingError}` : ''}
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
