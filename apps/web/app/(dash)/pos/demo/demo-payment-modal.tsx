/**
 * Demo Payment Modal.
 *
 * Mirrors the production payment flow while keeping every order client-side.
 * Demo orders never call server actions, never sync, and use DEMO order numbers.
 */

'use client';

import { getNextDemoOrderNumber } from '@erp/offline';
import type { DemoOrder } from '@erp/offline';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { type RoundingOption, getDonationOptions } from '../lib/donation-options';
import { DemoReceiptPreview } from './components/demo-receipt-preview';
import { useDemoCart } from './demo-cart-context';
import { useDemoMode } from './demo-mode-context';

const BASE_PAYMENT_METHODS = [
  { id: 'cash', badge: 'Rp' },
  { id: 'qris', badge: 'QR' },
  { id: 'flazz', badge: 'FLZ' },
  { id: 'debit', badge: 'DBT' },
  { id: 'credit', badge: 'CRD' },
] as const;

interface DemoPaymentModalProps {
  grandTotal: string;
  onClose: () => void;
}

interface SplitPayment {
  id: string;
  method: string;
  amount: string;
}

export function DemoPaymentModal({ grandTotal, onClose }: DemoPaymentModalProps) {
  const t = useTranslations('pos');
  const { state, clearCart } = useDemoCart();
  const { addDemoOrder } = useDemoMode();

  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [inputAmount, setInputAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [completedOrder, setCompletedOrder] = useState<DemoOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [donationChoice, setDonationChoice] = useState<RoundingOption>('no_donation');

  const totalBig = BigInt(grandTotal);
  const paidBig = state.payments.reduce((sum, p) => sum + parseMoney(p.amount), BigInt(0));
  const splitTotal = splitPayments.reduce((sum, payment) => sum + parseMoney(payment.amount), BigInt(0));
  const currentInputBig = parseMoney(inputAmount);
  const remaining =
    totalBig - paidBig - splitTotal > BigInt(0) ? totalBig - paidBig - splitTotal : BigInt(0);
  const allPaidBig = paidBig + splitTotal + currentInputBig;
  const nonCashPaidBig =
    state.payments
      .filter((payment) => payment.method !== 'cash')
      .reduce((sum, payment) => sum + parseMoney(payment.amount), BigInt(0)) +
    splitPayments
      .filter((payment) => payment.method !== 'cash')
      .reduce((sum, payment) => sum + parseMoney(payment.amount), BigInt(0)) +
    (selectedMethod !== 'cash' ? currentInputBig : BigInt(0));
  const excess = allPaidBig > totalBig ? allPaidBig - totalBig : BigInt(0);
  const isFullyPaid = allPaidBig >= totalBig;
  const nonCashOverpay = nonCashPaidBig > totalBig;
  const canConfirm = isFullyPaid && !nonCashOverpay;
  const canAddSplit =
    inputAmount !== '' && currentInputBig > BigInt(0) && currentInputBig < remaining;

  const paymentMethods = useMemo(() => {
    if (state.channel === 'walk_in') return [...BASE_PAYMENT_METHODS];
    return [...BASE_PAYMENT_METHODS, { id: state.channel, badge: channelBadge(state.channel) }];
  }, [state.channel]);

  const donationOptions = useMemo(() => {
    if (excess <= BigInt(0) || selectedMethod !== 'cash') return [];
    return getDonationOptions(excess);
  }, [excess, selectedMethod]);

  function handleAddSplit() {
    if (!canAddSplit) return;
    setSplitPayments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), method: selectedMethod, amount: inputAmount },
    ]);
    setInputAmount('');
  }

  function handleRemoveSplit(id: string) {
    setSplitPayments((prev) => prev.filter((payment) => payment.id !== id));
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setError(null);

    try {
      const orderNumber = await getNextDemoOrderNumber();
      const subtotal = state.lines.reduce(
        (sum, line) => sum + BigInt(line.unitPrice) * BigInt(line.qty),
        BigInt(0),
      );
      const taxTotal = (totalBig * BigInt(10)) / BigInt(110);
      const donationResult =
        excess > BigInt(0) && donationChoice !== 'no_donation'
          ? getDonationOptions(excess).find((option) => option.choice.type === donationChoice)
          : undefined;

      const payments: typeof state.payments = [
        ...state.payments,
        ...splitPayments.map((payment) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
        })),
      ];

      if (
        inputAmount &&
        currentInputBig > BigInt(0) &&
        currentInputBig + paidBig + splitTotal >= totalBig
      ) {
        payments.push({
          id: crypto.randomUUID(),
          method: selectedMethod,
          amount: inputAmount,
          ...(selectedMethod === 'cash' &&
          donationResult &&
          donationResult.donatedAmount > BigInt(0)
            ? {
                donationAmount: donationResult.donatedAmount.toString(),
                roundingOption: donationChoice,
              }
            : {}),
        });
      }

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
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-2xl sm:h-auto sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('payment')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-ink-3 hover:text-brand-ink"
            aria-label="close"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between rounded-xl border border-brand-red/20 bg-brand-red/5 px-4 py-3">
            <span className="text-sm font-medium text-brand-ink-2">{t('grandTotal')}</span>
            <span className="text-xl font-bold text-brand-red">{formatRupiah(grandTotal)}</span>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
              {t('paymentMethod')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map((method) => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-all ${
                    selectedMethod === method.id
                      ? 'border-brand-red bg-brand-red/5 text-brand-red'
                      : 'border-brand-cream-3 text-brand-ink-2 hover:border-brand-red/30'
                  }`}
                >
                  <span className="rounded bg-brand-cream-3 px-1.5 py-0.5 text-[10px] font-bold">
                    {method.badge}
                  </span>
                  <span>{paymentMethodLabel(method.id, t)}</span>
                </button>
              ))}
            </div>
          </div>

          {!isFullyPaid && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('paymentAmount')}
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-ink-3">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inputAmount}
                    onChange={(event) => setInputAmount(event.target.value.replace(/\D/g, ''))}
                    placeholder={formatRupiah(remaining.toString())}
                    className="h-12 w-full rounded-lg border border-brand-cream-3 bg-card py-2 pl-8 pr-3 text-base font-semibold text-brand-ink placeholder:text-brand-ink-3/50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-brand-cream),0_0_0_4px_var(--color-brand-red)]"
                  />
                </div>
                {remaining > BigInt(0) && (
                  <button
                    type="button"
                    onClick={() => setInputAmount(remaining.toString())}
                    className="h-12 rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-4 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-3"
                  >
                    {t('fullPayment')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddSplit}
                  disabled={!canAddSplit}
                  className="h-12 rounded-lg border border-brand-cream-3 px-3 text-xs font-medium text-brand-ink-2 hover:bg-brand-cream-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('addPayment')}
                </button>
              </div>
              {nonCashOverpay && (
                <p className="mt-1.5 text-xs font-medium text-brand-red">{t('nonCashOverpay')}</p>
              )}
              {selectedMethod === 'cash' && excess > BigInt(0) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-brand-jade">{t('change')}:</span>
                  <span className="text-sm font-semibold text-brand-jade">
                    {formatRupiah(excess.toString())}
                  </span>
                </div>
              )}
            </div>
          )}

          {isFullyPaid && excess > BigInt(0) && selectedMethod === 'cash' && (
            <div className="flex items-center justify-between rounded-lg border border-brand-jade/20 bg-brand-jade/5 px-4 py-2.5">
              <span className="text-sm font-medium text-brand-ink-2">{t('change')}</span>
              <span className="text-base font-semibold text-brand-jade">
                {formatRupiah(excess.toString())}
              </span>
            </div>
          )}

          {isFullyPaid && donationOptions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('donationChoice')}
              </p>
              <div className="space-y-1.5">
                {donationOptions.map((option) => (
                  <button
                    type="button"
                    key={option.choice.type}
                    onClick={() => setDonationChoice(option.choice.type)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                      donationChoice === option.choice.type
                        ? 'border-brand-red bg-brand-red/5'
                        : 'border-brand-cream-3 hover:border-brand-red/30'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${donationChoice === option.choice.type ? 'text-brand-red' : 'text-brand-ink-2'}`}
                    >
                      {option.choice.description}
                    </span>
                    {option.donatedAmount > BigInt(0) && (
                      <span className="text-xs font-medium text-brand-ink-3">
                        {formatRupiah(option.donatedAmount.toString())}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {splitPayments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('splitPayment')}
              </p>
              <ul className="space-y-2">
                {splitPayments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-ink-3">
                        {paymentMethodLabel(payment.method, t)}
                      </span>
                      <span className="text-sm font-medium text-brand-ink">
                        {formatRupiah(payment.amount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(payment.id)}
                      className="text-brand-ink-3 hover:text-red-500"
                      aria-label="remove"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleAddSplit}
                disabled={!canAddSplit}
                className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-dashed border-brand-cream-3 px-3 text-xs font-medium text-brand-ink-3 hover:border-brand-red/30 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40"
              >
                + {t('addPayment')}
              </button>
            </div>
          )}

          {nonCashOverpay && isFullyPaid && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {t('nonCashOverpay')}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-brand-cream-3 p-5">
          <button
            type="button"
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

function formatRupiah(value: string | bigint): string {
  const num = Number(value);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

function parseMoney(value: string): bigint {
  return /^\d+$/.test(value) ? BigInt(value) : BigInt(0);
}

function channelBadge(channel: string): string {
  return channel
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);
}

function humanize(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function paymentMethodLabel(method: string, t: ReturnType<typeof useTranslations>): string {
  switch (method) {
    case 'cash':
    case 'qris':
    case 'flazz':
    case 'debit':
    case 'credit':
      return t(`paymentMethods.${method}` as never);
    default:
      return humanize(method);
  }
}
