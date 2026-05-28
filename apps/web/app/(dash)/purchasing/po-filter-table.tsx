'use client';

import { FilterBar, FilterField } from '@/components/filter-bar';
import { Input, Select, Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { syncPurchaseShipmentAction } from './actions';
import { COURIERS } from '@erp/shared/binderbyte-couriers';

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
      <FilterBar>
        <FilterField>
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={q}
            onChange={(e: any) => setQ(e.target.value)}
            className="min-w-40"
          />
        </FilterField>
        <FilterField>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full sm:w-40"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="draft">{t('statusDraft')}</option>
            <option value="submitted">{t('statusSubmitted')}</option>
            <option value="approved">{t('statusApproved')}</option>
            <option value="partial">{t('statusPartial')}</option>
            <option value="received">{t('statusReceived')}</option>
            <option value="closed">{t('statusClosed')}</option>
            <option value="cancelled">{t('statusCancelled')}</option>
          </Select>
        </FilterField>
        <FilterField>
          <Input
            type="date"
            value={from}
            onChange={(e: any) => setFrom(e.target.value)}
            aria-label={t('fromDate')}
          />
        </FilterField>
        <span className="text-sm text-brand-ink-3">—</span>
        <FilterField>
          <Input
            type="date"
            value={to}
            onChange={(e: any) => setTo(e.target.value)}
            aria-label={t('toDate')}
          />
        </FilterField>
        <span className="ml-auto text-xs text-brand-ink-3">
          {t('filteredCount', { filtered: filtered.length, total: purchaseOrders.length })}
        </span>
      </FilterBar>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{t('number')}</TableHead>
              <TableHead className="px-4 py-3">{t('supplierTitle')}</TableHead>
              <TableHead className="px-4 py-3">{t('location')}</TableHead>
              <TableHead className="px-4 py-3">{t('date')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{t('total')}</TableHead>
              <TableHead className="px-4 py-3">{t('status')}</TableHead>
              <TableHead className="px-4 py-3">{t('shipmentTracking')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-brand-ink-3">
                  {purchaseOrders.length === 0 ? t('emptyPo') : t('emptyFilter')}
                </td>
              </tr>
            ) : (
              filtered.map((po) => (
                <tr key={po.id}>
                  <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-brand-red hover:underline">
                    <Link href={`/purchasing/po/${po.id}`}>{po.number}</Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-brand-ink">{po.supplierName}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-muted">{po.locationName}</TableCell>
                  <TableCell className="px-4 py-3 text-brand-muted">{po.orderDate}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                    {formatIdr(po.grandTotal)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(po.status)}`}
                    >
                      {po.status}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-96 px-4 py-3">
                    <form
                      action={async (formData) => {
                        await syncPurchaseShipmentAction(formData);
                      }}
                      className="grid gap-2 md:grid-cols-[88px_1fr_84px_auto]"
                    >
                      <input type="hidden" name="poId" value={po.id} />
                      <Select
                        name="courierCode"
                        defaultValue={po.shippingCourierCode ?? 'jne'}
                        className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                      >
                        {COURIERS.map((courier) => (
                          <option key={courier.code} value={courier.code}>
                            {courier.name}
                          </option>
                        ))}
                      </Select>
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
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
