/**
 * POS Order Entry Page — SD §21.4
 *
 * Main POS screen: split layout with product list on the left,
 * order cart on the right. Channel selector and payment modal.
 */

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { ChannelSelector } from './channel-selector';
import { MemberLookup } from './member-lookup';
import { OrderCart } from './order-cart';
import { ParkCartDialog, RecallCartDialog } from './parked-orders-modal';
import { PaymentModal } from './payment-modal';
import { Button } from '@erp/ui';
import { usePosCart } from './pos-cart-context';
import { ProductSearch } from './product-search';

export default function PosPage() {
  const t = useTranslations('pos');
  const { state, grandTotal, remainingBalance, autoDiscountTotal } = usePosCart();
  const [showPayment, setShowPayment] = useState(false);
  const [showPark, setShowPark] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const hasInvalidManualDiscount = state.lines.some(
    (line) => BigInt(line.lineDiscount ?? '0') > BigInt(0) && !line.lineDiscountReason?.trim(),
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-brand-cream-3 bg-card px-3 py-2">
        <QuickLink href="/pos/orders">{t('operations.orders')}</QuickLink>
        <QuickLink href="/pos/manual-sales">{t('operations.manualClosing')}</QuickLink>
        <QuickLink href="/inventory/stock">{t('operations.stock')}</QuickLink>
        <QuickLink href="/reporting/business-intelligence">{t('operations.reports')}</QuickLink>
        <QuickLink href="/settings/promotions">{t('operations.promos')}</QuickLink>
        <QuickLink href="/settings/pos">{t('operations.settings')}</QuickLink>
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        {/* Left: product panel */}
        <div className="flex w-1/2 flex-col border-r border-brand-cream-3 bg-card overflow-hidden">
          {/* Channel selector */}
          <div className="border-b border-brand-cream-3 p-3 shrink-0">
            <ChannelSelector />
          </div>

          {/* Product search + list */}
          <ProductSearch />
        </div>

        {/* Right: cart panel */}
        <div className="flex w-1/2 flex-col bg-card overflow-hidden">
          {/* Cart header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-brand-cream-3 px-4">
            <h2 className="text-base font-semibold text-brand-ink">{t('orderLines')}</h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowRecall(true)}>{t('recallCart.btn') || 'Recalls'}</Button>
              <Button variant="secondary" size="sm" disabled={state.lines.length === 0} onClick={() => setShowPark(true)}>{t('parkCart.btn') || 'Hold'}</Button>
              {state.lines.length > 0 && (
                <span className="text-xs text-brand-ink-3">
                  {t('itemCount', { count: state.lines.length })}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <MemberLookup />
          </div>

          {/* Order lines */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <OrderCart />
          </div>

          {/* Totals + pay button */}
          <div className="border-t border-brand-cream-3 p-4 shrink-0">
            <div className="mb-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-brand-ink-3">{t('grandTotal')}</span>
                <span className="font-semibold text-brand-ink">
                  {formatRupiah(grandTotal.toString())}
                </span>
              </div>
              {autoDiscountTotal > BigInt(0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-brand-ink-3">Promo Otomatis</span>
                  <span className="font-medium text-brand-red">
                    -{formatRupiah(autoDiscountTotal.toString())}
                  </span>
                </div>
              )}
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
              disabled={
                state.lines.length === 0 ||
                !state.shiftId ||
                grandTotal <= BigInt(0) ||
                hasInvalidManualDiscount
              }
              className="h-12 w-full rounded-lg bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
              style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              {t('payNow')}
            </button>
            {hasInvalidManualDiscount && (
              <p className="mt-2 text-center text-xs font-medium text-brand-red">
                {t('manualDiscountReasonRequired')}
              </p>
            )}
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

        <ParkCartDialog open={showPark} onOpenChange={setShowPark} />
        <RecallCartDialog open={showRecall} onOpenChange={setShowRecall} />
      </div>
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-md border border-brand-cream-3 bg-brand-cream-2 px-3 py-1.5 text-xs font-semibold text-brand-ink-2 hover:border-brand-red/40 hover:text-brand-red"
    >
      {children}
    </Link>
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
