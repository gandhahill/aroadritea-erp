'use client';

import { exportWorkbook } from '@/lib/export-workbook';
import type { DonationReportResult } from '@erp/services/reporting';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fetchDonationReport } from './actions';

type LocationOption = {
  id: string;
  code: string;
  label: string;
};

interface Props {
  initialData: { data?: DonationReportResult; error?: string };
  defaultStartDate: string;
  defaultEndDate: string;
  defaultLocationId: string;
  locationOptions: LocationOption[];
}

const exportButtonClass =
  'inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90';

export function DonationsClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
  defaultLocationId,
  locationOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [result, setResult] = useState(initialData);

  function handleFilter() {
    startTransition(async () => {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (locationId) params.set('locationId', locationId);
      router.push(`?${params.toString()}`);

      const res = await fetchDonationReport({
        startDate,
        endDate,
        locationId: locationId || undefined,
      });
      setResult(res);
    });
  }

  async function handleExportXlsx() {
    if (!result.data) return;
    const { rows, totalDonation, totalTransactions, overallAverage } = result.data;
    const locationLabel = locationId
      ? (locationOptions.find((location) => location.id === locationId)?.label ?? locationId)
      : 'Semua lokasi';

    await exportWorkbook(`donasi-${startDate}-${endDate}.xlsx`, [
      {
        name: 'Ringkasan',
        rows: [
          ['Laporan Donasi'],
          ['Periode', `${startDate} s/d ${endDate}`],
          ['Lokasi', locationLabel],
          [],
          ['Metrik', 'Nilai'],
          ['Total Donasi', totalDonation],
          ['Jumlah Transaksi', totalTransactions],
          ['Rata-rata Donasi', overallAverage],
        ],
      },
      {
        name: 'Harian',
        rows: [
          ['Tanggal', 'Jumlah Donasi', 'Jumlah Transaksi', 'Rata-rata'],
          ...rows.map((row) => [row.date, row.donationTotal, row.txCount, row.average]),
          ['TOTAL', totalDonation, totalTransactions, overallAverage],
        ],
      },
    ]);
  }

  const data = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-ink">Laporan Donasi</h1>
        {data && data.rows.length > 0 && (
          <button onClick={handleExportXlsx} className={exportButtonClass}>
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export XLSX
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">Lokasi</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-9 min-w-52 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          >
            <option value="">Semua lokasi</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label} ({location.code})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFilter}
          disabled={isPending}
          className="h-9 rounded-lg bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isPending ? '...' : 'Filter'}
        </button>
      </div>

      {result.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Total Donasi" value={formatRupiah(data.totalDonation)} />
          <SummaryCard label="Jumlah Transaksi" value={data.totalTransactions.toString()} />
          <SummaryCard label="Rata-rata Donasi" value={formatRupiah(data.overallAverage)} />
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-2">
                <th className="px-4 py-3 text-left font-medium text-brand-ink-2">Tanggal</th>
                <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Jumlah Donasi</th>
                <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Transaksi</th>
                <th className="px-4 py-3 text-right font-medium text-brand-ink-2">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.date} className="border-b border-brand-cream-3 last:border-b-0">
                  <td className="px-4 py-3 text-brand-ink">{row.date}</td>
                  <td className="px-4 py-3 text-right font-medium text-brand-ink">
                    {formatRupiah(row.donationTotal)}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-ink-2">{row.txCount}</td>
                  <td className="px-4 py-3 text-right text-brand-ink-2">
                    {formatRupiah(row.average)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-brand-cream-3 bg-brand-cream-2 font-semibold">
                <td className="px-4 py-3 text-brand-ink">TOTAL</td>
                <td className="px-4 py-3 text-right text-brand-ink">
                  {formatRupiah(data.totalDonation)}
                </td>
                <td className="px-4 py-3 text-right text-brand-ink-2">{data.totalTransactions}</td>
                <td className="px-4 py-3 text-right text-brand-ink-2">
                  {formatRupiah(data.overallAverage)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-cream-3 py-12 text-center">
          <p className="text-sm text-brand-ink-3">Tidak ada data donasi pada periode ini</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card px-4 py-3">
      <p className="text-xs font-medium text-brand-ink-3">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand-ink">{value}</p>
    </div>
  );
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
