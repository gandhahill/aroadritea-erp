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
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <svg
          aria-hidden="true"
          className="h-14 w-14 text-brand-ink-3/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
          />
        </svg>
        <p className="text-sm font-medium text-brand-ink-3">{t('emptyCart')}</p>
        <p className="text-xs text-brand-ink-3/60">{t('addFirstProduct')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-3">
      {state.lines.map((line) => (
        <div
          key={line.id}
          className="flex items-center gap-2 rounded-lg border border-brand-cream-3 bg-card px-3 py-2"
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
              type="button"
              onClick={() => updateLineQty(line.id, line.qty - 1)}
              className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
              aria-label="decrease"
            >
              <svg
                aria-hidden="true"
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
              type="button"
              onClick={() => updateLineQty(line.id, line.qty + 1)}
              className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
              aria-label="increase"
            >
              <svg
                aria-hidden="true"
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
              type="button"
              onClick={() => removeLine(line.id)}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600"
              aria-label="remove"
            >
              <svg
                aria-hidden="true"
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
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
