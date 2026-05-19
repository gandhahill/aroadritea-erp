/**
 * Payment Modal — SD §21.4
 *
 * Full payment flow with split payment support, change calculation.
 * On confirmation, calls createSaleAction server action.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { createSaleAction } from './actions';
import { type RoundingOption, getDonationOptions } from './lib/donation-options';
import { useOfflineSync } from './lib/offline-sync-context';
import { usePosCart } from './pos-cart-context';

const BASE_PAYMENT_METHODS = [
  { id: 'cash', badge: 'Rp' },
  { id: 'qris', badge: 'QR' },
  { id: 'flazz', badge: 'FLZ' },
  { id: 'debit', badge: 'DBT' },
  { id: 'credit', badge: 'CRD' },
] as const;

interface PaymentModalProps {
  grandTotal: string;
  onClose: () => void;
}

interface SplitPayment {
  id: string;
  method: string;
  amount: string;
}

export function PaymentModal({ grandTotal, onClose }: PaymentModalProps) {
  const t = useTranslations('pos');
  const { state, totalPaid, clearCart } = usePosCart();
  const { isOnline, enqueueOrder, syncNow } = useOfflineSync();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalBig = BigInt(grandTotal);
  const paidBig = totalPaid;
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [inputAmount, setInputAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);

  const [donationChoice, setDonationChoice] = useState<RoundingOption>('no_donation');
  /** Custom donation amount entered by the cashier when `donationChoice === 'custom'`. */
  const [customDonationInput, setCustomDonationInput] = useState('');
  const paymentMethods = useMemo(() => {
    if (state.channel === 'walk_in') return [...BASE_PAYMENT_METHODS];
    return [...BASE_PAYMENT_METHODS, { id: state.channel, badge: channelBadge(state.channel) }];
  }, [state.channel]);

  // Cash tendered so far in this modal (numeric input + split list)
  const currentInputBig = parseMoney(inputAmount);
  const splitTotal = splitPayments.reduce((s, p) => s + parseMoney(p.amount), BigInt(0));
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
  // Block non-cash overpay only when the cashier hasn't elected donation —
  // otherwise the excess goes to the donation trust account.
  const overpayBlocked = nonCashOverpay && donationChoice === 'no_donation';
  const canConfirm = isFullyPaid && !overpayBlocked && Boolean(state.shiftId);
  const canAddSplit =
    inputAmount !== '' && currentInputBig > BigInt(0) && currentInputBig < remaining;

  // SD §25.11 — Donation options when cash change exists.
  // For non-cash methods (QRIS, debit, etc.) the customer occasionally
  // rounds up intentionally; we still surface the choice so the cashier
  // can ask before tapping confirm.
  const donationOptions = useMemo(() => {
    if (excess <= BigInt(0)) return [];
    return getDonationOptions(excess);
  }, [excess]);

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
    if (!canConfirm || !state.shiftId) return;

    // SD §25.11 — resolve donation. Works for any payment method when the
    // customer has overpaid; the excess is recorded against the donation
    // trust account instead of being given back as change.
    let donationResult =
      excess > BigInt(0) && donationChoice !== 'no_donation'
        ? getDonationOptions(excess).find((o) => o.choice.type === donationChoice)
        : undefined;
    // For the `custom` option, recompute with the cashier-entered amount —
    // the preset entry from getDonationOptions always carries 0n for custom.
    if (donationResult && donationChoice === 'custom') {
      const customAmount = parseMoney(customDonationInput);
      if (customAmount <= BigInt(0)) {
        // No custom amount typed — fall through as if no donation.
        donationResult = undefined;
      } else {
        const { calculateDonation } = await import('./lib/donation-options');
        donationResult = calculateDonation(excess, 'custom', customAmount);
      }
    }

    // Build payments array — existing payments from cart + split list
    const payments = [
      ...state.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      })),
      ...splitPayments.map((p) => ({ method: p.method, amount: p.amount })),
    ];

    // Add the final payment only if it covers the remaining balance.
    if (
      inputAmount &&
      currentInputBig > BigInt(0) &&
      currentInputBig + paidBig + splitTotal >= totalBig
    ) {
      payments.push({
        method: selectedMethod,
        amount: inputAmount,
        ...(selectedMethod === 'cash' && donationResult && donationResult.donatedAmount > BigInt(0)
          ? {
              donationAmount: donationResult.donatedAmount.toString(),
              roundingOption: donationChoice,
            }
          : {}),
      });
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

    const clientOrderUuid = crypto.randomUUID();
    const input = {
      shiftId: state.shiftId,
      channel: state.channel,
      locationId: state.locationId,
      idempotencyKey: clientOrderUuid,
      lines,
      payments,
      customerId: state.customer?.id,
      notes: state.notes,
    };

    startTransition(async () => {
      setError(null);

      await enqueueOrder({
        clientOrderUuid,
        createdAtClient: new Date().toISOString(),
        payload: input,
      });

      if (isOnline) {
        try {
          const result = await createSaleAction(input as Parameters<typeof createSaleAction>[0]);
          const { markOrderSynced, removePendingOrder } = await import('@erp/offline');
          if (result.ok) {
            await markOrderSynced(clientOrderUuid, result.value.number);
            triggerPrint(result.value.id);
            clearCart();
            onClose();
          } else {
            const permanentFailure = ['VALIDATION_FAILED', 'BUSINESS_RULE', 'FORBIDDEN'].includes(
              result.error.code,
            );
            if (permanentFailure) {
              await removePendingOrder(clientOrderUuid);
              setError(result.error.messageKey ?? t('paymentFailed'));
            } else {
              clearCart();
              onClose();
              void syncNow();
            }
          }
          return;
        } catch {
          clearCart();
          onClose();
          void syncNow();
          return;
        }
      }

      clearCart();
      onClose();
      void syncNow();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-2xl sm:h-auto sm:rounded-2xl">
        {/* Header */}
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
              {paymentMethods.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-all ${
                    selectedMethod === m.id
                      ? 'border-brand-red bg-brand-red/5 text-brand-red'
                      : 'border-brand-cream-3 text-brand-ink-2 hover:border-brand-red/30'
                  }`}
                >
                  <span className="rounded bg-brand-cream-3 px-1.5 py-0.5 text-[10px] font-bold">
                    {m.badge}
                  </span>
                  <span>{paymentMethodLabel(m.id, t)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment amount input */}
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
                    onChange={(e) => setInputAmount(e.target.value.replace(/\D/g, ''))}
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

          {/* Cash change indicator — shown when fully paid via cash */}
          {isFullyPaid && excess > BigInt(0) && selectedMethod === 'cash' && (
            <div className="flex items-center justify-between rounded-lg border border-brand-jade/20 bg-brand-jade/5 px-4 py-2.5">
              <span className="text-sm font-medium text-brand-ink-2">{t('change')}</span>
              <span className="text-base font-semibold text-brand-jade">
                {formatRupiah(excess.toString())}
              </span>
            </div>
          )}

          {/* SD §25.11 — Donation choice (any payment with overpay) */}
          {isFullyPaid && donationOptions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('donationChoice')}
              </p>
              <div className="space-y-1.5">
                {donationOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.choice.type}
                    onClick={() => setDonationChoice(opt.choice.type)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                      donationChoice === opt.choice.type
                        ? 'border-brand-red bg-brand-red/5'
                        : 'border-brand-cream-3 hover:border-brand-red/30'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${donationChoice === opt.choice.type ? 'text-brand-red' : 'text-brand-ink-2'}`}
                    >
                      {opt.choice.description}
                    </span>
                    {opt.donatedAmount > BigInt(0) && (
                      <span className="text-xs font-medium text-brand-ink-3">
                        {formatRupiah(opt.donatedAmount.toString())}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {donationChoice === 'custom' && (
                <div className="mt-2 rounded-lg border border-brand-red/40 bg-brand-red/5 px-3 py-2.5">
                  <label
                    htmlFor="customDonationInput"
                    className="text-xs font-medium uppercase tracking-widest text-brand-red"
                  >
                    {t('customDonationLabel')}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-brand-ink-3">Rp</span>
                    <input
                      id="customDonationInput"
                      type="text"
                      inputMode="numeric"
                      value={customDonationInput}
                      onChange={(e) => setCustomDonationInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="flex-1 rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-sm font-medium text-brand-ink focus:border-brand-red focus:outline-none"
                    />
                    <span className="text-xs text-brand-ink-3">
                      / {formatRupiah(excess.toString())}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-brand-ink-3">
                    {t('customDonationHint')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Split payment list */}
          {splitPayments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-brand-ink-3">
                {t('splitPayment')}
              </p>
              <ul className="space-y-2">
                {splitPayments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-brand-cream-3 bg-brand-cream-2 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-ink-3">
                        {paymentMethodLabel(p.method, t)}
                      </span>
                      <span className="text-sm font-medium text-brand-ink">
                        {formatRupiah(p.amount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSplit(p.id)}
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

          {!state.shiftId && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {t('shiftRequired')}
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
            type="button"
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

/**
 * Open the receipt + label printers in popup windows after a successful sale.
 * Cup labels and the customer receipt go to physically separate thermal
 * printers, so we open two windows and let each route window.print() itself.
 */
function triggerPrint(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.open(
      `/pos/print/receipt/${orderId}`,
      `print-receipt-${orderId}`,
      'width=420,height=720',
    );
    window.open(
      `/pos/print/label/${orderId}`,
      `print-label-${orderId}`,
      'width=300,height=400',
    );
  } catch {
    // Popup blocked or environment without window.open — silent failure
    // is acceptable; the cashier can re-print from order detail.
  }
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
