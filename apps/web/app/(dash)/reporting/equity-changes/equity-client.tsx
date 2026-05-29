'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { ExportXlsxButton } from '../export-button';

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string | bigint): string {
  const big = typeof amount === 'string' ? BigInt(amount) : amount;
  if (big < 0n) return `(${IDR.format(Number(-big))})`;
  return IDR.format(Number(big));
}

interface Props {
  from: string;
  to: string;
  locationId: string;
  locationOptions: Array<{ value: string; label: string }>;
  data: {
    startDate: string;
    endDate: string;
    locationId: string | null;
    beginningCapital: bigint;
    beginningRetainedEarnings: bigint;
    totalBeginningEquity: bigint;
    netIncome: bigint;
    dividends: bigint;
    additionalCapital: bigint;
    endingCapital: bigint;
    endingRetainedEarnings: bigint;
    totalEndingEquity: bigint;
  } | null;
  error: string | null;
}

export function EquityChangesClient(props: Props) {
  const t = useTranslations('reporting.equityChangesPage');
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function exportCsv() {
    if (!props.data) return;
    const rows: string[][] = [];
    rows.push(['Laporan Perubahan Ekuitas (Statement of Changes in Equity)', '', '']);
    rows.push([`Periode: ${props.from} - ${props.to}`, '', '']);
    rows.push(['', '', '']);
    rows.push([t('beginningBalance'), '', fmt(props.data.totalBeginningEquity)]);
    rows.push(['  ' + t('beginningCapital'), '', fmt(props.data.beginningCapital)]);
    rows.push(['  ' + t('beginningRetainedEarnings'), '', fmt(props.data.beginningRetainedEarnings)]);
    rows.push(['', '', '']);
    rows.push([t('netIncome'), '', fmt(props.data.netIncome)]);
    rows.push([t('additionalCapital'), '', fmt(props.data.additionalCapital)]);
    rows.push([t('dividends'), '', fmt(props.data.dividends)]);
    rows.push(['', '', '']);
    rows.push([t('endingBalance'), '', fmt(props.data.totalEndingEquity)]);
    rows.push(['  ' + t('endingCapital'), '', fmt(props.data.endingCapital)]);
    rows.push(['  ' + t('endingRetainedEarnings'), '', fmt(props.data.endingRetainedEarnings)]);

    const csv = rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `equity-changes-${props.from}-to-${props.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-4">
      {props.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {props.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Dari (From)</span>
          <Input
            type="date"
            defaultValue={props.from}
            onBlur={(e) => updateParam('from', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Sampai (To)</span>
          <Input
            type="date"
            defaultValue={props.to}
            onBlur={(e) => updateParam('to', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">Lokasi (Location)</span>
          <Select
            value={props.locationId}
            onChange={(e) => updateParam('locationId', e.target.value)}
            className="w-56"
          >
            <option value="">Semua Lokasi (Consolidated)</option>
            {props.locationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="primary" size="md" onClick={() => router.refresh()} disabled={pending}>
          Tampilkan (Filter)
        </Button>
        <ExportXlsxButton onExport={exportCsv} disabled={!props.data} label="Ekspor CSV" />
      </div>

      {props.data ? (
        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-brand-cream-3 bg-card text-sm">
          <div className="border-b border-brand-cream-3 bg-brand-cream-1 p-6 text-center">
            <h2 className="text-lg font-bold text-brand-ink">{t('title')}</h2>
            <p className="text-brand-ink-2 mt-1">Periode {props.from} s/d {props.to}</p>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Saldo Awal */}
            <div>
              <div className="flex justify-between font-bold border-b border-brand-cream-3 pb-2 text-base">
                <span>{t('beginningBalance')}</span>
                <span>{fmt(props.data.totalBeginningEquity)}</span>
              </div>
              <div className="flex justify-between py-2 text-brand-ink-2 pl-4">
                <span>{t('beginningCapital')}</span>
                <span>{fmt(props.data.beginningCapital)}</span>
              </div>
              <div className="flex justify-between py-2 text-brand-ink-2 pl-4">
                <span>{t('beginningRetainedEarnings')}</span>
                <span>{fmt(props.data.beginningRetainedEarnings)}</span>
              </div>
            </div>

            {/* Perubahan */}
            <div>
              <div className="flex justify-between py-2 font-medium">
                <span>{t('netIncome')}</span>
                <span className={props.data.netIncome >= 0n ? 'text-brand-jade' : 'text-brand-red'}>{fmt(props.data.netIncome)}</span>
              </div>
              <div className="flex justify-between py-2 font-medium">
                <span>{t('additionalCapital')}</span>
                <span className="text-brand-jade">{fmt(props.data.additionalCapital)}</span>
              </div>
              <div className="flex justify-between py-2 font-medium">
                <span>{t('dividends')}</span>
                <span className="text-brand-red">({fmt(props.data.dividends)})</span>
              </div>
            </div>

            {/* Saldo Akhir */}
            <div>
              <div className="flex justify-between font-bold border-t border-brand-cream-3 pt-4 text-base">
                <span>{t('endingBalance')}</span>
                <span>{fmt(props.data.totalEndingEquity)}</span>
              </div>
              <div className="flex justify-between py-2 text-brand-ink-2 pl-4">
                <span>{t('endingCapital')}</span>
                <span>{fmt(props.data.endingCapital)}</span>
              </div>
              <div className="flex justify-between py-2 text-brand-ink-2 pl-4">
                <span>{t('endingRetainedEarnings')}</span>
                <span>{fmt(props.data.endingRetainedEarnings)}</span>
              </div>
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
