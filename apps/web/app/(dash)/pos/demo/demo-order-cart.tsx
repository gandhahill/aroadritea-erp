/**
 * Demo Order Cart - shows the current demo cart lines + totals.
 * Mirrors production `order-cart.tsx` but uses `useDemoCart`.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useDemoCart } from './demo-cart-context';

export function DemoOrderCart() {
  const t = useTranslations('pos');
  const { state, updateLineQty, removeLine, updateLineDiscount } = useDemoCart();

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
        <DemoLineItem
          key={line.id}
          line={line}
          onQtyChange={(qty) => updateLineQty(line.id, Math.max(1, qty))}
          onRemove={() => removeLine(line.id)}
          onDiscountChange={(discount, reason) => updateLineDiscount(line.id, discount, reason)}
        />
      ))}
    </div>
  );
}

function DemoLineItem({
  line,
  onQtyChange,
  onRemove,
  onDiscountChange,
}: {
  line: ReturnType<typeof useDemoCart>['state']['lines'][number];
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  onDiscountChange: (discount: string, reason: string) => void;
}) {
  const t = useTranslations('pos');
  const [discountOpen, setDiscountOpen] = useState(Boolean(line.lineDiscountReason));
  const [discountInput, setDiscountInput] = useState(line.lineDiscount ?? '0');
  const [reasonInput, setReasonInput] = useState(line.lineDiscountReason ?? '');
  const lineSubtotal = BigInt(line.unitPrice) * BigInt(line.qty);
  const lineDiscount = BigInt(line.lineDiscount ?? '0');
  const lineTotal = lineSubtotal - lineDiscount;

  const handleQtyChange = (newQty: number) => {
    if (newQty === line.qty) return;
    const oldTotal = BigInt(line.unitPrice) * BigInt(line.qty);
    const oldDiscount = BigInt(line.lineDiscount ?? '0');

    onQtyChange(newQty);

    if (oldDiscount > BigInt(0)) {
      const pct = Number((oldDiscount * BigInt(100)) / oldTotal);
      if ([5, 10, 15, 20].includes(pct) && (oldTotal * BigInt(pct)) / BigInt(100) === oldDiscount) {
        const newTotal = BigInt(line.unitPrice) * BigInt(newQty);
        const newDiscount = ((newTotal * BigInt(pct)) / BigInt(100)).toString();
        setDiscountInput(newDiscount);
        onDiscountChange(newDiscount, reasonInput);
      }
    }
  };

  return (
    <div className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-ink">
            {line.productName}
            {line.variantName && (
              <span className="ml-1 text-xs text-brand-ink-3">({line.variantName})</span>
            )}
          </p>
          <p className="text-xs text-brand-ink-3">
            {formatRupiah(line.unitPrice)} x {line.qty}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-brand-ink">
            {formatRupiah(lineTotal.toString())}
          </p>
          {lineDiscount > BigInt(0) && (
            <p className="text-xs text-brand-red line-through">
              {formatRupiah(lineSubtotal.toString())}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleQtyChange(line.qty - 1)}
            className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
            aria-label="decrease"
          >
            -
          </button>
          <span className="w-6 text-center text-xs font-semibold text-brand-ink">{line.qty}</span>
          <button
            type="button"
            onClick={() => handleQtyChange(line.qty + 1)}
            className="flex h-6 w-6 items-center justify-center rounded border border-brand-cream-3 text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
            aria-label="increase"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setDiscountOpen((open) => !open)}
            className="ml-1 h-6 rounded border border-brand-cream-3 px-2 text-[11px] font-medium text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
          >
            {t('discount')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-6 w-6 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600"
            aria-label="remove"
          >
            x
          </button>
        </div>
      </div>

      {discountOpen && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
          <input
            type="text"
            inputMode="numeric"
            value={discountInput}
            aria-label={t('manualDiscountAmount')}
            onChange={(event) => {
              const next = clampDiscount(event.target.value.replace(/\D/g, ''), lineSubtotal);
              setDiscountInput(next);
              onDiscountChange(next, reasonInput);
            }}
            className="h-8 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 text-xs font-medium text-brand-ink focus:border-brand-red focus:outline-none"
          />
          <input
            type="text"
            value={reasonInput}
            aria-label={t('manualDiscountReason')}
            placeholder={t('manualDiscountReasonPlaceholder')}
            maxLength={255}
            onChange={(event) => {
              setReasonInput(event.target.value);
              onDiscountChange(discountInput, event.target.value);
            }}
            className="h-8 rounded-md border border-brand-cream-3 bg-brand-cream-2 px-2 text-xs font-medium text-brand-ink placeholder:text-brand-ink-3/50 focus:border-brand-red focus:outline-none"
          />
          <div className="flex gap-1">
            {[5, 10, 15].map((percent) => (
              <button
                type="button"
                key={percent}
                onClick={() => {
                  const next = ((lineSubtotal * BigInt(percent)) / BigInt(100)).toString();
                  setDiscountInput(next);
                  onDiscountChange(next, reasonInput);
                }}
                className="h-8 rounded-md border border-brand-cream-3 px-2 text-[11px] font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      )}
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

function clampDiscount(value: string, max: bigint): string {
  const parsed = /^\d+$/.test(value) ? BigInt(value) : BigInt(0);
  if (parsed > max) return max.toString();
  return parsed.toString();
}
