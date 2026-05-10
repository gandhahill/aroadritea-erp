/**
 * VarianceClient — Inventory Variance Report UI (SD §25.9.4)
 *
 * Filter bar, summary cards, tabbed Sessions / Products tables,
 * CSS-only charts, XLSX export. Follows ADR-0006 brand tokens.
 */

'use client';

import { useState } from 'react';
import { fetchVarianceReport } from './actions';
import type { VarianceReportResult } from '@erp/services/inventory';
import * as XLSX from 'xlsx';

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatIDR(v: string | number | bigint | null | undefined): string {
  if (!v) return '—';
  const num = typeof v === 'string' ? parseInt(v, 10) : Number(v);
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

async function exportXLSX(report: VarianceReportResult) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ['Laporan Varians Persediaan'],
    ['Periode', `${report.params.startDate} s/d ${report.params.endDate}`],
    report.params.locationId
      ? ['Lokasi', report.params.locationId]
      : ['Lokasi', 'Semua'],
    [],
    ['Ringkasan'],
    ['Total Sesi Opname', String(report.summary.totalSessions)],
    ['Total Produk', String(report.summary.totalProducts)],
    ['Total Baris', String(report.summary.totalLines)],
    ['Baris dengan Varians', String(report.summary.linesWithVariance)],
    ['Total Nilai Varians', formatIDR(report.summary.totalVarianceValueAbs)],
    ['Total Surplus', formatIDR(report.summary.totalSurplusValue)],
    ['Total Kekurangan', formatIDR(report.summary.totalShortageValue)],
    ['Rata-rata Tingkat Varians', `${report.summary.avgVarianceRate.toFixed(2)}%`],
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan');

  // Sessions sheet
  const sessionRows = report.sessions.map((s) => ({
    'No. Sesi': s.sessionNumber,
    Tanggal: s.sessionDate,
    Periode: s.periodCode,
    Lokasi: s.locationName,
    'Total Baris': s.totalLines,
    'Baris Dihitung': s.countedLines,
    'Baris dengan Varians': s.linesWithVariance,
    'Net Varians Qty': s.netVarianceQty,
    'Nilai Varians': formatIDR(s.totalVarianceValue),
  }));
  const sessionWs = XLSX.utils.json_to_sheet(sessionRows);
  XLSX.utils.book_append_sheet(wb, sessionWs, 'Sesi Opname');

  // Products sheet
  const productRows = report.products.map((p) => ({
    'ID Produk': p.productId,
    'Nama Produk': p.productName,
    SKU: p.sku ?? '',
    'Qty Sistem': p.totalSystemQty,
    'Qty Hitung': p.totalCountedQty,
    'Varians Qty': p.totalVarianceQty,
    'Varians Nilai': formatIDR(p.totalVarianceValueAbs),
    'Tingkat Varians': formatVarianceRate(p.varianceRate),
    'Sesi Terbesar': p.worstSession,
    'Tanggal': p.worstSessionDate,
  }));
  const productWs = XLSX.utils.json_to_sheet(productRows);
  XLSX.utils.book_append_sheet(wb, productWs, 'Produk');

  XLSX.writeFile(
    wb,
    `varians-persediaan-${report.params.startDate}-${report.params.endDate}.xlsx`,
  );
}

// ─── Chart components ─────────────────────────────────────────────────────────

