/**
 * VarianceClient — Inventory Variance Report UI (SD §25.9.4)
 *
 * Filter bar, summary cards, tabbed Sessions / Products tables,
 * CSS-only charts, XLSX export. Follows ADR-0006 brand tokens.
 */

'use client';

import { FilterBar, FilterField } from '@/components/filter-bar';
import { PageHeader } from '@/components/page-header';
import { exportWorkbook } from '@/lib/export-workbook';
import type { VarianceReportResult } from '@erp/services/inventory';
import { Select, TableCell, TableHead } from '@erp/ui';
import { Button } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ExportXlsxButton } from '../../reporting/export-button';
import { fetchVarianceReport } from './actions';

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

function formatQty(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('id-ID');
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatVarianceRate(v: number): string {
  if (v === 0) return '—';
  return `${v.toFixed(1)}%`;
}

// ─── XLSX Export ─────────────────────────────────────────────────────────────

async function exportXLSX(report: VarianceReportResult, t: any) {
  const locationLabel = report.params.locationId
    ? (report.sessions.find((session) => session.locationId === report.params.locationId)
        ?.locationName ?? report.params.locationId)
    : t('allLocations');
  const summaryRows = [
    [t('export.title')],
    [t('export.period'), `${report.params.startDate} s/d ${report.params.endDate}`],
    [t('export.location'), locationLabel],
    [],
    [t('export.summary')],
    [t('export.totalSessions'), String(report.summary.totalSessions)],
    [t('export.totalProducts'), String(report.summary.totalProducts)],
    [t('export.totalLines'), String(report.summary.totalLines)],
    [t('export.linesWithVariance'), String(report.summary.linesWithVariance)],
    [t('export.totalVarianceValue'), formatIDR(report.summary.totalVarianceValueAbs)],
    [t('export.totalSurplus'), formatIDR(report.summary.totalSurplusValue)],
    [t('export.totalShortage'), formatIDR(report.summary.totalShortageValue)],
    [t('export.avgVarianceRate'), `${report.summary.avgVarianceRate.toFixed(2)}%`],
  ];

  const sessionRows = [
    [
      t('columns.sessionNo'),
      t('columns.date'),
      t('columns.period'),
      t('columns.location'),
      t('columns.totalLines'),
      t('columns.countedLines'),
      t('columns.linesWithVariance'),
      t('columns.netVarianceQty'),
      t('columns.varianceValue'),
    ],
    ...report.sessions.map((s) => [
      s.sessionNumber,
      s.sessionDate,
      s.periodCode,
      s.locationName,
      s.totalLines,
      s.countedLines,
      s.linesWithVariance,
      s.netVarianceQty,
      formatIDR(s.totalVarianceValue),
    ]),
  ];

  const productRows = [
    [
      t('columns.productId'),
      t('columns.productName'),
      t('columns.sku'),
      t('columns.systemQty'),
      t('columns.countedQty'),
      t('columns.varianceQty'),
      t('columns.varianceValue'),
      t('columns.varianceRate'),
      t('columns.worstSession'),
      t('columns.date'),
    ],
    ...report.products.map((p) => [
      p.productId,
      p.productName,
      p.sku ?? '',
      p.totalSystemQty,
      p.totalCountedQty,
      p.totalVarianceQty,
      formatIDR(p.totalVarianceValueAbs),
      formatVarianceRate(p.varianceRate),
      p.worstSession,
      p.worstSessionDate,
    ]),
  ];

  await exportWorkbook(
    `varians-persediaan-${report.params.startDate}-${report.params.endDate}.xlsx`,
    [
      { name: t('export.summarySheet'), rows: summaryRows },
      { name: t('export.sessionsSheet'), rows: sessionRows },
      { name: t('export.productsSheet'), rows: productRows },
    ],
  );
}

// ─── Chart components ─────────────────────────────────────────────────────────

/** Variance distribution donut: surplus vs shortage vs zero. */
function VarianceDonut({ surplus, shortage, t }: { surplus: string; shortage: string; t: any }) {
  const sur = Number.parseInt(surplus, 10);
  const short = Number.parseInt(shortage, 10);
  const total = sur + short;

  if (total === 0) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-brand-cream-3">
        <span className="text-sm text-brand-ink-3">{t('noData')}</span>
      </div>
    );
  }

  const surPct = ((sur / total) * 100).toFixed(1);
  const shortPct = ((short / total) * 100).toFixed(1);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex h-36 w-36 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#047857 ${surPct}%, #c2410c ${surPct}%)`,
        }}
      >
        <div className="h-20 w-20 rounded-full bg-card" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5 text-xs text-brand-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-jade" />
          <span>{t('surplus')}</span>
          <span className="font-medium">{surPct}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-ember-5" />
          <span>{t('shortage')}</span>
          <span className="font-medium">{shortPct}%</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal bar chart for top variance products. */
