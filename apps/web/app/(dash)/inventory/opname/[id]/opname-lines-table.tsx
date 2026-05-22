/**
 * OpnameLineTable — interactive table for opname session lines.
 *
 * - draft / in_progress: editable countedQty per line with optimistic save
 * - submitted / approved: read-only with variance display
 */

'use client';

import type { OpnameLineResult } from '@erp/services/inventory/opname-service';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { recordCountAction } from '../actions';

interface Props {
  lines: OpnameLineResult[];
  status: string;
  sessionId: string;
}

function formatQty(v: string | number | null | undefined): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v);
  return isNaN(n) ? '—' : n.toLocaleString('id-ID');
}

function formatMoney(v: string | number | null | undefined): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

function varianceClass(v: string | number | null | undefined): string {
  if (!v) return 'text-brand-ink-3';
  const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v);
  if (isNaN(n)) return 'text-brand-ink-3';
  if (n > 0) return 'text-brand-jade';
  if (n < 0) return 'text-rose-500';
  return 'text-brand-ink';
}

export function OpnameLineTable({ lines, status, sessionId }: Props) {
  const t = useTranslations('inventory.opname');
  const tKinds = useTranslations('inventory.stockPerOutlet.kinds');
  const isEditable = status === 'draft' || status === 'in_progress';
  const isReadOnly = status === 'submitted' || status === 'approved' || status === 'cancelled';

  // Optimistic line state keyed by lineId
  const [optLines, setOptLines] = useState<Map<string, OpnameLineResult>>(() => {
    const map = new Map<string, OpnameLineResult>();
    for (const line of lines) map.set(line.id, { ...line });
    return map;
  });

  // Dirty lines (changed countedQty not yet saved)
  const [dirtyLines, setDirtyLines] = useState<Map<string, string>>(new Map());

  // Filter controls — by product kind + search + show-only-unposted-variance.
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState<string>('');
  const [varianceOnly, setVarianceOnly] = useState<boolean>(false);

  const allKinds = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) if (l.productKind) set.add(l.productKind);
    return Array.from(set).sort();
  }, [lines]);

  const visibleLines = useMemo(() => {
    const arr = Array.from(optLines.values());
    return arr.filter((l) => {
      if (kindFilter !== 'all' && l.productKind !== kindFilter) return false;
      if (searchQ) {
        const q = searchQ.trim().toLowerCase();
        const sku = (l.productSku ?? '').toLowerCase();
        const name = (l.productName ?? '').toLowerCase();
        if (!sku.includes(q) && !name.includes(q)) return false;
      }
      if (varianceOnly) {
        const variance = l.countedQty
          ? Number.parseFloat(l.countedQty) - Number.parseFloat(l.systemQty)
          : null;
        if (variance === null || variance === 0) return false;
      }
      return true;
    });
  }, [optLines, kindFilter, searchQ, varianceOnly]);

  const [, startTransition] = useTransition();

  function handleCountChange(lineId: string, value: string) {
    setOptLines((prev) => {
      const next = new Map(prev);
      const line = next.get(lineId);
      if (line) {
        next.set(lineId, { ...line, countedQty: value, isCounted: value.trim() !== '' });
      }
      return next;
    });
    setDirtyLines((prev) => {
      const next = new Map(prev);
      next.set(lineId, value);
      return next;
    });
  }

  async function handleSaveLine(
    lineId: string,
    productId: string,
    variantId: string | null | undefined,
  ) {
    const line = optLines.get(lineId);
    if (!line) return;

    startTransition(async () => {
      await recordCountAction({
        sessionId,
        lines: [
          {
            productId: line.productId,
            variantId: line.variantId ?? null,
            countedQty: line.countedQty ?? '',
            notes: line.notes ?? undefined,
          },
        ],
      });
      setDirtyLines((prev) => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
    });
  }

  async function handleSaveAll() {
    const dirty = Array.from(dirtyLines.entries())
      .map(([lineId, _countedQty]) => {
        const line = optLines.get(lineId);
        if (!line) return null;
        return {
          productId: line.productId,
          variantId: line.variantId ?? null,
          countedQty: line.countedQty ?? '',
          notes: line.notes ?? undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (dirty.length === 0) return;

    startTransition(async () => {
      await recordCountAction({ sessionId, lines: dirty });
      setDirtyLines(new Map());
    });
  }

  const dirtyCount = dirtyLines.size;

  function getKindLabel(kind: string) {
    const keyMap: Record<string, string> = {
      raw_material: 'rawMaterial',
      finished_good: 'finishedGood',
      consumable: 'consumable',
      merchandise: 'merchandise',
      service: 'service',
    };
    const key = keyMap[kind];
    return key ? tKinds(key) : kind;
  }

  return (
    <div>
      {/* Table header + filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-brand-cream-3 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-ink">{t('productList')}</h3>
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="h-8 min-w-44 flex-1 rounded-md border border-brand-cream-3 bg-card px-2.5 text-xs"
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="h-8 rounded-md border border-brand-cream-3 bg-card px-2 text-xs"
        >
          <option value="all">{tKinds('all')}</option>
          {allKinds.map((k) => (
            <option key={k} value={k}>
              {getKindLabel(k)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-brand-ink-3">
          <input
            type="checkbox"
            checked={varianceOnly}
            onChange={(e) => setVarianceOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-brand-cream-3"
          />
          {t('varianceOnly')}
        </label>
        <div className="ml-auto flex items-center gap-3">
          {isEditable && dirtyCount > 0 && (
            <button
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-ember-5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-ember-6"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
              {t('saveChanges', { count: dirtyCount })}
            </button>
          )}
          <span className="text-xs text-brand-ink-3">
            {visibleLines.length} / {lines.length} {t('productsCount')}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-cream-3 bg-brand-cream-1">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                {t('columns.no')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                {t('columns.sku')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                {t('columns.product')}
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-brand-ink-2">
                {t('columns.kind')}
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                {t('columns.uom')}
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                {t('columns.systemQty')}
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                {t('columns.countedQty')}
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                {t('columns.variance')}
              </th>
              {isReadOnly && (
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-ink-2">
                  {t('columns.varianceValue')}
                </th>
              )}
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                {t('columns.status')}
              </th>
              {isEditable && (
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-brand-ink-2">
                  {t('columns.action')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-2">
            {visibleLines.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-brand-ink-3">
                  {lines.length === 0 ? t('emptyList') : t('noMatchFilter')}
                </td>
              </tr>
            ) : (
              visibleLines.map((line) => {
                const counted = line.countedQty ? Number.parseFloat(line.countedQty) : Number.NaN;
                const system = line.systemQty ? Number.parseFloat(line.systemQty) : Number.NaN;
                const variance = !isNaN(counted) && !isNaN(system) ? counted - system : null;

                const isDirty = dirtyLines.has(line.id);
                const hasVariance = variance !== null && variance !== 0;

                return (
                  <tr
                    key={line.id}
                    className={`transition-colors ${isDirty ? 'bg-brand-ember-5/5' : 'hover:bg-brand-cream-1/50'}`}
                  >
                    <td className="px-4 py-2.5 text-brand-ink-3">{line.lineNo}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-ink-2">
                      {line.productSku ?? line.productId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-ink">
                      {line.productName ?? line.productSku ?? line.productId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-ink-3">
                      {line.productKind ? (
                        <span className="rounded-full bg-brand-cream-2 px-2 py-0.5 text-xs">
                          {getKindLabel(line.productKind)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-brand-ink-2">{line.uom}</td>

                    {/* System qty */}
                    <td className="px-4 py-2.5 text-right font-medium text-brand-ink">
                      {formatQty(line.systemQty)}
                    </td>

                    {/* Counted qty — editable or read-only */}
                    <td className="px-4 py-2.5 text-right">
                      {isEditable ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.countedQty ?? ''}
                          onChange={(e) => handleCountChange(line.id, e.target.value)}
                          placeholder="0"
                          className="w-24 rounded border border-brand-cream-3 bg-card px-2 py-1 text-right text-sm text-brand-ink shadow-sm transition-colors focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5"
                        />
                      ) : (
                        <span
                          className={`font-medium ${line.isCounted ? 'text-brand-ink' : 'text-brand-ink-3'}`}
                        >
                          {formatQty(line.countedQty)}
                        </span>
                      )}
                    </td>

                    {/* Variance */}
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${varianceClass(variance !== null ? String(variance) : null)}`}
                    >
                      {variance !== null ? formatQty(String(variance)) : '—'}
                    </td>

                    {/* Variance value (submitted/approved) */}
                    {isReadOnly && (
                      <td className={`px-4 py-2.5 text-right ${varianceClass(line.varianceValue)}`}>
                        {line.varianceValue ? formatMoney(line.varianceValue) : '—'}
                      </td>
                    )}

                    {/* Counted badge */}
                    <td className="px-4 py-2.5 text-center">
                      {line.isCounted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-jade/10 px-2 py-0.5 text-xs font-medium text-brand-jade">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          Ok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-cream-2 px-2 py-0.5 text-xs font-medium text-brand-ink-3">
                          —
                        </span>
                      )}
                    </td>

                    {/* Save button */}
                    {isEditable && (
                      <td className="px-4 py-2.5 text-center">
                        {isDirty && (
                          <button
                            onClick={() => handleSaveLine(line.id, line.productId, line.variantId)}
                            className="inline-flex items-center gap-1 rounded bg-brand-ember-5 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-ember-6"
                          >
                            {t('saveAction')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
