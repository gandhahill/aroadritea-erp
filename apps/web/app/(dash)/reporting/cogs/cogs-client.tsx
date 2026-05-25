'use client';

import { Button, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CogsResult } from '@erp/services/reporting';

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

interface Props {
  includeInactive: boolean;
  data: CogsResult | null;
  error: string | null;
}

export function CogsClient(props: Props) {
  const t = useTranslations('reporting.cogs');
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function localizedName(name: Record<string, unknown>): string {
    return (
      (name?.[locale] as string) ??
      (name?.id as string) ??
      (name?.en as string) ??
      (Object.values(name ?? {})[0] as string) ??
      '—'
    );
  }

  function toggleInactive(checked: boolean) {
    const next = new URLSearchParams(search.toString());
    if (checked) next.set('includeInactive', 'true');
    else next.delete('includeInactive');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  function exportCsv() {
    if (!props.data) return;
    const rows: string[][] = [];
    rows.push([
      t('tableHeader.product'),
      t('tableHeader.sku'),
      t('tableHeader.sellPrice'),
      t('tableHeader.unitCost'),
      t('tableHeader.grossMargin'),
      t('tableHeader.marginPercent'),
    ]);
    for (const p of props.data.products) {
      rows.push([
        localizedName(p.productName as Record<string, unknown>),
        p.productSku,
        p.sellPrice,
        p.unitCost,
        p.grossMargin,
        p.marginPercent != null ? p.marginPercent.toFixed(2) : '—',
      ]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cogs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <div className="space-y-4">
      {props.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {props.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-cream-3 bg-card p-3">
        <label className="flex items-center gap-2 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={props.includeInactive}
            onChange={(e) => toggleInactive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
          />
          {t('includeInactive')}
        </label>
        <Button variant="primary" size="md" onClick={exportCsv} disabled={!props.data || pending}>
          {t('exportXlsx')}
        </Button>
      </div>

      {props.data && props.data.missingBomProductIds.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <div className="font-medium">{t('missingBomTitle')}</div>
          <div className="text-xs">{t('missingBomBody')}</div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card">
        <Table>
          <thead className="bg-brand-cream-2/60 text-left text-xs uppercase text-brand-ink-2">
            <tr>
              <TableHead className="px-3 py-2">{t('tableHeader.product')}</TableHead>
              <TableHead className="px-3 py-2">{t('tableHeader.sku')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.sellPrice')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.unitCost')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.grossMargin')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.marginPercent')}</TableHead>
              <TableHead className="px-3 py-2 text-right">{t('tableHeader.bomVersion')}</TableHead>
            </tr>
          </thead>
          <TableBody>
            {!props.data || props.data.products.length === 0 ? (
              <tr>
                <TableCell colSpan={7} className="px-3 py-6 text-center text-sm text-brand-ink-3">
                  {t('empty')}
                </TableCell>
              </tr>
            ) : (
              props.data.products.flatMap((row) => {
                const isNeg = BigInt(row.grossMargin) < 0n;
                const rowEl = (
                  <tr
                    key={row.productId}
                    className={`cursor-pointer border-t border-brand-cream-3 text-sm hover:bg-brand-cream-2/40 ${
                      isNeg ? 'bg-rose-50/40' : ''
                    }`}
                    onClick={() => toggle(row.productId)}
                  >
                    <TableCell className="px-3 py-2 text-brand-ink">
                      {localizedName(row.productName as Record<string, unknown>)}
                      {isNeg ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                          {t('negativeMargin')}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-3 py-2 font-mono text-xs text-brand-ink-2">
                      {row.productSku}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono">
                      {fmt(row.sellPrice)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono">
                      {fmt(row.unitCost)}
                    </TableCell>
                    <TableCell
                      className={`px-3 py-2 text-right font-mono font-semibold ${
                        isNeg ? 'text-rose-600' : 'text-brand-ink'
                      }`}
                    >
                      {fmt(row.grossMargin)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-brand-ink-2">
                      {row.marginPercent != null ? `${row.marginPercent.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right text-brand-ink-3">
                      {row.bomVersion ?? '—'}
                    </TableCell>
                  </tr>
                );
                if (!expanded.has(row.productId)) return [rowEl];
                const linesEl = (
                  <tr key={`${row.productId}-lines`} className="border-t border-brand-cream-3 bg-brand-cream-2/30">
                    <TableCell colSpan={7} className="px-3 py-3">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-ink-3">
                        {t('linesTitle')}
                      </div>
                      <Table>
                        <thead className="bg-white/60 text-left text-[11px] uppercase text-brand-ink-3">
                          <tr>
                            <TableHead className="px-2 py-1">{t('linesHeader.ingredient')}</TableHead>
                            <TableHead className="px-2 py-1 text-right">{t('linesHeader.qty')}</TableHead>
                            <TableHead className="px-2 py-1">{t('linesHeader.uom')}</TableHead>
                            <TableHead className="px-2 py-1 text-right">{t('linesHeader.unitCost')}</TableHead>
                            <TableHead className="px-2 py-1 text-right">{t('linesHeader.lineCost')}</TableHead>
                          </tr>
                        </thead>
                        <TableBody>
                          {row.lines.map((l) => (
                            <tr key={`${row.productId}-${l.ingredientId}`} className="text-xs">
                              <TableCell className="px-2 py-1">
                                {localizedName(l.ingredientName as Record<string, unknown>)}
                              </TableCell>
                              <TableCell className="px-2 py-1 text-right font-mono">{l.qty}</TableCell>
                              <TableCell className="px-2 py-1 text-brand-ink-2">{l.uom}</TableCell>
                              <TableCell className="px-2 py-1 text-right font-mono">{fmt(l.unitCost)}</TableCell>
                              <TableCell className="px-2 py-1 text-right font-mono">{fmt(l.lineCost)}</TableCell>
                            </tr>
                          ))}
                        </TableBody>
                      </Table>
                    </TableCell>
                  </tr>
                );
                return [rowEl, linesEl];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