function VarianceBarChart({
  items,
  t,
}: {
  items: Array<{ label: string; value: number; color?: string }>;
  t: any;
}) {
  if (!items.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-brand-ink-3">
        {t('noData')}
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, idx) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="w-4 text-right text-xs font-medium text-brand-ink-3">{idx + 1}</span>
            <span className="w-32 truncate text-xs text-brand-ink" title={item.label}>
              {item.label}
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-brand-cream-2">
              <div
                className="h-4 rounded-full transition-all"
                style={{ width: `${pct}%`, background: item.color ?? '#c2410c' }}
              />
            </div>
            <span className="w-20 text-right text-xs font-medium text-brand-ink">
              {formatIDR(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  locations: Array<{ id: string; name: string }>;
  defaultLocationId: string;
  defaultStartDate: string;
  defaultEndDate: string;
}

export function VarianceClient({
  locations,
  defaultLocationId,
  defaultStartDate,
  defaultEndDate,
}: Props) {
  const t = useTranslations('inventory.variance');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [data, setData] = useState<VarianceReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'products'>('sessions');

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchVarianceReport({
        locationId: locationId || undefined,
        startDate,
        endDate,
      });
      if (result.error) {
        setError(result.error);
        setData(null);
      } else if (result.data) {
        setData(result.data);
      }
    } catch {
      setError(t('errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }

  const report = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={<>{report && <ExportXlsxButton onExport={() => exportXLSX(report, t)} />}</>}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-xs font-medium text-brand-ink-3">
            {t('startDate')}
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endDate" className="text-xs font-medium text-brand-ink-3">
            {t('endDate')}
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="locationId" className="text-xs font-medium text-brand-ink-3">
            {t('location')}
          </label>
          <Select
            id="locationId"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          >
            <option value="">{t('allLocations')}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t('loading')}
            </>
          ) : (
            t('show')
          )}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty state */}
      {!report && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-brand-cream-3 bg-card py-16 text-center">
          <svg
            className="h-12 w-12 text-brand-cream-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">{t('emptyState.title')}</h3>
          <p className="mt-1 text-sm text-brand-ink-3">{t('emptyState.subtitle')}</p>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t('summary.totalSessions')}
              value={String(report.summary.totalSessions)}
              color="text-brand-ink"
              sub={`${report.summary.totalProducts} ${t('summary.productsCount')}`}
            />
            <MetricCard
              label={t('summary.totalLines')}
              value={formatQty(report.summary.totalLines)}
              color="text-brand-ink"
              sub={`${report.summary.linesWithVariance} ${t('summary.withVariance')}`}
            />
            <MetricCard
              label={t('summary.totalVarianceValue')}
              value={formatIDR(report.summary.totalVarianceValueAbs)}
              color="text-brand-ember-5"
              sub={`${t('summary.average')} ${report.summary.avgVarianceRate.toFixed(2)}%`}
            />
            <MetricCard
              label={t('summary.netRevenueLost')}
              value={formatIDR(report.summary.totalShortageValue)}
              color={
                Number.parseInt(report.summary.totalShortageValue, 10) > 0
                  ? 'text-rose-500'
                  : 'text-brand-jade'
              }
              sub={
                Number.parseInt(report.summary.totalSurplusValue, 10) > 0
                  ? `${formatIDR(report.summary.totalSurplusValue)} ${t('summary.surplus')}`
                  : t('summary.noSurplus')
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Surplus vs Shortage donut */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">
                {t('charts.varianceDistribution')}
              </h3>
              <div className="flex items-center justify-center">
                <VarianceDonut
                  surplus={report.summary.totalSurplusValue}
                  shortage={report.summary.totalShortageValue}
                  t={t}
                />
              </div>
            </div>

            {/* Top variance products bar chart */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">
                {t('charts.topVarianceProducts')}
              </h3>
              <VarianceBarChart
                t={t}
                items={report.products.slice(0, 5).map((p, idx) => ({
                  label:
                    p.productName.length > 24 ? p.productName.slice(0, 24) + '…' : p.productName,
                  value: Number.parseInt(p.totalVarianceValueAbs, 10),
                  color: '#c2410c',
                }))}
              />
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 border-b border-brand-cream-3">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'border-b-2 border-brand-ember-5 text-brand-ember-5'
                  : 'text-brand-ink-3 hover:text-brand-ink'
              }`}
            >
              {t('tabs.sessions')} ({report.sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'border-b-2 border-brand-ember-5 text-brand-ember-5'
                  : 'text-brand-ink-3 hover:text-brand-ink'
              }`}
            >
              {t('tabs.products')} ({report.products.length})
            </button>
          </div>

          {/* Sessions table */}
          {activeTab === 'sessions' && (
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              {report.sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-brand-ink-3">{t('emptySessions')}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                      <TableHead className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">
                        {t('columns.sessionNo')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">
                        {t('columns.date')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">
                        {t('columns.period')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">
                        {t('columns.location')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">
                        {t('columns.lines')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">
                        {t('columns.withVariance')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.netQty')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.varianceValue')}
                      </TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream-2">
                    {report.sessions.map((s) => {
                      const hasVariance = Number.parseInt(s.totalVarianceValue, 10) > 0;
                      const netQty = s.netVarianceQty;
                      return (
                        <tr key={s.sessionId} className="hover:bg-brand-cream-1/50">
                          <TableCell className="px-4 py-3 font-medium text-brand-ink">
                            {s.sessionNumber}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-brand-ink-2">
                            {formatDate(s.sessionDate)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-brand-ink-2">
                            {s.periodCode}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-brand-ink-2">
                            {s.locationName}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center text-brand-ink">
                            {s.totalLines}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                s.linesWithVariance > 0
                                  ? 'bg-brand-ember-5/10 text-brand-ember-5'
                                  : 'bg-brand-jade/10 text-brand-jade'
                              }`}
                            >
                              {s.linesWithVariance}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`px-4 py-3 text-right font-medium ${
                              netQty > 0
                                ? 'text-brand-jade'
                                : netQty < 0
                                  ? 'text-rose-500'
                                  : 'text-brand-ink'
                            }`}
                          >
                            {netQty > 0 ? '+' : ''}
                            {formatQty(netQty)}
                          </TableCell>
                          <TableCell
                            className={`px-4 py-3 text-right font-medium ${
                              hasVariance ? 'text-brand-ember-5' : 'text-brand-ink'
                            }`}
                          >
                            {formatIDR(s.totalVarianceValue)}
                          </TableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Products table */}
          {activeTab === 'products' && (
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              {report.products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-brand-ink-3">{t('emptyProducts')}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                      <TableHead className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">
                        {t('columns.product')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">
                        {t('columns.session')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.systemQty')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.countedQty')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.netVariance')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">
                        {t('columns.value')}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">
                        {t('columns.rate')}
                      </TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream-2">
                    {report.products.map((p) => {
                      const netQty = p.totalVarianceQty;
                      const valNum = Number.parseInt(p.totalVarianceValueAbs, 10);
                      return (
                        <tr key={p.productId} className="hover:bg-brand-cream-1/50">
                          <TableCell className="px-4 py-3">
                            <span className="font-medium text-brand-ink">{p.productName}</span>
                            {p.sku && (
                              <span className="ml-2 rounded bg-brand-cream-2 px-1 py-0.5 text-xs text-brand-ink-3">
                                {p.sku}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center text-brand-ink">
                            {p.sessions}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-brand-ink">
                            {formatQty(p.totalSystemQty)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-brand-ink">
                            {formatQty(p.totalCountedQty)}
                          </TableCell>
                          <TableCell
                            className={`px-4 py-3 text-right font-medium ${
                              netQty > 0
                                ? 'text-brand-jade'
                                : netQty < 0
                                  ? 'text-rose-500'
                                  : 'text-brand-ink'
                            }`}
                          >
                            {netQty > 0 ? '+' : ''}
                            {formatQty(netQty)} {p.uom}
                          </TableCell>
                          <TableCell
                            className={`px-4 py-3 text-right font-medium ${
                              valNum > 0 ? 'text-brand-ember-5' : 'text-brand-ink'
                            }`}
                          >
                            {formatIDR(p.totalVarianceValueAbs)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            {p.varianceRate > 0 ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  p.varianceRate > 10
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-brand-gold/10 text-brand-gold'
                                }`}
                              >
                                {formatVarianceRate(p.varianceRate)}
                              </span>
                            ) : (
                              <span className="text-brand-ink-3">—</span>
                            )}
                          </TableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── MetricCard helper ────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-brand-ink-3">{sub}</p>}
    </div>
  );
}
