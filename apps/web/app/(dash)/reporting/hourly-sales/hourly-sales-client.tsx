/**
 * HourlySalesClient — client component for the hourly sales report (SD §25.6.3)
 *
 * Features:
 * - Filter bar: date range, location, groupBy channel/day toggle
 * - Summary cards: total transactions, total gross, busiest hour
 * - CSS heatmap: channel × hour matrix with color intensity
 * - Detail table: per-channel or per-day breakdown
 * - Export XLSX: multi-sheet workbook (Ringkasan, Heatmap)
 */

'use client';

import { Select } from '@erp/ui';

import { FilterBar, FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { exportWorkbook } from '@/lib/export-workbook';
import type { ChannelHourRow, DayHourRow, HourlySalesResult } from '@erp/services/reporting';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ExportXlsxButton } from '../export-button';
import { fetchHourlySales } from './actions';

type LocationOption = {
  id: string;
  code: string;
  label: string;
};

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatIDR(v: string | number | bigint | null | undefined): string {
  if (!v) return '—';
  const num = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORE_HOURS = Array.from({ length: 12 }, (_, i) => (i + 10).toString()); // 10..21
const CHANNEL_LABELS: Record<string, { id: string; en: string; zh: string }> = {
  dine_in: { id: 'Dine In', en: 'Dine In', zh: 'å ‚é£Ÿ' },
  take_away: { id: 'Bawa Pulang', en: 'Take Away', zh: 'å¤–å¸¦' },
  gofood: { id: 'GoFood', en: 'GoFood', zh: 'GoFood' },
  grabfood: { id: 'GrabFood', en: 'GrabFood', zh: 'GrabFood' },
  shopeefood: { id: 'ShopeeFood', en: 'ShopeeFood', zh: 'ShopeeFood' },
};

const CHANNEL_COLORS: Record<string, string> = {
  dine_in: '#C0392B',
  take_away: '#E67E22',
  gofood: '#27AE60',
  grabfood: '#2980B9',
  shopeefood: '#8E44AD',
};

const HEATMAP_COLORS: [string, string][] = [
  ['#FDE8E8', '#C0392B'], // very low → red
  ['#FEF3C7', '#D97706'], // low → orange
  ['#FEF9C3', '#CA8A04'], // medium-low → yellow
  ['#D1FAE5', '#059669'], // medium → green
  ['#A7F3D0', '#047857'], // high → dark green
];

function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#F3F4F6'; // gray
  const ratio = value / max;
  if (ratio < 0.2) return HEATMAP_COLORS[0]![0]!;
  if (ratio < 0.4) return HEATMAP_COLORS[1]![0]!;
  if (ratio < 0.6) return HEATMAP_COLORS[2]![0]!;
  if (ratio < 0.8) return HEATMAP_COLORS[3]![0]!;
  return HEATMAP_COLORS[4]![0]!;
}

// ─── Channel badge ─────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string }) {
  const color = CHANNEL_COLORS[channel] ?? '#6B7280';
  const label = CHANNEL_LABELS[channel]?.id ?? channel;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  );
}

// ─── Summary Cards ──────────────────────────────────────────────────────────────

