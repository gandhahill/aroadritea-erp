'use client';

import { exportWorkbook } from '@/lib/export-workbook';
import type { DonationReportResult } from '@erp/services/reporting';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ExportXlsxButton } from '../export-button';
import { fetchDonationReport } from './actions';
import { TableCell, TableHead } from "@erp/ui";

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

export function DonationsClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
  defaultLocationId,
  locationOptions,
}: Props) {
  const router = useRouter();
  const t = useTranslations('reporting.donations');
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
      : t('allLocations');

    await exportWorkbook(`donasi-${startDate}-${endDate}.xlsx`, [
      {
        name: t('export.summarySheet'),
        rows: [
          [t('export.title')],
          [t('export.period'), `${startDate} s/d ${endDate}`],
          [t('export.location'), locationLabel],
          [],
          [t('export.metric'), t('export.value')],
          [t('summary.totalDonation'), totalDonation],
          [t('summary.totalTransactions'), totalTransactions],
          [t('summary.averageDonation'), overallAverage],
        ],
      },
      {
        name: t('export.dailySheet'),
        rows: [
          [
            t('columns.date'),
            t('columns.donationAmount'),
            t('columns.transactionCount'),
            t('columns.average'),
          ],
          ...rows.map((row) => [row.date, row.donationTotal, row.txCount, row.average]),
          [t('columns.total'), totalDonation, totalTransactions, overallAverage],
        ],
      },
    ]);
  }

  const data = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-ink">{t('title')}</h1>
        {data && data.rows.length > 0 && <ExportXlsxButton onExport={handleExportXlsx} />}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">{t('startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">{t('endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-ink-3">{t('location')}</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="h-9 min-w-52 rounded-lg border border-brand-cream-3 px-3 text-sm text-brand-ink"
          >
            <option value="">{t('allLocations')}</option>
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
          {isPending ? '...' : t('filter')}
        </button>
      </div>

      {result.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label={t('summary.totalDonation')}
            value={formatRupiah(data.totalDonation)}
          />
          <SummaryCard
            label={t('summary.totalTransactions')}
            value={data.totalTransactions.toString()}
          />
          <SummaryCard
            label={t('summary.averageDonation')}
            value={formatRupiah(data.overallAverage)}
          />
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cream-3 bg-brand-cream-2">
                <TableHead className="px-4 py-3 text-left font-medium text-brand-ink-2">
                  {t('columns.date')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('columns.donationAmount')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('columns.transactionCount')}
                </TableHead>
                <TableHead className="px-4 py-3 text-right font-medium text-brand-ink-2">
                  {t('columns.average')}
                </TableHead>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.date} className="border-b border-brand-cream-3 last:border-b-0">
                  <TableCell className="px-4 py-3 text-brand-ink">{row.date}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium text-brand-ink">
                    {formatRupiah(row.donationTotal)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-brand-ink-2">{row.txCount}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-brand-ink-2">
                    {formatRupiah(row.average)}
                  </TableCell>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-brand-cream-3 bg-brand-cream-2 font-semibold">
                <TableCell className="px-4 py-3 text-brand-ink">{t('columns.total')}</TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink">
                  {formatRupiah(data.totalDonation)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink-2">{data.totalTransactions}</TableCell>
                <TableCell className="px-4 py-3 text-right text-brand-ink-2">
                  {formatRupiah(data.overallAverage)}
                </TableCell>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-cream-3 py-12 text-center">
          <p className="text-sm text-brand-ink-3">{t('emptyState')}</p>
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
