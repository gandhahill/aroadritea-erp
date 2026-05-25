'use client';

import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import type { AgingResult } from '@erp/services/reporting';

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string): string {
  return IDR.format(Number(BigInt(amount)));
}

interface Props {
  kind: 'AR' | 'AP';
  asOf: string;
  locationId: string;
  locationOptions: Array<{ value: string; label: string }>;
  data: AgingResult | null;
  error: string | null;
}

export function AgingClient(props: Props) {
  const t = useTranslations('reporting.aging');
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totals = props.data?.totals;
  const partners = props.data?.partners ?? [];
  const details = props.data?.details ?? [];

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function exportXlsx() {
    // Lightweight CSV export — leverages browser download without
    // pulling exceljs into the client bundle. Honours the active filter.
    if (!props.data) return;
    const rows: string[][] = [];
    rows.push([
      t('tableHeader.partner'),
      t('tableHeader.current'),
      t('tableHeader.bucket31_60'),
      t('tableHeader.bucket61_90'),
      t('tableHeader.bucketOver90'),
      t('tableHeader.total'),
    ]);
    for (const p of partners) {
      rows.push([
        p.partnerName,
        p.buckets.current,
        p.buckets.bucket_31_60,
        p.buckets.bucket_61_90,
        p.buckets.bucket_over_90,
        p.buckets.total,
      ]);
    }
    const csv = rows
      .map((r) => r.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `aging-${props.kind.toLowerCase()}-${props.asOf}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const totalLabel = useMemo(() => t('totalLabel'), [t]);

  return (
    <div className="space-y-4">
      {props.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {props.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="space-y-1 text-sm">
          <span className="text-brand-ink-2">{t('asOf')}</span>
          <Input
            type="date"
            defaultValue={props.asOf}
            onBlur={(e) => updateParam('asOf', e.target.value)}
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
        <Button variant="secondary" size="md" onClick={() => router.refresh()} disabled={pending}>
          {t('filter')}
        </Button>
        <Button variant="primary" size="md" onClick={exportXlsx} disabled={!props.data}>
          {t('exportXlsx')}
        </Button>
      </div>

      {/* Summary totals */}
      {totals ? (
        <div className="grid gap-3 sm:grid-cols-5">
          {(
            [
              ['current', t('tableHeader.current')],
              ['bucket_31_60', t('tableHeader.bucket31_60')],
              ['bucket_61_90', t('tableHeader.bucket61_90')],
              ['bucket_over_90', t('tableHeader.bucketOver90')],
              ['total', totalLabel],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="rounded-xl border border-brand-cream-3 bg-card p-3">
              <p className="text-xs uppercase tracking-wide text-brand-ink-3">{label}</p>
              <p className="mt-1 text-base font-semibold text-brand-ink">
                {fmt((totals as Record<string, string>)[key])}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <Table>
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <TableHead className="px-3 py-2">{t('tableHeader.partner')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.current')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.bucket31_60')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.bucket61_90')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.bucketOver90')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.total')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.lineCount')}</TableHead>
            </tr>
          </thead>
          <TableBody>
            {partners.length === 0 ? (
              <tr>
                <TableCell
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-brand-ink-3"
                >
                  {t('empty')}
                </TableCell>
              </tr>
            ) : (
              partners.map((row) => (
                <tr
                  key={row.partnerId ?? row.partnerName}
                  className="border-t border-brand-cream-3 text-sm"
                >
                  <TableCell className="px-3 py-2 text-brand-ink">
                    {row.partnerName || t('noPartner')}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">
                    {fmt(row.buckets.current)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">
                    {fmt(row.buckets.bucket_31_60)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">
                    {fmt(row.buckets.bucket_61_90)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono text-rose-600">
                    {fmt(row.buckets.bucket_over_90)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono font-semibold text-brand-ink">
                    {fmt(row.buckets.total)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-brand-ink-2">
                    {row.lineCount}
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail drill-down */}
      {details.length > 0 ? (
        <details className="rounded-xl border border-brand-cream-3 bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-ink">
            {t('detailsTitle')}
          </summary>
          <div className="overflow-x-auto">
            <Table>
              <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
                <tr>
                  <TableHead className="px-3 py-2">{t('detailsHeader.journal')}</TableHead>
                  <TableHead className="px-3 py-2">{t('detailsHeader.postingDate')}</TableHead>
                  <TableHead className="px-3 py-2">{t('detailsHeader.dueDate')}</TableHead>
                  <TableHead className="px-3 py-2 text-right">{t('detailsHeader.daysOverdue')}</TableHead>
                  <TableHead className="px-3 py-2">{t('detailsHeader.bucket')}</TableHead>
                  <TableHead className="px-3 py-2 text-right">{t('detailsHeader.amount')}</TableHead>
                  <TableHead className="px-3 py-2">{t('detailsHeader.description')}</TableHead>
                </tr>
              </thead>
              <TableBody>
                {details.map((d) => (
                  <tr key={d.journalLineId} className="border-t border-brand-cream-3 text-xs">
                    <TableCell className="px-3 py-2 font-mono text-brand-ink-2">
                      {d.journalNumber}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-2">{d.postingDate}</TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-2">{d.dueDate ?? '—'}</TableCell>
                    <TableCell className="px-3 py-2 text-right text-brand-ink-2">
                      {d.daysOverdue}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-2">{d.bucket}</TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-brand-ink">
                      {fmt(d.amount)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-brand-ink-3">{d.description ?? '—'}</TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
