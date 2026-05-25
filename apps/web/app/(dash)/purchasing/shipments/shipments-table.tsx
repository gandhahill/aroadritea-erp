'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { syncPurchaseShipmentAction } from '../actions';
import { FilterBar, FilterField } from '@/components/filter-bar';
import { Input, Select, Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import type { ShipmentSummaryRow } from '../actions';

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

type Filter = 'all' | 'in_transit' | 'delivered' | 'errored' | 'no_shipping';

function classifyStatus(row: ShipmentSummaryRow): Filter {
  if (row.trackingError) return 'errored';
  if (!row.awb && !row.trackingStatus) return 'no_shipping';
  if (
    row.trackingStatus &&
    ['DELIVERED', 'TERKIRIM', 'DITERIMA'].includes(row.trackingStatus.toUpperCase())
  ) {
    return 'delivered';
  }
  return 'in_transit';
}

function statusBadgeClass(kind: Filter): string {
  switch (kind) {
    case 'delivered':
      return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
    case 'in_transit':
      return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
    case 'errored':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3';
  }
}

export function ShipmentsTable({ rows }: { rows: ShipmentSummaryRow[] }) {
  const t = useTranslations('purchasing.shipments');
  const tBase = useTranslations('purchasing');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      const klass = classifyStatus(r);
      if (filter !== 'all' && klass !== filter) return false;
      if (!ql) return true;
      return (
        r.poNumber.toLowerCase().includes(ql) ||
        r.supplierName.toLowerCase().includes(ql) ||
        r.locationName.toLowerCase().includes(ql) ||
        (r.awb ?? '').toLowerCase().includes(ql)
      );
    });
  }, [rows, q, filter]);

  return (
    <div className="space-y-3">
      <FilterBar>
        <FilterField>
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={q}
            onChange={(e: any) => setQ(e.target.value)}
            className="min-w-48"
          />
        </FilterField>
        <FilterField>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="w-full sm:w-44"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="in_transit">{t('filterInTransit')}</option>
            <option value="delivered">{t('filterDelivered')}</option>
            <option value="errored">{t('filterErrored')}</option>
            <option value="no_shipping">{t('filterNoShipping')}</option>
          </Select>
        </FilterField>
        <span className="ml-auto text-xs text-brand-ink-3">
          {t('countSummary', { filtered: filtered.length, total: rows.length })}
        </span>
      </FilterBar>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{tBase('number')}</TableHead>
              <TableHead className="px-4 py-3">{tBase('supplierTitle')}</TableHead>
              <TableHead className="px-4 py-3">{tBase('location')}</TableHead>
              <TableHead className="px-4 py-3">{t('orderDate')}</TableHead>
              <TableHead className="px-4 py-3">{t('expected')}</TableHead>
              <TableHead className="px-4 py-3">{t('status')}</TableHead>
              <TableHead className="px-4 py-3">{t('sync')}</TableHead>
              <TableHead className="px-4 py-3" />
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                  {rows.length === 0 ? t('emptyAll') : t('emptyFilter')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const klass = classifyStatus(r);
                const statusLabel =
                  r.trackingError
                    ? t('badge.errored')
                    : !r.awb && !r.trackingStatus
                      ? t('badge.noShipping')
                      : klass === 'delivered'
                        ? t('badge.delivered')
                        : r.trackingStatus ?? t('badge.inTransit');
                return (
                  <tr key={r.poId} className="align-top">
                    <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-brand-red hover:underline">
                      <Link href={`/purchasing/po/${r.poId}`}>{r.poNumber}</Link>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-brand-ink">{r.supplierName}</TableCell>
                    <TableCell className="px-4 py-3 text-brand-muted">{r.locationName}</TableCell>
                    <TableCell className="px-4 py-3 text-brand-muted">{r.orderDate}</TableCell>
                    <TableCell className="px-4 py-3 text-brand-muted">
                      {r.expectedDate ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex max-w-[14rem] truncate rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(klass)}`}
                        title={r.trackingError ?? statusLabel}
                      >
                        {statusLabel}
                      </span>
                      {r.trackingError ? (
                        <p className="mt-1 line-clamp-2 max-w-[14rem] text-xs text-rose-700">
                          {r.trackingError}
                        </p>
                      ) : null}
                      {r.trackingSyncedAt ? (
                        <p className="mt-1 text-[11px] text-brand-ink-3">
                          {t('syncedAt')}: {r.trackingSyncedAt.slice(0, 16).replace('T', ' ')}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[22rem] px-4 py-3">
                      <form
                        action={async (formData) => {
                          await syncPurchaseShipmentAction(formData);
                        }}
                        className="grid gap-2 md:grid-cols-[7rem_1fr_5rem_auto]"
                      >
                        <input type="hidden" name="poId" value={r.poId} />
                        <Select
                          name="courierCode"
                          defaultValue={r.courierCode ?? 'jne'}
                          className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                        >
                          {COURIERS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                        <input
                          name="awb"
                          defaultValue={r.awb ?? ''}
                          placeholder={tBase('awb')}
                          className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                        />
                        <input
                          name="phoneLast5"
                          placeholder={tBase('phoneLast5')}
                          maxLength={5}
                          className="h-8 rounded border border-brand-cream-3 bg-card px-2 text-xs"
                        />
                        <button
                          type="submit"
                          className="h-8 rounded bg-brand-red px-3 text-xs font-semibold text-white"
                        >
                          {tBase('syncTracking')}
                        </button>
                      </form>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Link
                        href={`/purchasing/shipments/${r.poId}`}
                        className="text-xs font-semibold text-brand-red hover:underline"
                      >
                        {t('viewDetail')} →
                      </Link>
                    </TableCell>
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
