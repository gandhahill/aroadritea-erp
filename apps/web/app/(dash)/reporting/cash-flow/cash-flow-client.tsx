'use client';

import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string): string {
  const big = BigInt(amount);
  if (big < 0n) return `-${IDR.format(Number(-big))}`;
  return IDR.format(Number(big));
}

interface SectionData {
  label: string;
  kind: string;
  inflow: string;
  outflow: string;
  net: string;
  movements: Array<{
    postingDate: string;
    journalNumber: string;
    journalDescription: string;
    direction: 'inflow' | 'outflow';
    amount: string;
  }>;
}

interface Props {
  from: string;
  to: string;
  locationId: string;
  locationOptions: Array<{ value: string; label: string }>;
  data: {
    from: string;
    to: string;
    locationId: string | null;
    beginningCash: string;
    endingCash: string;
    netIncrease: string;
    isPreliminary: boolean;
    sections: SectionData[];
  } | null;
  error: string | null;
}

export function CashFlowClient(props: Props) {
  const t = useTranslations('reporting.cashFlowPage');
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
    rows.push([
      t('tableHeader.date'),
      t('tableHeader.journal'),
      t('tableHeader.description'),
      t('inflow'),
      t('outflow'),
    ]);
    for (const section of props.data.sections) {
      rows.push([`# ${section.label}`, '', '', '', '']);
      for (const m of section.movements) {
        rows.push([
          m.postingDate,
          m.journalNumber,
          m.journalDescription,
          m.direction === 'inflow' ? m.amount : '',
          m.direction === 'outflow' ? m.amount : '',
        ]);
      }
      rows.push(['', '', `${t('net')}: ${section.label}`, '', section.net]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cash-flow-${props.from}-to-${props.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function sectionLabel(kind: string): string {
    if (kind === 'operating') return t('operating');
    if (kind === 'investing') return t('investing');
    if (kind === 'financing') return t('financing');
    return kind;
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
          <span className="text-brand-ink-2">{t('from')}</span>
          <Input
            type="date"
            defaultValue={props.from}
            onBlur={(e) => updateParam('from', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('to')}</span>
          <Input
            type="date"
            defaultValue={props.to}
            onBlur={(e) => updateParam('to', e.target.value)}
            className="w-44"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('location')}</span>
          <Select
            value={props.locationId}
            onChange={(e) => updateParam('locationId', e.target.value)}
            className="w-56"
          >
            <option value="">{t('allLocations')}</option>
            {props.locationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="primary" size="md" onClick={() => router.refresh()} disabled={pending}>
          {t('filter')}
        </Button>
        <Button variant="primary" size="md" onClick={exportCsv} disabled={!props.data}>
          {t('exportXlsx')}
        </Button>
      </div>

      {props.data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">{t('totalInflow')}</p>
            <p className="mt-1 text-base font-semibold text-emerald-700">
              {fmt(props.data.sections.reduce((acc, s) => acc + BigInt(s.inflow), 0n).toString())}
            </p>
          </div>
          <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">{t('totalOutflow')}</p>
            <p className="mt-1 text-base font-semibold text-rose-600">
              {fmt(props.data.sections.reduce((acc, s) => acc + BigInt(s.outflow), 0n).toString())}
            </p>
          </div>
          <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">{t('netChange')}</p>
            <p className="mt-1 text-base font-semibold text-brand-ink">
              {fmt(props.data.netIncrease)}
            </p>
          </div>
        </div>
      ) : null}

      {props.data?.sections.map((section) => (
        <div
          key={section.kind}
          className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card"
        >
          <header className="flex items-center justify-between border-b border-brand-cream-3 bg-brand-cream-2/40 px-3 py-2">
            <h2 className="text-sm font-semibold text-brand-ink">{sectionLabel(section.kind)}</h2>
            <div className="flex gap-4 text-xs text-brand-ink-2">
              <span>
                {t('inflow')}:{' '}
                <span className="font-mono text-emerald-700">{fmt(section.inflow)}</span>
              </span>
              <span>
                {t('outflow')}:{' '}
                <span className="font-mono text-rose-600">{fmt(section.outflow)}</span>
              </span>
              <span>
                {t('net')}: <span className="font-mono font-semibold">{fmt(section.net)}</span>
              </span>
            </div>
          </header>
          {section.movements.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-brand-ink-3">{t('empty')}</p>
          ) : (
            <Table>
              <thead className="bg-brand-cream-2/20 text-left text-[11px] uppercase text-brand-ink-3">
                <tr>
                  <TableHead className="px-3 py-2">{t('tableHeader.date')}</TableHead>
                  <TableHead className="px-3 py-2">{t('tableHeader.journal')}</TableHead>
                  <TableHead className="px-3 py-2">{t('tableHeader.description')}</TableHead>
                  <TableHead className="px-3 py-2 text-right">{t('tableHeader.amount')}</TableHead>
                </tr>
              </thead>
              <TableBody>
                {section.movements.map((m, idx) => (
                  <tr
                    key={`${section.kind}-${m.journalNumber}-${idx}`}
                    className="border-t border-brand-cream-3 text-xs"
                  >
                    <TableCell className="px-3 py-2 text-brand-ink-2">{m.postingDate}</TableCell>
                    <TableCell className="px-3 py-2 font-mono text-brand-ink-2">
                      {m.journalNumber}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-2">
                      {m.journalDescription}
                    </TableCell>
                    <TableCell
                      className={`px-3 py-2 text-right font-mono ${
                        m.direction === 'inflow' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {m.direction === 'inflow' ? '+' : '-'}
                      {fmt(m.amount)}
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </div>
  );
}
