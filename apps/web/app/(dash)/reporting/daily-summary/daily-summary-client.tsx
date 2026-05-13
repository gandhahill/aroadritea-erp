/**
 * DailySummaryClient — client component for the daily summary report.
 *
 * Filter bar, summary cards, payment table, top products table,
 * CSS-only charts, XLSX export. Uses xlsx library (already in deps).
 */

'use client';

import type { DailySummaryResult } from '@erp/services/reporting';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { fetchDailySummary } from './actions';

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
  if (!v) return '—';
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

// ─── Chart components (CSS-only / inline SVG) ───────────────────────────────

/** Simple donut chart via CSS conic-gradient. */
function DonutChart({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  if (!segments.length) return null;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0)
    return (
      <div className="flex items-center justify-center h-32 text-brand-ink-3 text-sm">
        Tidak ada data
      </div>
    );

  let cumulative = 0;
  const gradientStops: string[] = [];
  for (const seg of segments) {
    const pct = (seg.value / total) * 100;
    gradientStops.push(`${seg.color} ${cumulative.toFixed(1)}% ${(cumulative + pct).toFixed(1)}%`);
    cumulative += pct;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex h-36 w-36 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${gradientStops.join(', ')})`,
        }}
      >
        <div className="h-20 w-20 rounded-full bg-card" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-brand-ink">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ background: seg.color }}
            />
            <span>{seg.label}</span>
            <span className="font-medium">{((seg.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar chart for top products — pure CSS. */
function BarChart({ items }: { items: Array<{ label: string; value: number; color?: string }> }) {
  if (!items.length)
    return (
      <div className="flex items-center justify-center h-32 text-brand-ink-3 text-sm">
        Tidak ada data
      </div>
    );
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
                style={{ width: `${pct}%`, background: item.color ?? 'var(--ember-5, #c2410c)' }}
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

// ─── Export XLSX ─────────────────────────────────────────────────────────────

async function exportXLSX(data: DailySummaryResult) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows = [
    ['Ringkasan Harian'],
    ['Periode', `${data.period.start} s/d ${data.period.end}`],
    ['Lokasi', data.locationId],
    [],
    ['Metrik', 'Nilai (IDR)'],
    ['Gross Sales', data.grossSales],
    ['Total Diskon', data.discountTotal],
    ['Net Sales', data.netSales],
    ['PB1 (Pajak)', data.taxTotal],
    ['Komisi Delivery (20%)', data.commissionDelivery],
    ['Net Revenue', data.netRevenue],
    ['Total Refund', data.refundTotal],
    ['Jumlah Refund', String(data.refundCount)],
    ['', ''],
    ['Preliminary', data.isPreliminary ? 'Ya' : 'Tidak'],
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan');

  // Payment breakdown
  const paymentRows = data.paymentBreakdown.map((row) => ({
    Metode: row.method,
    'Jumlah Transaksi': row.txCount,
    Total: row.total,
  }));
  const paymentWs = XLSX.utils.json_to_sheet(paymentRows);
  XLSX.utils.book_append_sheet(wb, paymentWs, 'Pembayaran');

  // Top products
  const productRows = data.topProducts.map((row) => ({
    Rank: row.rank,
    'Product ID': row.productId,
    'Product Name': row.productName,
    Qty: row.qty,
    Nominal: row.nominal,
    Channel: row.channel,
  }));
  const productWs = XLSX.utils.json_to_sheet(productRows);
  XLSX.utils.book_append_sheet(wb, productWs, 'Top Products');

  // Shift summary
  const shiftRows = data.shiftSummary.map((s) => ({
    'Shift ID': s.shiftId,
    'Opened At': s.openedAt,
    'Closed At': s.closedAt ?? '',
    'Kas Awal': s.openingCash,
    'Kas Diharapkan': s.expectedCash ?? '',
    'Kas Atual': s.actualCash ?? '',
    Selisih: s.variance ?? '',
    Kasir: s.cashierName,
    'Jumlah Tx': s.txCount,
    'Total Tx': s.txTotal,
  }));
  const shiftWs = XLSX.utils.json_to_sheet(shiftRows);
  XLSX.utils.book_append_sheet(wb, shiftWs, 'Shift');

  XLSX.writeFile(wb, `ringkasan-harian-${data.period.start}.xlsx`);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialData: { data?: DailySummaryResult; error?: string };
  defaultStartDate: string;
  defaultEndDate: string;
  defaultLocationId: string;
}

export function DailySummaryClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
  defaultLocationId,
}: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [data, setData] = useState<DailySummaryResult | null>(initialData.data ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialData.error ?? null);

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDailySummary({ locationId, startDate, endDate });
      if (result.error) {
        setError(result.error);
        setData(null);
      } else if (result.data) {
        setData(result.data);
      }
    } catch (err) {
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
          <h1 className="text-2xl font-bold text-brand-ink">Ringkasan Harian</h1>
          <p className="mt-1 text-sm text-brand-ink-3">Laporan penjualan harian per lokasi.</p>
        </div>
        {report && (
          <button
            onClick={() => report && exportXLSX(report)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export XLSX
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-xs font-medium text-brand-ink-3">
            Tanggal Mulai
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endDate" className="text-xs font-medium text-brand-ink-3">
            Tanggal Selesai
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="locationId" className="text-xs font-medium text-brand-ink-3">
            Lokasi
          </label>
          <select
            id="locationId"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
          >
            <option value="LOC-001">Toko Pusat Yogyakarta</option>
            <option value="LOC-002">Cabang Jakarta</option>
            <option value="LOC-003">Warehouse Utama</option>
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
              Memuat...
            </>
          ) : (
            'Tampilkan'
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
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
          <h3 className="mt-3 text-base font-semibold text-brand-ink">Pilih tanggal dan lokasi</h3>
          <p className="mt-1 text-sm text-brand-ink-3">
            Klik "Tampilkan" untuk melihat ringkasan harian.
          </p>
        </div>
      )}

      {/* Summary cards */}
      {report && (
        <>
          {/* Period + location */}
          <div className="rounded-lg border border-brand-cream-3 bg-card px-4 py-3">
            <p className="text-sm text-brand-ink-3">
              Periode:{' '}
              <span className="font-medium text-brand-ink">{formatDate(report.period.start)}</span>
              {' s/d '}
              <span className="font-medium text-brand-ink">{formatDate(report.period.end)}</span>
              {report.isPreliminary && (
                <span className="ml-2 inline-flex items-center rounded-full bg-brand-gold/10 px-2 py-0.5 text-xs font-medium text-brand-gold">
                  Preliminary
                </span>
              )}
            </p>
          </div>

          {/* 6 main metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Gross Sales"
              value={formatIDR(report.grossSales)}
              color="text-brand-ink"
            />
            <MetricCard
              label="Total Diskon"
              value={formatIDR(report.discountTotal)}
              color="text-rose-500"
              sub="Dikurangi dari gross"
            />
            <MetricCard
              label="Net Sales"
              value={formatIDR(report.netSales)}
              color="text-brand-ink"
              sub="Gross − Diskon"
            />
            <MetricCard
              label="PB1 (Pajak)"
              value={formatIDR(report.taxTotal)}
              color="text-brand-gold"
              sub="10% PBJT inclusive"
            />
            <MetricCard
              label="Komisi Delivery"
              value={formatIDR(report.commissionDelivery)}
              color="text-rose-500"
              sub="20% dari ch. delivery"
            />
            <MetricCard
              label="Net Revenue"
              value={formatIDR(report.netRevenue)}
              color="text-brand-jade"
              sub="Net sales − komisi"
            />
            <MetricCard
              label="Refund Total"
              value={formatIDR(report.refundTotal)}
              color="text-rose-500"
              sub={`${report.refundCount} transaksi`}
            />
            <MetricCard
              label="Refund Count"
              value={String(report.refundCount)}
              color="text-brand-ink"
            />
          </div>

          {/* Payment breakdown + charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment table */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              <div className="border-b border-brand-cream-3 bg-brand-cream-1 px-4 py-3">
                <h3 className="text-sm font-semibold text-brand-ink">Rincian Pembayaran</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-cream-3">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                      Metode
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Jumlah Tx
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-2">
                  {report.paymentBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-brand-ink-3">
                        Tidak ada pembayaran
                      </td>
                    </tr>
                  ) : (
                    report.paymentBreakdown.map((row) => (
                      <tr key={row.method} className="hover:bg-brand-cream-1/50">
                        <td className="px-4 py-2.5 font-medium text-brand-ink capitalize">
                          {row.method}
                        </td>
                        <td className="px-4 py-2.5 text-right text-brand-ink">
                          {formatQty(row.txCount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-brand-ink">
                          {formatIDR(row.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {report.paymentBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-brand-cream-3 bg-brand-cream-1/50">
                      <td className="px-4 py-2.5 font-bold text-brand-ink">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-ink">
                        {formatQty(report.paymentBreakdown.reduce((s, r) => s + r.txCount, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-ink">
                        {formatIDR(
                          report.paymentBreakdown.reduce(
                            (s, r) => s + Number.parseInt(r.total, 10),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Donut chart */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">Distribusi Pembayaran</h3>
              <DonutChart
                segments={report.paymentBreakdown.map((row, idx) => ({
                  label: row.method,
                  value: Number.parseInt(row.total, 10),
                  color: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] ?? '#c2410c',
                }))}
              />
            </div>
          </div>

          {/* Top products */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              <div className="border-b border-brand-cream-3 bg-brand-cream-1 px-4 py-3">
                <h3 className="text-sm font-semibold text-brand-ink">Top 10 Produk (by Nominal)</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-cream-3">
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                      #
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                      Produk
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                      Jml
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Nominal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-2">
                  {report.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-brand-ink-3">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    report.topProducts.map((row) => (
                      <tr key={row.productId} className="hover:bg-brand-cream-1/50">
                        <td className="px-4 py-2.5 text-center text-brand-ink-3">{row.rank}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-brand-ink">
                            {row.productId.slice(0, 12)}
                          </span>
                          <span className="ml-2 rounded bg-brand-cream-2 px-1 py-0.5 text-xs text-brand-ink-3">
                            {row.channel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-brand-ink">
                          {formatQty(row.qty)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-brand-ink">
                          {formatIDR(row.nominal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-brand-ink">Top 5 Produk</h3>
              <BarChart
                items={report.topProducts.slice(0, 5).map((row, idx) => ({
                  label: row.productName.slice(0, 24),
                  value: Number.parseInt(row.nominal, 10),
                  color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length],
                }))}
              />
            </div>
          </div>

          {/* Shift summary */}
          {report.shiftSummary.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              <div className="border-b border-brand-cream-3 bg-brand-cream-1 px-4 py-3">
                <h3 className="text-sm font-semibold text-brand-ink">Ringkasan Shift</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-cream-3">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                      Kasir
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                      Buka
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Kas Awal
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Diharapkan
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Atual
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Selisih
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                      Tx
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                      Total Tx
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-2">
                  {report.shiftSummary.map((shift) => {
                    const hasVariance = shift.variance && Number.parseInt(shift.variance, 10) !== 0;
                    return (
                      <tr key={shift.shiftId} className="hover:bg-brand-cream-1/50">
                        <td className="px-4 py-2.5 font-medium text-brand-ink">
                          {shift.cashierName}
                        </td>
                        <td className="px-4 py-2.5 text-brand-ink-3">
                          {formatDate(shift.openedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-brand-ink">
                          {formatIDR(shift.openingCash)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-brand-ink">
                          {formatIDR(shift.expectedCash ?? '0')}
                        </td>
                        <td className="px-4 py-2.5 text-right text-brand-ink">
                          {formatIDR(shift.actualCash ?? '0')}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-semibold ${hasVariance ? (Number.parseInt(shift.variance!, 10) > 0 ? 'text-brand-jade' : 'text-rose-500') : 'text-brand-ink'}`}
                        >
                          {formatIDR(shift.variance ?? '0')}
                        </td>
                        <td className="px-4 py-2.5 text-center text-brand-ink">{shift.txCount}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-brand-ink">
                          {formatIDR(shift.txTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_COLORS = ['#c2410c', '#b45309', '#047857', '#1d4ed8', '#7c3aed', '#be123c'];
const PRODUCT_COLORS = ['#c2410c', '#b45309', '#047857', '#1d4ed8', '#7c3aed'];

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