/** Variance distribution donut: surplus vs shortage vs zero. */
function VarianceDonut({ surplus, shortage }: { surplus: string; shortage: string }) {
  const sur = parseInt(surplus, 10);
  const short = parseInt(shortage, 10);
  const total = sur + short;

  if (total === 0) {
    return (
      <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-brand-cream-3">
        <span className="text-sm text-brand-ink-3">Tidak ada data</span>
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
          <span>Surplus</span>
          <span className="font-medium">{surPct}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-ember-5" />
          <span>Kekurangan</span>
          <span className="font-medium">{shortPct}%</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal bar chart for top variance products. */
function VarianceBarChart({ items }: {
  items: Array<{ label: string; value: number; color?: string }>;
}) {
  if (!items.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-brand-ink-3">Tidak ada data</div>;
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
      setError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  const report = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Varians Persediaan</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Laporan selisih stock opname per sesi dan produk.
          </p>
        </div>
        {report && (
          <button
            onClick={() => report && exportXLSX(report)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export XLSX
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-xs font-medium text-brand-ink-3">Tanggal Mulai</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endDate" className="text-xs font-medium text-brand-ink-3">Tanggal Selesai</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="locationId" className="text-xs font-medium text-brand-ink-3">Lokasi</label>
          <select
            id="locationId"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          >
            <option value="">Semua Lokasi</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-ember-5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memuat...
            </>
          ) : 'Tampilkan'}
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
          <svg className="h-12 w-12 text-brand-cream-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">Pilih tanggal dan lokasi</h3>
          <p className="mt-1 text-sm text-brand-ink-3">Klik "Tampilkan" untuk melihat laporan varians.</p>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Sesi"
              value={String(report.summary.totalSessions)}
              color="text-brand-ink"
              sub={`${report.summary.totalProducts} produk`}
            />
            <MetricCard
              label="Total Baris"
              value={formatQty(report.summary.totalLines)}
              color="text-brand-ink"
              sub={`${report.summary.linesWithVariance} dengan varians`}
            />
            <MetricCard
              label="Total Nilai Varians"
              value={formatIDR(report.summary.totalVarianceValueAbs)}
              color="text-brand-ember-5"
              sub={`Rata-rata ${report.summary.avgVarianceRate.toFixed(2)}%`}
            />
            <MetricCard
              label="Net Revenue Lost"
              value={formatIDR(report.summary.totalShortageValue)}
              color={parseInt(report.summary.totalShortageValue, 10) > 0 ? 'text-rose-500' : 'text-brand-jade'}
              sub={parseInt(report.summary.totalSurplusValue, 10) > 0 ? `${formatIDR(report.summary.totalSurplusValue)} surplus` : 'Tidak ada surplus'}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Surplus vs Shortage donut */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">Distribusi Varians</h3>
              <div className="flex items-center justify-center">
                <VarianceDonut
                  surplus={report.summary.totalSurplusValue}
                  shortage={report.summary.totalShortageValue}
                />
              </div>
            </div>

            {/* Top variance products bar chart */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">Top 5 Produk dengan Varians Terbesar</h3>
              <VarianceBarChart
                items={report.products.slice(0, 5).map((p, idx) => ({
                  label: p.productName.length > 24 ? p.productName.slice(0, 24) + '…' : p.productName,
                  value: parseInt(p.totalVarianceValueAbs, 10),
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
              Ringkasan per Sesi ({report.sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'products'
                  ? 'border-b-2 border-brand-ember-5 text-brand-ember-5'
                  : 'text-brand-ink-3 hover:text-brand-ink'
              }`}
            >
              Ringkasan per Produk ({report.products.length})
            </button>
          </div>

          {/* Sessions table */}
          {activeTab === 'sessions' && (
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              {report.sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-brand-ink-3">Belum ada sesi opname yang disetujui.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">No. Sesi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">Periode</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">Lokasi</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">Baris</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">dgn. Varians</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Net Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Nilai Varians</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream-2">
                    {report.sessions.map((s) => {
                      const hasVariance = parseInt(s.totalVarianceValue, 10) > 0;
                      const netQty = s.netVarianceQty;
                      return (
                        <tr key={s.sessionId} className="hover:bg-brand-cream-1/50">
                          <td className="px-4 py-3 font-medium text-brand-ink">{s.sessionNumber}</td>
                          <td className="px-4 py-3 text-brand-ink-2">{formatDate(s.sessionDate)}</td>
                          <td className="px-4 py-3 text-brand-ink-2">{s.periodCode}</td>
                          <td className="px-4 py-3 text-brand-ink-2">{s.locationName}</td>
                          <td className="px-4 py-3 text-center text-brand-ink">{s.totalLines}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.linesWithVariance > 0
                                ? 'bg-brand-ember-5/10 text-brand-ember-5'
                                : 'bg-brand-jade/10 text-brand-jade'
                            }`}>
                              {s.linesWithVariance}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${
                            netQty > 0 ? 'text-brand-jade' : netQty < 0 ? 'text-rose-500' : 'text-brand-ink'
                          }`}>
                            {netQty > 0 ? '+' : ''}{formatQty(netQty)}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${
                            hasVariance ? 'text-brand-ember-5' : 'text-brand-ink'
                          }`}>
                            {formatIDR(s.totalVarianceValue)}
                          </td>
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
                  <p className="text-sm text-brand-ink-3">Tidak ada data produk.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-ink-2">Produk</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">Sesi</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Qty Sistem</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Qty Hitung</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Net Varians</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-brand-ink-2">Nilai</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-brand-ink-2">Tingkat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream-2">
                    {report.products.map((p) => {
                      const netQty = p.totalVarianceQty;
                      const valNum = parseInt(p.totalVarianceValueAbs, 10);
                      return (
                        <tr key={p.productId} className="hover:bg-brand-cream-1/50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-brand-ink">{p.productName}</span>
                            {p.sku && (
                              <span className="ml-2 rounded bg-brand-cream-2 px-1 py-0.5 text-xs text-brand-ink-3">
                                {p.sku}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-brand-ink">{p.sessions}</td>
                          <td className="px-4 py-3 text-right text-brand-ink">{formatQty(p.totalSystemQty)}</td>
                          <td className="px-4 py-3 text-right text-brand-ink">{formatQty(p.totalCountedQty)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${
                            netQty > 0 ? 'text-brand-jade' : netQty < 0 ? 'text-rose-500' : 'text-brand-ink'
                          }`}>
                            {netQty > 0 ? '+' : ''}{formatQty(netQty)} {p.uom}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${
                            valNum > 0 ? 'text-brand-ember-5' : 'text-brand-ink'
                          }`}>
                            {formatIDR(p.totalVarianceValueAbs)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.varianceRate > 0 ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.varianceRate > 10
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-brand-gold/10 text-brand-gold'
                              }`}>
                                {formatVarianceRate(p.varianceRate)}
                              </span>
                            ) : (
                              <span className="text-brand-ink-3">—</span>
                            )}
                          </td>
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