function SummaryCards({ data, t }: { data: HourlySalesResult; t: any }) {
  const totalTx = data.totalTxCount;
  const totalSales = formatIDR(data.totalGrossSales);

  // Find busiest hour
  let busiestHour = '—';
  let maxTx = 0;
  for (const [hour, cell] of Object.entries(data.hourTotals)) {
    if (cell.txCount > maxTx) {
      maxTx = cell.txCount;
      busiestHour = `${hour}:00`;
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-brand-cream-3 bg-card px-4 py-3">
        <p className="text-xs font-medium text-brand-ink-3">{t('summary.totalTransactions')}</p>
        <p className="mt-1 text-lg font-bold text-brand-ink">{totalTx.toLocaleString('id-ID')}</p>
      </div>
      <div className="rounded-xl border border-brand-cream-3 bg-card px-4 py-3">
        <p className="text-xs font-medium text-brand-ink-3">{t('summary.totalSales')}</p>
        <p className="mt-1 text-lg font-bold text-brand-ink">{totalSales}</p>
      </div>
      <div className="rounded-xl border border-brand-cream-3 bg-card px-4 py-3">
        <p className="text-xs font-medium text-brand-ink-3">{t('summary.busiestHour')}</p>
        <p className="mt-1 text-lg font-bold text-brand-ink">{busiestHour} WIB</p>
      </div>
    </div>
  );
}

// ─── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ data, t }: { data: HourlySalesResult; t: any }) {
  if (!data.channelRows) return null;

  // Find max value for color scaling
  let maxGross = 0n;
  for (const row of data.channelRows) {
    for (const cell of Object.values(row.hourBreakdown)) {
      const v = BigInt(cell.grossSales);
      if (v > maxGross) maxGross = v;
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-brand-cream-3">
            <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium text-brand-ink-2">
              {t('columns.channel')}
            </th>
            {STORE_HOURS.map((h) => (
              <th key={h} className="px-1.5 py-2 text-center font-medium text-brand-ink-2">
                {h}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-brand-ink-2">
              {t('columns.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.channelRows.map((row) => {
            const channelTotal = Object.values(row.hourBreakdown).reduce(
              (sum, c) => sum + BigInt(c.grossSales),
              0n,
            );
            return (
              <tr key={row.channel} className="border-b border-brand-cream-3 last:border-b-0">
                <td className="sticky left-0 bg-card px-3 py-2">
                  <ChannelBadge channel={row.channel} />
                </td>
                {STORE_HOURS.map((h) => {
                  const cell = row.hourBreakdown[h];
                  const tx = cell?.txCount ?? 0;
                  const gross = cell?.grossSales ?? '0';
                  const bg = heatColor(tx, maxTxInRow(row));
                  return (
                    <td
                      key={h}
                      className="px-1 py-1 text-center"
                      style={{ background: bg }}
                      title={`${formatIDR(gross)} / ${tx} tx`}
                    >
                      <span className="block font-medium text-brand-ink">{tx > 0 ? tx : '—'}</span>
                      <span className="block text-[10px] text-brand-ink-3">
                        {tx > 0 ? formatIDR(gross).replace('Rp', '').trim() : ''}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold text-brand-ink">
                  {formatIDR(channelTotal.toString())}
                </td>
              </tr>
            );
          })}
          {/* Hour totals row */}
          <tr className="bg-brand-cream-2 font-semibold">
            <td className="sticky left-0 bg-brand-cream-2 px-3 py-2 text-brand-ink-2">
              {t('columns.totalUpper')}
            </td>
            {STORE_HOURS.map((h) => {
              const cell = data.hourTotals[h]!;
              return (
                <td key={h} className="px-1 py-2 text-center text-brand-ink">
                  {cell.txCount > 0 ? cell.txCount : '—'}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right text-brand-ink">
              {formatIDR(data.totalGrossSales)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function maxTxInRow(row: ChannelHourRow): number {
  return Math.max(...Object.values(row.hourBreakdown).map((c) => c.txCount), 0);
}

// ─── Day Table ─────────────────────────────────────────────────────────────────

function DayTable({ data, t }: { data: HourlySalesResult; t: any }) {
  if (!data.dayRows) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-brand-cream-3 bg-brand-cream-2">
            <th className="px-4 py-2.5 text-left font-medium text-brand-ink-2">
              {t('columns.date')}
            </th>
            {STORE_HOURS.map((h) => (
              <th key={h} className="px-1.5 py-2.5 text-center font-medium text-brand-ink-2">
                {h}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-medium text-brand-ink-2">
              {t('columns.totalTx')}
            </th>
            <th className="px-3 py-2.5 text-right font-medium text-brand-ink-2">
              {t('columns.totalSales')}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.dayRows.map((row) => {
            const dayTotalTx = Object.values(row.hourBreakdown).reduce((s, c) => s + c.txCount, 0);
            const dayTotalGross = Object.values(row.hourBreakdown).reduce(
              (s, c) => s + BigInt(c.grossSales),
              0n,
            );
            return (
              <tr key={row.date} className="border-b border-brand-cream-3 last:border-b-0">
                <td className="px-4 py-2.5 font-medium text-brand-ink">
                  {new Intl.DateTimeFormat('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(row.date + 'T00:00:00+07:00'))}
                </td>
                {STORE_HOURS.map((h) => {
                  const cell = row.hourBreakdown[h]!;
                  return (
                    <td key={h} className="px-1.5 py-2.5 text-center text-brand-ink">
                      {cell.txCount > 0 ? cell.txCount : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-medium text-brand-ink">{dayTotalTx}</td>
                <td className="px-3 py-2.5 text-right font-medium text-brand-ink">
                  {formatIDR(dayTotalGross.toString())}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Export XLSX ───────────────────────────────────────────────────────────────

function buildXlsxData(data: HourlySalesResult, t: any): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];

  if (data.groupBy === 'channel' && data.channelRows) {
    // Header row
    rows.push([t('columns.channel'), ...STORE_HOURS.map((h) => `${h}:00`), t('columns.total')]);
    for (const row of data.channelRows) {
      const hourVals = STORE_HOURS.map((h) => {
        const c = row.hourBreakdown[h];
        return c ? `${c.txCount} tx / ${formatIDR(c.grossSales)}` : '—';
      });
      const total = Object.values(row.hourBreakdown).reduce((s, c) => s + BigInt(c.grossSales), 0n);
      rows.push([row.channel, ...hourVals, formatIDR(total.toString())]);
    }
    // Total row
    const totalHours = STORE_HOURS.map((h) => {
      const c = data.hourTotals[h];
      return c ? `${c.txCount} tx` : '—';
    });
    rows.push([t('columns.totalUpper'), ...totalHours, formatIDR(data.totalGrossSales)]);
  } else if (data.groupBy === 'day' && data.dayRows) {
    rows.push([
      t('columns.date'),
      ...STORE_HOURS.map((h) => `${h}:00`),
      t('columns.totalTx'),
      t('columns.totalSales'),
    ]);
    for (const row of data.dayRows) {
      const dayTotalTx = Object.values(row.hourBreakdown).reduce((s, c) => s + c.txCount, 0);
      const dayTotalGross = Object.values(row.hourBreakdown).reduce(
        (s, c) => s + BigInt(c.grossSales),
        0n,
      );
      rows.push([
        row.date,
        ...STORE_HOURS.map((h) => {
          const c = row.hourBreakdown[h];
          return c && c.txCount > 0 ? c.txCount : '—';
        }),
        dayTotalTx,
        formatIDR(dayTotalGross.toString()),
      ]);
    }
  }

  return rows;
}

async function handleExportXlsx(data: HourlySalesResult, locationLabel: string, t: any) {
  const rows = buildXlsxData(data, t);
  await exportWorkbook(`penjualan-per-jam-${data.period.start}-${data.period.end}.xlsx`, [
    {
      name: t('export.summarySheet'),
      rows: [
        [t('export.title')],
        [t('export.period'), `${data.period.start} s/d ${data.period.end}`],
        [t('export.location'), locationLabel],
        [t('export.mode'), data.groupBy],
        [t('export.totalTransactions'), data.totalTxCount],
        [t('export.totalSales'), data.totalGrossSales],
      ],
    },
    { name: data.groupBy === 'channel' ? t('export.channelSheet') : t('export.daySheet'), rows },
  ]);
}

// ─── Main Client Component ─────────────────────────────────────────────────────

interface Props {
  initialData: { data?: HourlySalesResult; error?: string };
  defaultStartDate: string;
  defaultEndDate: string;
  defaultLocationId: string;
  defaultGroupBy: 'channel' | 'day';
  locationOptions: LocationOption[];
}

export function HourlySalesClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
  defaultLocationId,
  defaultGroupBy,
  locationOptions,
}: Props) {
  const router = useRouter();
  const t = useTranslations('reporting.hourlySales');
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [groupBy, setGroupBy] = useState<'channel' | 'day'>(defaultGroupBy);
  const [result, setResult] = useState(initialData);

  function handleSearch() {
    startTransition(async () => {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('groupBy', groupBy);
      if (locationId) params.set('locationId', locationId);
      router.push(`?${params.toString()}`);

      const res = await fetchHourlySales({
        startDate,
        endDate,
        groupBy,
        locationId: locationId || undefined,
      });
      setResult(res);
    });
  }

  const data = result.data;
  const selectedLocationLabel = locationId
    ? (locationOptions.find((location) => location.id === locationId)?.label ?? locationId)
    : t('allLocations');

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader title={<>{t('title')}</>} />

      {/* Filters */}
      {/* Filters */}
      <FilterBar>
        <FilterField label={t('startDate')}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink w-full sm:w-36"
          />
        </FilterField>
        <FilterField label={t('endDate')}>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink w-full sm:w-36"
          />
        </FilterField>
        <FilterField label={t('location')}>
          <Select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-9 w-full sm:w-48"
          >
            <option value="">{t('allLocations')}</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label} ({location.code})
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label={t('groupBy')}>
          <div className="flex h-9 rounded-lg border border-brand-cream-3 overflow-hidden">
            <button
              onClick={() => setGroupBy('channel')}
              className={`px-3 text-sm font-medium transition-colors ${groupBy === 'channel' ? 'bg-brand-red text-white' : 'bg-card text-brand-ink hover:bg-brand-cream-2'}`}
            >
              {t('groupChannel')}
            </button>
            <button
              onClick={() => setGroupBy('day')}
              className={`px-3 text-sm font-medium transition-colors border-l border-brand-cream-3 ${groupBy === 'day' ? 'bg-brand-red text-white' : 'bg-card text-brand-ink hover:bg-brand-cream-2'}`}
            >
              {t('groupDay')}
            </button>
          </div>
        </FilterField>
        <Button onClick={handleSearch} disabled={isPending} variant="primary" className="h-9">
          {isPending ? '...' : t('filter')}
        </Button>
      </FilterBar>

      {/* Error */}
      {result.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
      )}

      {/* Summary + Content */}
      {data && (
        <>
          <SummaryCards data={data} t={t} />

          {groupBy === 'channel' && data.channelRows && (
            <>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-brand-ink-2">{t('heatmapTitle')}</h2>
                <Heatmap data={data} t={t} />
              </div>
            </>
          )}

          {groupBy === 'day' && data.dayRows && (
            <>
              <h2 className="mb-2 text-sm font-semibold text-brand-ink-2">{t('dayTitle')}</h2>
              <DayTable data={data} t={t} />
            </>
          )}
        </>
      )}

      {/* Empty state */}
      {data && !data.channelRows?.length && !data.dayRows?.length && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-cream-3 py-12 text-center">
          <p className="text-sm text-brand-ink-3">{t('emptyState')}</p>
        </div>
      )}
    </div>
  );
}
