/**
 * Payment Modal — SD §21.4
 *
 * Full payment flow with split payment support, change calculation.
 * On confirmation, calls createSaleAction server action.
 */

'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { usePosCart } from './pos-cart-context';
import { useOfflineSync } from './lib/offline-sync-context';
import { createSaleAction } from './actions';

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

interface PaymentModalProps {
  grandTotal: string;
  onClose: () => void;
}

export function PaymentModal({ grandTotal, onClose }: PaymentModalProps) {
  const t = useTranslations('pos');
  const { state, totalPaid, grandTotal: cartTotal, clearCart } = usePosCart();
  const { isOnline, enqueueOrder } = useOfflineSync();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalBig = BigInt(grandTotal);
  const paidBig = totalPaid;
  const remaining = totalBig - paidBig > BigInt(0) ? totalBig - paidBig : BigInt(0);

  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [inputAmount, setInputAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: string }[]>([]);

  // Cash tendered so far in this modal (numeric input + split list)
  const currentInputBig = BigInt(Number(inputAmount) > 0 ? inputAmount : '0');
  const splitTotal = splitPayments.reduce((s, p) => s + BigInt(Number(p.amount) > 0 ? p.amount : '0'), BigInt(0));
  const allPaidBig = paidBig + splitTotal + currentInputBig;
  const excess = allPaidBig > totalBig ? allPaidBig - totalBig : BigInt(0);
  const isFullyPaid = allPaidBig >= totalBig;
  const canConfirm = remaining > BigInt(0) ? false : isFullyPaid;

  function handleAddSplit() {
    if (!inputAmount || Number(inputAmount) <= 0) return;
    setSplitPayments(prev => [...prev, { method: selectedMethod, amount: inputAmount }]);
    setInputAmount('');
  }

  function handleRemoveSplit(idx: number) {
    setSplitPayments(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    // Build payments array — existing payments from cart + split list
    const payments = [
      ...state.payments.map(p => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      })),
      ...splitPayments.map(p => ({ method: p.method, amount: p.amount })),
    ];

    // Add cash payment only if customer handed cash and it covers the total
    if (inputAmount && Number(inputAmount) > 0 && currentInputBig + paidBig + splitTotal >= totalBig) {
      payments.push({ method: selectedMethod, amount: inputAmount });
    }

    // Build order lines from cart
    const lines = state.lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId ?? undefined,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineDiscount: l.lineDiscount,
      modifierJson: l.modifierJson,
      notes: l.notes,
    }));

    const input = {
      shiftId: state.shiftId ?? '',
      channel: state.channel,
      locationId: state.locationId,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      lines,
      payments,
      notes: state.notes,
    };

    startTransition(async () => {
      setError(null);

      // Online: call server action directly
      if (isOnline) {
        const result = await createSaleAction(input as Parameters<typeof createSaleAction>[0]);
        if (result.ok) {
          clearCart();
          onClose();
        } else {
          setError(result.error?.message ?? t('paymentFailed'));
        }
        return;
      }

      // Offline: enqueue to IndexedDB outbox immediately
      const clientOrderUuid = input.idempotencyKey;
      await enqueueOrder({
        clientOrderUuid,
        createdAtClient: new Date().toISOString(),
        payload: input,
      });

      clearCart();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
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
          {/* Grand total display */}
          <div className="flex items-center justify-between rounded-xl border border-brand-red/20 bg-brand-red/5 px-4 py-3">
            <span className="text-sm font-medium text-brand-ink-2">{t('grandTotal')}</span>
            <span className="text-xl font-bold text-brand-red">{formatRupiah(grandTotal)}</span>
          </div>

          {/* Payment method grid */}
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

          {/* Cash amount input — shown for cash method when not yet fully paid */}
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
                    placeholder={formatRupiah(remaining.toString())}
                    className="h-12 w-full rounded-lg border border-brand-cream-3 bg-white py-2 pl-8 pr-3 text-base font-semibold text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                  />
                </div>
                {remaining > BigInt(0) && (
                  <button
                    onClick={() => setInputAmount(remaining.toString())}
                    className="h-12 rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-4 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-3"
                  >
                    {t('fullPayment')}
                  </button>
                )}
              </div>
              {excess > BigInt(0) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-brand-jade">{t('change')}:</span>
                  <span className="text-sm font-semibold text-brand-jade">{formatRupiah(excess.toString())}</span>
                </div>
              )}
            </div>
          )}

          {/* Cash change indicator — shown when fully paid via cash */}
          {isFullyPaid && excess > BigInt(0) && selectedMethod === 'cash' && (
            <div className="flex items-center justify-between rounded-lg border border-brand-jade/20 bg-brand-jade/5 px-4 py-2.5">
              <span className="text-sm font-medium text-brand-ink-2">{t('change')}</span>
              <span className="text-base font-semibold text-brand-jade">{formatRupiah(excess.toString())}</span>
            </div>
          )}

          {/* Split payment list */}
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
                    <button
                      onClick={() => handleRemoveSplit(i)}
                      className="text-brand-ink-3 hover:text-red-500"
                      aria-label="remove"
                    >
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

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Footer — confirm button */}
        <div className="border-t border-brand-cream-3 p-5">
          <button
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
            className="h-12 w-full rounded-xl bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
            style={{ transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {isPending ? t('loading') : t('processPayment')}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value: string | bigint): string {
  const num = Number(value);
  if (isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}