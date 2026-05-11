/**
 * Demo Payment Modal — full payment flow for demo POS.
 * Mirrors production `payment-modal.tsx` but:
 * - No server action (all in-memory)
 * - Generates DEMO-XXX order number
 * - Shows demo receipt preview after payment
 * - Adds order to demo history
 *
 * ADR-0008 §QR: QR payload prefix is `DEMO-` so Naixer won't read it.
 */

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDemoCart } from './demo-cart-context';
import { useDemoMode } from './demo-mode-context';
import { getNextDemoOrderNumber, buildDemoQrPayload } from '@erp/offline';
import { DemoReceiptPreview } from './components/demo-receipt-preview';
import type { DemoOrder } from '@erp/offline';

const PAYMENT_METHODS = [
  { id: 'cash', icon: '💵' },
  { id: 'qris', icon: '📱' },
  { id: 'flazz', icon: '💳' },
  { id: 'debit', icon: '💳' },
  { id: 'credit', icon: '💳' },
  { id: 'gofood', icon: '🛵' },
  { id: 'grabfood', icon: '🛵' },
  { id: 'shopeefood', icon: '🛵' },
] as const;

interface DemoPaymentModalProps {
  grandTotal: string;
  onClose: () => void;
}

export function DemoPaymentModal({ grandTotal, onClose }: DemoPaymentModalProps) {
  const t = useTranslations('pos');
  const { state, grandTotal: cartTotal, clearCart } = useDemoCart();
  const { addDemoOrder } = useDemoMode();

  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [inputAmount, setInputAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: string }[]>([]);
  const [completedOrder, setCompletedOrder] = useState<DemoOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalBig = BigInt(grandTotal);
  const paidBig = state.payments.reduce(
    (sum, p) => sum + BigInt(Number(p.amount) > 0 ? p.amount : '0'),
    BigInt(0),
  );
  const splitTotal = splitPayments.reduce(
    (s, p) => s + BigInt(Number(p.amount) > 0 ? p.amount : '0'),
    BigInt(0),
  );
  const currentInputBig = BigInt(Number(inputAmount) > 0 ? inputAmount : '0');
  const allPaidBig = paidBig + splitTotal + currentInputBig;
  const excess = allPaidBig > totalBig ? allPaidBig - totalBig : BigInt(0);
  const isFullyPaid = allPaidBig >= totalBig;
  const canConfirm = isFullyPaid;

  function handleAddSplit() {
    if (!inputAmount || Number(inputAmount) <= 0) return;
    setSplitPayments(prev => [...prev, { method: selectedMethod, amount: inputAmount }]);
    setInputAmount('');
  }

  function handleRemoveSplit(idx: number) {
    setSplitPayments(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    setError(null);
    try {
      const orderNumber = await getNextDemoOrderNumber();
      const subtotal = state.lines.reduce(
        (sum, l) => sum + BigInt(l.unitPrice) * BigInt(l.qty),
        BigInt(0),
      );
      const taxTotal = subtotal * BigInt(10) / BigInt(110);

      // Build payments from cart + split list + current input
      const payments: typeof state.payments = [
        ...state.payments,
        ...splitPayments.map(p => ({ id: crypto.randomUUID(), ...p })),
        ...(inputAmount && Number(inputAmount) > 0 && allPaidBig >= totalBig
          ? [{ id: crypto.randomUUID(), method: selectedMethod, amount: inputAmount }]
          : []),
      ];

      const order: DemoOrder = {
        orderNumber,
        channel: state.channel,
        lines: state.lines,
        payments,
        grandTotal: totalBig.toString(),
        taxTotal: taxTotal.toString(),
        subtotal: subtotal.toString(),
        notes: state.notes,
        placedAt: new Date().toISOString(),
      };

      addDemoOrder(order);
      setCompletedOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('paymentFailed'));
    }
  }

  // Show receipt if order completed
  if (completedOrder) {
    return (
      <DemoReceiptPreview
        order={completedOrder}
        onClose={() => {
          clearCart();
          setCompletedOrder(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('payment')}</h2>
          <button onClick={onClose} className="text-brand-ink-3 hover:text-brand-ink" aria-label="close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Grand total */}
          <div className="flex items-center justify-between rounded-xl border border-brand-red/20 bg-brand-red/5 px-4 py-3">
            <span className="text-sm font-medium text-brand-ink-2">{t('grandTotal')}</span>
            <span className="text-xl font-bold text-brand-red">{formatRupiah(grandTotal)}</span>
          </div>

          {/* Payment methods */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
              {t('paymentMethod')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-all ${
                    selectedMethod === m.id
                      ? 'border-brand-red bg-brand-red/5 text-brand-red'
                      : 'border-brand-cream-3 text-brand-ink-2 hover:border-brand-red/30'
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  <span>{t(`paymentMethods.${m.id}` as never)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash input */}
          {selectedMethod === 'cash' && !isFullyPaid && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('paymentAmount')}
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-3">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inputAmount}
                    onChange={e => setInputAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder={formatRupiah((totalBig - paidBig - splitTotal).toString())}
                    className="h-12 w-full rounded-lg border border-brand-cream-3 bg-white py-2 pl-8 pr-3 text-base font-semibold text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                  />
                </div>
                <button
                  onClick={() => setInputAmount((totalBig - paidBig - splitTotal).toString())}
                  className="h-12 rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-4 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-3"
                >
                  {t('fullPayment')}
                </button>
              </div>
              {excess > BigInt(0) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-brand-jade">{t('change')}:</span>
                  <span className="text-sm font-semibold text-brand-jade">{formatRupiah(excess.toString())}</span>
                </div>
              )}
            </div>
          )}

          {/* Change shown when fully paid */}
          {isFullyPaid && excess > BigInt(0) && selectedMethod === 'cash' && (
            <div className="flex items-center justify-between rounded-lg border border-brand-jade/20 bg-brand-jade/5 px-4 py-2.5">
              <span className="text-sm font-medium text-brand-ink-2">{t('change')}</span>
              <span className="text-base font-semibold text-brand-jade">{formatRupiah(excess.toString())}</span>
            </div>
          )}

          {/* Split payments */}
          {splitPayments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('splitPayment')}
              </p>
              <ul className="space-y-2">
                {splitPayments.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-ink-3">{t(`paymentMethods.${p.method}` as never)}</span>
                      <span className="text-sm font-medium text-brand-ink">{formatRupiah(p.amount)}</span>
                    </div>
                    <button onClick={() => handleRemoveSplit(i)} className="text-brand-ink-3 hover:text-red-500" aria-label="remove">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleAddSplit}
                disabled={!inputAmount || Number(inputAmount) <= 0}
                className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-dashed border-brand-cream-3 px-3 text-xs font-medium text-brand-ink-3 hover:border-brand-red/30 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40"
              >
                + {t('addPayment')}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-cream-3 p-5">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="h-12 w-full rounded-xl bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {t('processPayment')}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}