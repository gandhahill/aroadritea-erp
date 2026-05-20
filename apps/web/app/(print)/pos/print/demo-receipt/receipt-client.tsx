/**
 * Demo Receipt Client — renders an in-memory demo order on the same
 * 80mm thermal layout as the real receipt, then auto-prints.
 */

'use client';

import type { DemoOrder } from '@erp/offline';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aroadri:demo:lastReceipt';

function rupiah(value: bigint | string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Rp 0';
  const num = typeof value === 'bigint' ? Number(value) : Number(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

function channelLabel(channel: string): string {
  switch (channel) {
    case 'walk_in':
    case 'dine_in':
      return 'Dine In';
    case 'take_away':
    case 'takeaway':
      return 'Take Away';
    case 'gofood':
      return 'GoFood';
    case 'grabfood':
      return 'GrabFood';
    case 'shopeefood':
      return 'ShopeeFood';
    default:
      return channel
        .split(/[_-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
  }
}

export function DemoReceiptClient() {
  const [order, setOrder] = useState<DemoOrder | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw) as DemoOrder);
    } catch {
      // ignore malformed payload
    }
  }, []);

  useEffect(() => {
    if (!order) return;
    const id = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(id);
  }, [order]);

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-brand-ink-3">
        Tidak ada struk demo untuk dicetak. Lakukan pembayaran di mode demo
        terlebih dahulu.
      </div>
    );
  }

  const totalPaid = order.payments.reduce((sum, p) => sum + BigInt(p.amount), 0n);
  const grand = BigInt(order.grandTotal);
  const change = totalPaid > grand ? totalPaid - grand : 0n;

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print-only css
        dangerouslySetInnerHTML={{
          __html: `
@page { size: 80mm auto; margin: 3mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  .no-print { display: none !important; }
}
html, body { background: #fff; margin: 0; padding: 0; }
body { font-family: 'Courier New', 'Consolas', monospace; }
.receipt {
  width: 74mm;
  font-size: 11px;
  color: #000;
  line-height: 1.35;
  margin: 0 auto;
  position: relative;
}
.receipt::before {
  content: 'DEMO';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  color: rgba(214, 38, 46, 0.08);
  font-weight: 900;
  letter-spacing: 6px;
  transform: rotate(-30deg);
  pointer-events: none;
  z-index: 0;
}
.receipt > * { position: relative; z-index: 1; }
.r-center { text-align: center; }
.r-row { display: flex; justify-content: space-between; gap: 4px; }
.r-sep { border-top: 1px dashed #000; margin: 4px 0; }
.r-double { border-top: 1px solid #000; margin: 4px 0; }
.r-bold { font-weight: 700; }
.r-brand { font-family: 'Montserrat', 'Arial Black', sans-serif; font-size: 16px; font-weight: 900; letter-spacing: 1px; }
.r-tiny { font-size: 9px; }
.r-logo { width: 18mm; height: auto; margin: 0 auto 1mm; display: block; }
.r-pickup { border: 1.5px solid #000; padding: 4px 8px; margin-top: 6px; font-size: 14px; font-weight: 900; display: inline-block; min-width: 30mm; }
.r-social { display: flex; justify-content: center; gap: 8px; margin-top: 3px; font-size: 10px; }
.r-social .ig::before { content: 'IG'; margin-right: 3px; font-weight: 700; }
.r-social .tt::before { content: 'TT'; margin-right: 3px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
td { vertical-align: top; padding: 1px 0; }
.r-right { text-align: right; }
`,
        }}
      />
      <div className="receipt">
        <img className="r-logo" src="/logo-primary.png" alt="" />
        <div className="r-center r-brand">AROADRI TEA</div>
        <div className="r-center r-tiny">[DEMO MODE — Tidak Ditagih]</div>

        <div className="r-sep" />

        <div className="r-row">
          <span>No.</span>
          <span className="r-bold">{order.orderNumber}</span>
        </div>
        <div className="r-row">
          <span>Tgl</span>
          <span>{new Date(order.placedAt).toLocaleString('id-ID')}</span>
        </div>
        <div className="r-row">
          <span>Channel</span>
          <span className="r-bold">{channelLabel(order.channel)}</span>
        </div>
        <div className="r-row">
          <span>Kasir</span>
          <span>DEMO</span>
        </div>
        {order.customer ? (
          <div className="r-row">
            <span>Member</span>
            <span>{order.customer.name}</span>
          </div>
        ) : null}
        {order.guestName ? (
          <div className="r-row">
            <span>Pelanggan</span>
            <span>{order.guestName}</span>
          </div>
        ) : null}
        {order.notes ? (
          <div className="r-row">
            <span>Cat</span>
            <span>{order.notes}</span>
          </div>
        ) : null}

        <div className="r-sep" />

        <table>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <span>{line.productName ?? line.productId}</span>
                  <br />
                  {line.qty} × {rupiah(line.unitPrice)}
                </td>
                <td className="r-right">
                  {rupiah(BigInt(line.unitPrice) * BigInt(line.qty))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="r-sep" />

        <div className="r-row">
          <span>Subtotal</span>
          <span>{rupiah(order.subtotal)}</span>
        </div>
        {BigInt(order.taxTotal) > 0n ? (
          <div className="r-row">
            <span>PB1 (incl.)</span>
            <span>{rupiah(order.taxTotal)}</span>
          </div>
        ) : null}
        <div className="r-double" />
        <div className="r-row r-bold" style={{ fontSize: '12px' }}>
          <span>TOTAL</span>
          <span>{rupiah(order.grandTotal)}</span>
        </div>

        <div className="r-sep" />

        {order.payments.map((p) => (
          <div className="r-row" key={p.id}>
            <span>{p.method.toUpperCase()}</span>
            <span>{rupiah(p.amount)}</span>
          </div>
        ))}
        {change > 0n ? (
          <div className="r-row r-bold">
            <span>Kembali</span>
            <span>{rupiah(change)}</span>
          </div>
        ) : null}

        <div className="r-sep" />

        <div className="r-center r-tiny">Terima kasih atas kunjungan Anda</div>
        <div className="r-social">
          <span className="ig">@aroadri.tea</span>
          <span className="tt">@aroadri.tea</span>
        </div>
        <div className="r-center r-tiny">aroadritea.com</div>
        <div className="r-center r-tiny" style={{ marginTop: '3px' }}>
          Struk DEMO - tidak masuk pembukuan
        </div>

        <div className="r-center" style={{ marginTop: '6px' }}>
          <div className="r-tiny">No. Antrian</div>
          <div className="r-pickup">
            {order.orderNumber.split('-').pop() ?? order.orderNumber}
          </div>
        </div>
      </div>
    </>
  );
}
