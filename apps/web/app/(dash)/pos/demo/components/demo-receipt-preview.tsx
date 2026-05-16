/**
 * Demo Receipt Preview — shows a demo order receipt with DEMO stamp.
 *
 * ADR-0008: every order detail shows a diagonal "DEMO" stamp.
 * Default: preview on screen (modal). Print: optional with watermark.
 */

'use client';

import type { DemoOrder } from '@erp/offline';
import { useTranslations } from 'next-intl';
import { useDemoMode } from '../demo-mode-context';

interface DemoReceiptPreviewProps {
  order: DemoOrder;
  onClose: () => void;
}

export function DemoReceiptPreview({ order, onClose }: DemoReceiptPreviewProps) {
  const t = useTranslations('pos');
  const totalPaid = order.payments.reduce((sum, payment) => sum + BigInt(payment.amount), BigInt(0));
  const donationTotal = order.payments.reduce(
    (sum, payment) => sum + BigInt(payment.donationAmount ?? '0'),
    BigInt(0),
  );
  const changeDue =
    totalPaid > BigInt(order.grandTotal) + donationTotal
      ? totalPaid - BigInt(order.grandTotal) - donationTotal
      : BigInt(0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Receipt */}
      <div className="relative z-10 flex h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl sm:h-auto sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-cream-3 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('demo.receiptPreview')}</h2>
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

        {/* Receipt body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="relative">
            {/* Demo stamp overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
              <div className="rotate-[-25deg] border-[3px] border-brand-red/20 px-8 py-3">
                <span className="text-4xl font-black tracking-widest text-brand-red/15 uppercase">
                  DEMO
                </span>
              </div>
            </div>

            <div className="relative">
              {/* Header */}
              <div className="mb-4 text-center">
                <p className="text-lg font-bold text-brand-ink">Aroadri Tea</p>
                <p className="text-xs text-brand-ink-3">PT Gandha Hill Catering</p>
                <p className="mt-1 text-xs font-bold text-brand-red uppercase">
                  {t('demo.notRealTransaction')}
                </p>
              </div>

              <div className="mb-3 border-t border-b border-dashed border-brand-cream-3 py-2">
                <div className="flex justify-between text-xs text-brand-ink-3">
                  <span>{t('orderNumber')}</span>
                  <span className="font-mono font-bold text-brand-ink">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between text-xs text-brand-ink-3">
                  <span>{t('channel')}</span>
                  <span>{t(`${order.channel}` as never)}</span>
                </div>
                <div className="flex justify-between text-xs text-brand-ink-3">
                  <span>{t('orderPlaced')}</span>
                  <span>{new Date(order.placedAt).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Lines */}
              <div className="mb-3 space-y-1">
                {order.lines.map((line) => (
                  <div key={line.id} className="flex justify-between text-xs">
                    <div className="flex-1">
                      <span className="text-brand-ink">
                        {line.qty}× {line.productName}
                      </span>
                      {line.variantName && (
                        <span className="ml-1 text-brand-ink-3">({line.variantName})</span>
                      )}
                    </div>
                    <span className="ml-2 font-medium text-brand-ink">
                      {formatRupiah((BigInt(line.unitPrice) * BigInt(line.qty)).toString())}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-brand-cream-3 pt-2">
                <div className="flex justify-between text-xs text-brand-ink-3">
                  <span>{t('subtotal')}</span>
                  <span>{formatRupiah(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-brand-ink-3">
                  <span>PB1 (Incl.)</span>
                  <span>{formatRupiah(order.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-brand-ink">
                  <span>{t('grandTotal')}</span>
                  <span className="text-brand-red">{formatRupiah(order.grandTotal)}</span>
                </div>
                {order.payments.length > 0 && (
                  <>
                    <div className="mt-1 flex justify-between text-xs text-brand-ink-3">
                      <span>{t('totalPaid')}</span>
                      <span>{formatRupiah(totalPaid.toString())}</span>
                    </div>
                    {donationTotal > BigInt(0) && (
                      <div className="flex justify-between text-xs text-brand-ink-3">
                        <span>{t('donationChoice')}</span>
                        <span>{formatRupiah(donationTotal.toString())}</span>
                      </div>
                    )}
                    {changeDue > BigInt(0) && (
                      <div className="flex justify-between text-xs text-brand-ink-3">
                        <span>{t('change')}</span>
                        <span>{formatRupiah(changeDue.toString())}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 text-center">
                <p className="text-xs text-brand-ink-3">{t('demo.thankYou')}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase text-brand-red">
                  {t('demo.notForSale')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-brand-cream-3 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-lg border border-brand-cream-3 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-2"
          >
            {t('cancel')}
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
