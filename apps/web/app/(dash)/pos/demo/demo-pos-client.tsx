/**
 * Demo POS Client — main full-screen demo POS interface.
 * Assembled inside DemoCartProvider + DemoModeProvider.
 *
 * Layout mirrors production POS:
 * - Left: product panel (channel selector + product search + grid)
 * - Right: cart panel (order cart + totals + pay button)
 * - Payment modal overlay
 * - Demo banner at top
 * - Demo settings (reset/exit) button
 *
 * ADR-0008: all client-side, never calls server, never syncs to Naixer.
 */

'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { DemoModeBanner } from './components/demo-mode-banner';
import { DemoResetModal } from './components/demo-reset-modal';
import { DemoShiftBar } from './components/demo-shift-bar';
import { useDemoCart } from './demo-cart-context';
import { DemoChannelSelector } from './demo-channel-selector';
import { DemoMemberLookup } from './demo-member-lookup';
import { useDemoMode } from './demo-mode-context';
import { DemoOrderCart } from './demo-order-cart';
import { DemoPaymentModal } from './demo-payment-modal';
import { DemoProductSearch } from './demo-product-search';

export function DemoPosClient() {
  const t = useTranslations('pos');
  const { state, grandTotal, remainingBalance } = useDemoCart();
  const { demoOrderHistory } = useDemoMode();
  const [showPayment, setShowPayment] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const hasInvalidManualDiscount = state.lines.some(
    (line) => BigInt(line.lineDiscount ?? '0') > BigInt(0) && !line.lineDiscountReason?.trim(),
  );

  return (
    <>
      {/* Demo mode banner (inline, mirrors OfflineBanner placement) */}
      <DemoModeBanner />

      {/* Demo shift bar — purely sessionStorage-backed, does NOT touch
          the real `shifts` table. Mirrors the production ShiftStatusBar
          so cashiers practising on demo see the same open/close flow. */}
      <DemoShiftBar />

      {/* Main layout — mirrors real /pos shell (h-full + nested flex) */}
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-brand-cream-3 bg-card px-3 py-2">
          <QuickLink href="/pos/orders">{t('operations.orders')}</QuickLink>
          <QuickLink href="/pos/manual-sales">{t('operations.manualClosing')}</QuickLink>
          <QuickLink href="/inventory/stock">{t('operations.stock')}</QuickLink>
          <QuickLink href="/reporting/business-intelligence">{t('operations.reports')}</QuickLink>
          <QuickLink href="/settings/promotions">{t('operations.promos')}</QuickLink>
          <QuickLink href="/settings/pos">{t('operations.settings')}</QuickLink>
        </div>

        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* Left: product panel */}
          <div className="flex w-1/2 flex-col border-r border-brand-cream-3 bg-card overflow-hidden">
            <div className="border-b border-brand-cream-3 p-3 shrink-0">
              <DemoChannelSelector />
            </div>
            <DemoProductSearch />
          </div>

          {/* Right: cart panel */}
          <div className="flex w-1/2 flex-col bg-card overflow-hidden">
            {/* Cart header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-brand-cream-3 px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-brand-ink">{t('orderLines')}</h2>
                {/* Demo order history shortcut */}
                {demoOrderHistory.length > 0 && (
                  <span className="rounded bg-brand-cream-2 px-1.5 py-0.5 text-[10px] font-medium text-brand-ink-3">
                    {demoOrderHistory.length} orders
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {state.lines.length > 0 && (
                  <span className="text-xs text-brand-ink-3">
                    {t('itemCount', { count: state.lines.length })}
                  </span>
                )}
                {/* Demo settings button */}
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-brand-cream-3 px-2 text-xs text-brand-ink-3 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  title={t('demo.demoSettings')}
                >
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.774a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Member lookup + guest name (DEMO sandbox — no server) */}
            <div className="shrink-0">
              <DemoMemberLookup />
            </div>

            {/* Order lines */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <DemoOrderCart />
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
                  state.lines.length === 0 || grandTotal <= BigInt(0) || hasInvalidManualDiscount
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
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <DemoPaymentModal
          grandTotal={grandTotal.toString()}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* Reset/exit modal */}
      {showReset && <DemoResetModal onClose={() => setShowReset(false)} />}
    </>
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

function formatRupiah(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}
