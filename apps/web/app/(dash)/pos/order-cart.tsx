/**
 * Order Cart — SD §21.4
 *
 * Displays current order lines with qty controls, remove, and notes.
 */

'use client';

import { Input } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type CartLine, usePosCart } from './pos-cart-context';

export function OrderCart() {
  const t = useTranslations('pos');
  const { state, updateLineQty, removeLine, updateLineNotes, updateLineDiscount } = usePosCart();

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
    <ul className="divide-y divide-brand-cream-3">
      {state.lines.map((line, idx) => (
        <CartLineItem
          key={line.id}
          line={line}
          lineNo={idx + 1}
          onQtyChange={(qty) => updateLineQty(line.id, qty)}
          onRemove={() => removeLine(line.id)}
          onNotesChange={(notes) => updateLineNotes(line.id, notes)}
          onDiscountChange={(discount, reason) => updateLineDiscount(line.id, discount, reason)}
        />
      ))}
    </ul>
  );
}

function CartLineItem({
  line,
  lineNo,
  onQtyChange,
  onRemove,
  onNotesChange,
  onDiscountChange,
}: {
  line: CartLine;
  lineNo: number;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
  onNotesChange: (notes: string) => void;
  onDiscountChange: (discount: string, reason: string) => void;
}) {
  const t = useTranslations('pos');
  const [discountOpen, setDiscountOpen] = useState(Boolean(line.lineDiscountReason));
  const [discountInput, setDiscountInput] = useState(line.lineDiscount ?? '0');
  const [reasonInput, setReasonInput] = useState(line.lineDiscountReason ?? '');

  const lineTotal = BigInt(line.unitPrice) * BigInt(line.qty);
  const lineDiscount = BigInt(line.lineDiscount ?? '0');
  const lineAfterDiscount = lineTotal - lineDiscount;
  const lineGrand = lineAfterDiscount;

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
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        {/* Line number + product name */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-brand-ink-3">{lineNo}.</span>
            <p className="text-sm font-medium text-brand-ink">{line.productName}</p>
          </div>
          {line.variantName && <p className="text-xs text-brand-ink-3">{line.variantName}</p>}
          {line.modifierJson && line.modifierJson.length > 0 && (
            <p className="text-xs text-brand-ink-3">
              {line.modifierJson.map((m) => m.optionName).join(', ')}
            </p>
          )}
        </div>

        {/* Line total */}
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-brand-ink">{formatRupiah(lineGrand)}</p>
          {lineDiscount > BigInt(0) && (
            <p className="text-xs text-brand-red line-through">{formatRupiah(lineTotal)}</p>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Qty controls */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center overflow-hidden rounded-md border border-brand-cream-3">
            <button
              type="button"
              onClick={() => handleQtyChange(Math.max(1, line.qty - 1))}
              className="flex h-full w-8 items-center justify-center text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium text-brand-ink">{line.qty}</span>
            <button
              type="button"
              onClick={() => handleQtyChange(line.qty + 1)}
              className="flex h-full w-8 items-center justify-center text-sm font-medium text-brand-ink hover:bg-brand-cream-2"
            >
              +
            </button>
          </div>

          <span className="text-xs text-brand-ink-3">@ {formatRupiah(line.unitPrice)}</span>
        </div>

        {/* Remove button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDiscountOpen((open) => !open)}
            className="h-8 rounded-md border border-brand-cream-3 px-2 text-xs font-medium text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
          >
            {t('discount')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-md text-brand-ink-3 hover:bg-red-50 hover:text-red-500"
            aria-label={t('removeLine')}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
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

      {discountOpen && (
        <div className="rounded-lg border border-brand-cream-3 bg-brand-cream-2 p-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase text-brand-ink-3">
                {t('manualDiscountAmount')}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={discountInput}
                onChange={(e) => {
                  const next = clampDiscount(e.target.value.replace(/\D/g, ''), lineTotal);
                  setDiscountInput(next);
                  onDiscountChange(next, reasonInput);
                }}
                className="h-8 rounded-md border border-brand-cream-3 bg-card px-2 text-xs font-medium text-brand-ink focus:border-brand-red focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase text-brand-ink-3">
                {t('manualDiscountReason')}
              </span>
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => {
                  setReasonInput(e.target.value);
                  onDiscountChange(discountInput, e.target.value);
                }}
                placeholder={t('manualDiscountReasonPlaceholder')}
                maxLength={255}
                className="h-8 rounded-md border border-brand-cream-3 bg-card px-2 text-xs font-medium text-brand-ink placeholder:text-brand-ink-3/50 focus:border-brand-red focus:outline-none"
              />
            </label>
            <div className="flex items-end gap-1">
              {[5, 10, 15, 20].map((percent) => (
                <button
                  type="button"
                  key={percent}
                  onClick={() => {
                    const next = ((lineTotal * BigInt(percent)) / BigInt(100)).toString();
                    setDiscountInput(next);
                    onDiscountChange(next, reasonInput);
                  }}
                  className="h-8 rounded-md border border-brand-cream-3 bg-card px-2 text-[11px] font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
                >
                  {percent}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDiscountInput('0');
                  setReasonInput('');
                  onDiscountChange('0', '');
                }}
                className="h-8 rounded-md border border-brand-cream-3 bg-card px-2 text-[11px] font-semibold text-brand-ink-3 hover:border-brand-red/40 hover:text-brand-red"
              >
                {t('clearDiscount')}
              </button>
            </div>
          </div>
          {BigInt(discountInput || '0') > BigInt(0) && !reasonInput.trim() && (
            <p className="mt-1 text-[11px] font-medium text-brand-red">
              {t('manualDiscountReasonRequired')}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <Input
        type="text"
        value={line.notes ?? ''}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={t('orderNotes')}
        maxLength={255}
        className="h-7 w-full rounded border border-brand-cream-3 bg-brand-cream-2 px-2 text-xs text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
      />
    </li>
  );
}

function clampDiscount(value: string, max: bigint): string {
  const parsed = /^\d+$/.test(value) ? BigInt(value) : BigInt(0);
  if (parsed > max) return max.toString();
  return parsed.toString();
}

function formatRupiah(value: string | bigint): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
