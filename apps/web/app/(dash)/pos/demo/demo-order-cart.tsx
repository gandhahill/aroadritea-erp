/**
 * Demo Order Cart — shows the current demo cart lines + totals.
 * Mirrors production `order-cart.tsx` but uses `useDemoCart`.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useDemoCart } from './demo-cart-context';

export function DemoOrderCart() {
  const t = useTranslations('pos');
  const { state, updateLineQty, removeLine } = useDemoCart();

  if (state.lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl">🛒</span>
        <p className="mt-2 text-sm text-brand-ink-3">{t('emptyCart')}</p>
        <p className="mt-1 text-xs text-brand-ink-3">{t('addFirstProduct')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-3">
      {state.lines.map((line) => (
        <div
          key={line.id}
          className="flex items-center gap-2 rounded-lg border border-brand-cream-3 bg-white px-3 py-2"
        >
          {/* Product info */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-brand-ink">
              {line.productName}
              {line.variantName && (
                <span className="ml-1 text-xs text-brand-ink-3">({line.variantName})</span>
              )}
            </p>
            <p className="text-xs text-brand-ink-3">
              {formatRupiah(line.unitPrice)} × {line.qty}
            </p>
          </div>

          {/* Line total */}
          <div className="text-right">
            <p className="text-sm font-semibold text-brand-ink">
              {formatRupiah((BigInt(line.unitPrice) * BigInt(line.qty)).toString())}
            </p>
          </div>

          {/* Qty controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateLineQty(line.id, line.qty - 1)}
              className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
              aria-label="decrease"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <span className="w-6 text-center text-xs font-semibold text-brand-ink">{line.qty}</span>
            <button
              onClick={() => updateLineQty(line.id, line.qty + 1)}
              className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
              aria-label="increase"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
              </svg>
            </button>
            <button
              onClick={() => removeLine(line.id)}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600"
              aria-label="remove"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
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
