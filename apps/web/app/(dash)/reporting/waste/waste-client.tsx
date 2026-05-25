'use client';

import { exportWorkbook } from '@/lib/export-workbook';
import type { WasteResult } from '@erp/services/reporting';
import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function fmt(amount: string): string {
  return IDR.format(Number(BigInt(amount)));
}

interface Props {
  from: string;
  to: string;
  locationId: string;
  includePending: boolean;
  locationOptions: Array<{ value: string; label: string }>;
  data: WasteResult | null;
  error: string | null;
}

export function WasteClient(props: Props) {
  const t = useTranslations('reporting.waste');
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function localizedName(name: Record<string, unknown>): string {
    return (
      (name?.[locale] as string) ??
      (name?.id as string) ??
      (name?.en as string) ??
      (Object.values(name ?? {})[0] as string) ??
      '—'
    );
  }

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`?${next.toString()}`));
  }

  async function exportCsv() {
    // Real XLSX (exceljs). Single sheet — keep it simple for waste.
    if (!props.data) return;
    const rows: (string | number)[][] = [];
    rows.push([
      t('tableHeader.product'),
      t('tableHeader.sku'),
      t('tableHeader.variant'),
      t('tableHeader.qty'),
      t('tableHeader.uom'),
      t('tableHeader.value'),
      t('tableHeader.adjustmentCount'),
    ]);
    for (const r of props.data.rows) {
      rows.push([
        localizedName(r.productName as Record<string, unknown>),
        r.productSku,
        r.variantSku ?? '',
        Number(r.qty),
        r.uom,
        Number(r.valueIdr),
        r.adjustmentCount,
      ]);
    }
    await exportWorkbook(`waste-${props.from}-to-${props.to}.xlsx`, [
      { name: t('exportSheet'), rows },
    ]);
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
        <label className="flex items-center gap-2 text-xs text-brand-ink-2">
          <input
            type="checkbox"
            checked={props.includePending}
            onChange={(e) => updateParam('includePending', e.target.checked ? 'true' : '')}
            className="h-3.5 w-3.5 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          {t('includePending')}
        </label>
        <Button variant="secondary" size="md" onClick={() => router.refresh()} disabled={pending}>
          {t('filter')}
        </Button>
        <Button variant="primary" size="md" onClick={exportCsv} disabled={!props.data}>
          {t('exportXlsx')}
        </Button>
      </div>

      {props.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">{t('totalQtyLabel')}</p>
            <p className="mt-1 text-xl font-semibold text-brand-ink">{props.data.totalQty}</p>
          </div>
          <div className="rounded-xl border border-brand-cream-3 bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-brand-ink-3">
              {t('totalValueLabel')}
            </p>
            <p className="mt-1 text-xl font-semibold text-rose-600">
              {fmt(props.data.totalValueIdr)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <Table>
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <TableHead className="px-3 py-2">{t('tableHeader.product')}</TableHead>
              <TableHead className="px-3 py-2">{t('tableHeader.sku')}</TableHead>
              <TableHead className="px-3 py-2">{t('tableHeader.variant')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.qty')}</TableHead>
              <TableHead className="px-3 py-2">{t('tableHeader.uom')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.value')}</TableHead>
              <TableHead className="px-3 py-2 text-right">
                {t('tableHeader.adjustmentCount')}
              </TableHead>
            </tr>
          </thead>
          <TableBody>
            {!props.data || props.data.rows.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="px-3 py-6 text-center text-sm text-brand-ink-3">
                  {t('empty')}
                </TableCell>
              </tr>
            ) : (
              props.data.rows.map((row) => (
                <tr
                  key={`${row.productId}-${row.variantId ?? '-'}`}
                  className="border-t border-brand-cream-3 text-sm"
                >
                  <TableCell className="px-3 py-2 text-brand-ink">
                    {localizedName(row.productName as Record<string, unknown>)}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs text-brand-ink-2">
                    {row.productSku}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-brand-ink-2">
                    {row.variantSku ?? '—'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono">{row.qty}</TableCell>
                  <TableCell className="px-3 py-2 text-brand-ink-2">{row.uom}</TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono text-rose-600">
                    {fmt(row.valueIdr)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right text-brand-ink-2">
                    {row.adjustmentCount}
                  </TableCell>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
