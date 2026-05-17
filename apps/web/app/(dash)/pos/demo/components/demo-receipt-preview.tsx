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
        <div className="grid grid-cols-2 gap-2 border-t border-brand-cream-3 p-5">
          <button
            type="button"
            onClick={() => printDemoReceipt(order, t('demo.notRealTransaction'))}
            className="h-11 rounded-lg border border-brand-cream-3 bg-brand-cream-2 text-sm font-medium text-brand-ink-2 hover:bg-brand-cream-3"
          >
            <svg
              aria-hidden="true"
              className="mr-1.5 inline h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
              />
            </svg>
            {t('printReceipt')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg bg-brand-red text-sm font-semibold text-white hover:bg-brand-red-dark"
          >
            {t('newOrder')}
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function printDemoReceipt(order: DemoOrder, notRealLabel: string): void {
  const totalPaid = order.payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const donation = order.payments.reduce(
    (sum, p) => sum + BigInt(p.donationAmount ?? '0'),
    BigInt(0),
  );
  const change =
    totalPaid > BigInt(order.grandTotal) + donation
      ? totalPaid - BigInt(order.grandTotal) - donation
      : BigInt(0);

  const lineRows = order.lines
    .map((l) => {
      const name = escapeHtml(`${l.productName}${l.variantName ? ` (${l.variantName})` : ''}`);
      const lineTotal = (BigInt(l.unitPrice) * BigInt(l.qty)).toString();
      return `<tr><td>${name}<br/>${l.qty} × ${escapeHtml(formatRupiah(l.unitPrice))}</td><td class="right">${escapeHtml(formatRupiah(lineTotal))}</td></tr>`;
    })
    .join('');

  const paymentRows = order.payments
    .map(
      (p) =>
        `<div class="row"><span>${escapeHtml(p.method.toUpperCase())}</span><span>${escapeHtml(formatRupiah(p.amount))}</span></div>`,
    )
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(order.orderNumber)}</title>
<style>
@page { size: 80mm auto; margin: 4mm; }
@media print { body { margin: 0; } .no-print { display: none !important; } }
body { font-family: 'Courier New', monospace; }
.wrap { position: relative; width: 80mm; font-size: 11px; color: #000; }
.stamp { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.stamp span { transform: rotate(-25deg); font-size: 36px; font-weight: 900; letter-spacing: .25em; color: rgba(195,28,40,.18); border: 3px solid rgba(195,28,40,.25); padding: 6px 22px; }
h1 { font-size: 14px; margin: 0; text-align: center; }
.row { display: flex; justify-content: space-between; gap: 4px; }
.sep { border-top: 1px dashed #000; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; }
td { vertical-align: top; padding: 1px 0; }
.right { text-align: right; }
.demo-line { text-align: center; font-weight: bold; color: #c31c28; font-size: 10px; }
</style></head><body>
<div class="wrap">
  <div class="stamp"><span>DEMO</span></div>
  <h1>AROADRI TEA</h1>
  <div class="demo-line">${escapeHtml(notRealLabel)}</div>
  <div class="row"><span>Order</span><span>${escapeHtml(order.orderNumber)}</span></div>
  <div class="row"><span>Channel</span><span>${escapeHtml(order.channel)}</span></div>
  <div class="row"><span>Tgl</span><span>${escapeHtml(new Date(order.placedAt).toLocaleString('id-ID'))}</span></div>
  ${order.notes ? `<div>Cat: ${escapeHtml(order.notes)}</div>` : ''}
  <div class="sep"></div>
  <table><tbody>${lineRows}</tbody></table>
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${escapeHtml(formatRupiah(order.subtotal))}</span></div>
  <div class="row"><span>PB1 (incl.)</span><span>${escapeHtml(formatRupiah(order.taxTotal))}</span></div>
  <div class="row" style="font-weight:bold"><span>TOTAL</span><span>${escapeHtml(formatRupiah(order.grandTotal))}</span></div>
  <div class="sep"></div>
  ${paymentRows}
  ${donation > BigInt(0) ? `<div class="row"><span>Donasi</span><span>${escapeHtml(formatRupiah(donation.toString()))}</span></div>` : ''}
  ${change > BigInt(0) ? `<div class="row"><span>Kembali</span><span>${escapeHtml(formatRupiah(change.toString()))}</span></div>` : ''}
  <div class="sep"></div>
  <p style="text-align:center;font-size:10px">Terima kasih atas kunjungan Anda<br/>aroadritea.com</p>
  <div class="demo-line">*** DEMO ORDER — NOT FOR SALE ***</div>
</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
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
