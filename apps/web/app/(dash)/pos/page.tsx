/**
 * POS Order Entry Page — SD §21.4
 *
 * Main POS screen: split layout with product list on the left,
 * order cart on the right. Channel selector and payment modal.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChannelSelector } from './channel-selector';
import { MemberLookup } from './member-lookup';
import { OrderCart } from './order-cart';
import { PaymentModal } from './payment-modal';
import { usePosCart } from './pos-cart-context';
import { ProductSearch } from './product-search';

export default function PosPage() {
  const t = useTranslations('pos');
  const { state, grandTotal, remainingBalance } = usePosCart();
  const [showPayment, setShowPayment] = useState(false);

  return (
    <div className="flex h-full flex-1 gap-0">
      {/* Left: product panel */}
      <div className="flex w-1/2 flex-col border-r border-brand-cream-3 bg-card">
        {/* Channel selector */}
        <div className="border-b border-brand-cream-3 p-3">
          <ChannelSelector />
        </div>

        {/* Product search + list */}
        <ProductSearch />
      </div>

      {/* Right: cart panel */}
      <div className="flex w-1/2 flex-col bg-card">
        {/* Cart header */}
        <div className="flex h-14 items-center justify-between border-b border-brand-cream-3 px-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('orderLines')}</h2>
          {state.lines.length > 0 && (
            <span className="text-xs text-brand-ink-3">
              {t('itemCount', { count: state.lines.length })}
            </span>
          )}
        </div>

        <MemberLookup />

        {/* Order lines */}
        <div className="flex-1 overflow-y-auto">
          <OrderCart />
        </div>

        {/* Totals + pay button */}
        <div className="border-t border-brand-cream-3 p-4">
          <div className="mb-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-brand-ink-3">{t('grandTotal')}</span>
              <span className="font-semibold text-brand-ink">
                {formatRupiah(grandTotal.toString())}
              </span>
            </div>
            {remainingBalance > BigInt(0) && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-ink-3">{t('remainingBalance')}</span>
                <span className="font-medium text-brand-red">
                  {formatRupiah(remainingBalance.toString())}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPayment(true)}
            disabled={state.lines.length === 0 || !state.shiftId || grandTotal <= BigInt(0)}
            className="h-12 w-full rounded-lg bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {t('payNow')}
          </button>
          {!state.shiftId && (
            <p className="mt-2 text-center text-xs font-medium text-brand-red">
              {t('shiftRequired')}
            </p>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal grandTotal={grandTotal.toString()} onClose={() => setShowPayment(false)} />
      )}
    </div>
  );
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
