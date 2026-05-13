'use client';

/**
 * Omzet Harian Client — SD §25.5b, SoT §21.3b
 *
 * Read-only fields: gross, PB1, net omzet.
 * Editable fields: adjustment (F) + note (H) — inline double-click to edit.
 * Warning banner if adjustment ≠ 0.
 * Export Excel button.
 */

import type { OmzetHarianResult } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import {
  serverExportOmzetHarian,
  serverGetOmzetHarian,
  serverSaveOmzetAdjustment,
} from './actions';

interface Props {
  initialData: OmzetHarianResult | null;
  initialDate: string;
  initialLocationId: string;
  ctx: AuditContext;
}

function fmtIDR(value: string): string {
  const cents = BigInt(value);
  const idr = cents / BigInt(100);
  return Number(idr).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtAbs(value: string): string {
  const cents = BigInt(value);
  const abs = cents < 0 ? -cents : cents;
  const idr = abs / BigInt(100);
  const sign = cents < 0 ? '-' : '';
  return (
    sign +
    Number(idr).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  );
}

export function OmzetHarianClient({ initialData, initialDate, initialLocationId, ctx }: Props) {
  const t = useTranslations('reporting.omzetHarian');

  const [date, setDate] = useState(initialDate);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [data, setData] = useState<OmzetHarianResult | null>(initialData);
  const [isPending, startTransition] = useTransition();

  const [adjAmount, setAdjAmount] = useState(
    initialData ? fmtAbs(initialData.adjustmentAmount) : '',
  );
  const [adjNote, setAdjNote] = useState(initialData?.adjustmentNote ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function loadData(loc: string, d: string) {
    if (!loc) return;
    startTransition(async () => {
      const result = await serverGetOmzetHarian({ locationId: loc, date: d }, ctx);
      if (result.ok) {
        setData(result.value);
        setAdjAmount(
          result.value.adjustmentAmount === '0' ? '' : fmtAbs(result.value.adjustmentAmount),
        );
        setAdjNote(result.value.adjustmentNote ?? '');
        setIsDirty(false);
        setSaveError(null);
      }
    });
  }

  function handleDateChange(d: string) {
    setDate(d);
    loadData(locationId, d);
  }

  function handleLocationChange(loc: string) {
    setLocationId(loc);
    loadData(loc, date);
  }

  function handleAdjAmountChange(val: string) {
    setAdjAmount(val); // store raw IDR string
    setIsDirty(true);
    setSaveSuccess(false);
  }

  function handleAdjNoteChange(val: string) {
    setAdjNote(val);
    setIsDirty(true);
    setSaveSuccess(false);
  }

  function handleSave() {
    if (!data) return;
    setSaveError(null);
    startTransition(async () => {
      // Convert IDR to sen (multiply by 100)
      const cleanVal = adjAmount.replace(/[^\d-]/g, '');
      const idrVal = BigInt(cleanVal || '0');
      const senVal = (idrVal * BigInt(100)).toString();

      const result = await serverSaveOmzetAdjustment(
        {
          locationId: data.locationId,
          date: data.date,
          adjustmentAmount: senVal,
          adjustmentNote: adjNote,
        },
        ctx,
      );
      if (result.ok) {
        setIsDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(String(result.error));
      }
    });
  }

  function handleExport() {
    if (!data) return;
    startTransition(async () => {
      const result = await serverExportOmzetHarian(
        { locationId: data.locationId, date: data.date, locale: 'id' },
        ctx,
      );
      if (result.ok) {
        const blob = new Blob([result.value.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.value.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  const adjCents = BigInt(adjAmount || '0');
  const netCents = data ? BigInt(data.netOmzet) : BigInt(0);
  const fiscalCents = netCents + adjCents;
  const hasAdj = adjCents !== BigInt(0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-brand-ink">{t('howItWorks')}</p>
            <p className="mt-0.5 text-xs text-brand-ink-2">{t('howItWorksDesc')}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-brand-cream-3 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-ink">{t('date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="mb-1 block text-sm font-medium text-brand-ink">{t('location')}</label>
          <input
            type="text"
            value={locationId}
            onChange={(e) => handleLocationChange(e.target.value)}
            placeholder="Location ID"
            className="w-full rounded-lg border border-brand-cream-3 px-3 py-2 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>

      {/* No data state */}
      {!data && (
        <div className="rounded-lg border border-dashed border-brand-cream-3 py-16 text-center">
          <svg
            className="mx-auto h-10 w-10 text-brand-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-3 text-sm text-brand-ink-3">
            {locationId ? t('noDataForDate') : t('selectLocationFirst')}
          </p>
        </div>
      )}

      {/* Data table */}
      {data && (
        <div className="space-y-4">
          {/* Warning banner */}
          {hasAdj && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-yellow-700">
                {t('fiscalWarning', {
                  diff: fmtAbs(adjCents.toString()),
                  direction: adjCents < 0 ? t('less') : t('more'),
                })}
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-brand-cream-3">
            <table className="min-w-full">
              <thead className="bg-brand-cream-2">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colDate')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colLocation')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colGross')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colPB1')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colNetOmzet')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colAdjustment')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colFiscalOmzet')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-2">
                    {t('colNote')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cream-3 bg-white">
                <tr>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-brand-ink">
                    {data.date}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-brand-ink">
                    {data.locationName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm text-brand-ink">
                    {fmtIDR(data.grossSales)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm text-brand-ink">
                    {fmtIDR(data.pb1Amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold text-brand-ink">
                    {fmtIDR(data.netOmzet)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <input
                      type="text"
                      value={adjAmount}
                      onChange={(e) => handleAdjAmountChange(e.target.value)}
                      placeholder="0"
                      className="w-36 rounded border border-brand-cream-3 bg-transparent px-2 py-1 text-right font-mono text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-bold ${hasAdj ? 'text-brand-red' : 'text-brand-ink'}`}
                  >
                    {adjCents < 0 ? '-' : ''}
                    {fmtAbs(fiscalCents.toString())}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <input
                      type="text"
                      value={adjNote}
                      onChange={(e) => handleAdjNoteChange(e.target.value)}
                      placeholder={t('notePlaceholder')}
                      className="w-full min-w-48 rounded border border-brand-cream-3 bg-transparent px-2 py-1 text-sm text-brand-ink placeholder-brand-cream-3 focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fiscal total badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {saveSuccess && (
                <span className="flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Tersimpan
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                  Gagal menyimpan: {saveError}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isPending || !isDirty}
                className="rounded-lg border border-brand-cream-3 bg-white px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-cream-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending && isDirty ? 'Menyimpan...' : t('saveAdjustment')}
              </button>
              <button
                onClick={handleExport}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red/90 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5v3.75"
                  />
                </svg>
                {t('exportExcel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
