'use client';

import type { DemoOrder } from '@erp/offline';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aroadri:demo:lastReceipt';

interface LabelEntry {
  key: string;
  index: number;
  total: number;
  name: string;
  modifier: string | null;
  lineNotes: string | null;
}

function buildLabels(order: DemoOrder): LabelEntry[] {
  const labels: LabelEntry[] = [];
  let running = 0;
  const total = order.lines.reduce((sum, l) => sum + Math.ceil(Number(l.qty)), 0);
  for (const line of order.lines) {
    const count = Math.ceil(Number(line.qty));
    const mods = line.modifierJson as
      | { sugar?: string; ice?: string; toppings?: Array<{ name?: string }> }
      | undefined;
    const parts: string[] = [];
    if (mods?.sugar) parts.push(`Gula ${mods.sugar}`);
    if (mods?.ice) parts.push(`Es ${mods.ice}`);
    if (mods?.toppings && mods.toppings.length > 0) {
      parts.push(
        mods.toppings
          .map((t) => t.name)
          .filter((n): n is string => Boolean(n))
          .join(', '),
      );
    }
    const modifier = parts.length > 0 ? parts.join(' · ') : null;
    for (let i = 0; i < count; i++) {
      running += 1;
      labels.push({
        key: `${line.id}-${i}`,
        index: running,
        total,
        name: line.productName ?? line.productId,
        modifier,
        lineNotes: line.notes ?? null,
      });
    }
  }
  return labels;
}

export function DemoLabelClient() {
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw) as DemoOrder);
    } catch {
      /* ignore */
    }
  }, []);

  // Render the QR client-side once the order loads. We wait for the QR
  // before triggering the print dialog so the label includes the SVG.
  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    void QRCode.toString(`DEMO-${order.orderNumber}`, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      width: 64,
      color: { dark: '#000', light: '#0000' },
    }).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [order]);

  useEffect(() => {
    if (!order || !qrSvg) return;
    const id = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(id);
  }, [order, qrSvg]);

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-brand-ink-3">
        Tidak ada label demo untuk dicetak.
      </div>
    );
  }

  const labelWidthMm = 40;
  const labelHeightMm = 30;
  const labels = buildLabels(order);
  const guest = order.customer?.name ?? order.guestName ?? null;
  const pickupNumber = order.orderNumber.split('-').pop() ?? order.orderNumber;

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print-only css
        dangerouslySetInnerHTML={{
          __html: `
@page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 1mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  .label { page-break-after: always; }
  .label:last-child { page-break-after: auto; }
}
html, body { background: #fff; margin: 0; padding: 0; }
body { font-family: 'Arial', sans-serif; }
.label {
  width: ${labelWidthMm - 2}mm;
  height: ${labelHeightMm - 2}mm;
  padding: 1mm;
  font-size: 9px;
  color: #000;
  box-sizing: border-box;
  border: 1px dashed #ccc;
  overflow: hidden;
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-gap: 1mm;
  align-items: start;
}
.label::after {
  content: 'DEMO';
  position: absolute;
  right: 1mm;
  bottom: 0.5mm;
  font-size: 7px;
  font-weight: 900;
  color: rgba(214, 38, 46, 0.45);
  letter-spacing: 1px;
}
.label .body { min-width: 0; }
.label .top { display: flex; justify-content: space-between; align-items: baseline; }
.label .order { font-size: 8px; color: #555; }
.label .pickup { font-size: 12px; font-weight: 900; }
.label .name { font-weight: 800; font-size: 11px; line-height: 1.1; word-break: break-word; margin-top: 1mm; }
.label .mod { font-size: 8px; color: #222; margin-top: 0.5mm; }
.label .guest { font-size: 9px; margin-top: 1mm; font-weight: 700; }
.label .extra { font-size: 7px; color: #444; margin-top: 0.5mm; }
.label .qr { width: 12mm; height: 12mm; }
.label .qr svg { width: 100%; height: 100%; display: block; }
`,
        }}
      />
      <div>
        {labels.length === 0 ? (
          <div className="label">
            <div className="body">
              <div className="top">
                <span className="order">{order.orderNumber}</span>
                <span className="pickup">#{pickupNumber}</span>
              </div>
              <div className="name">—</div>
            </div>
            <div
              className="qr"
              aria-label={`QR DEMO-${order.orderNumber}`}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: client-rendered SVG from `qrcode` lib
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        ) : null}
        {labels.map((label) => (
          <div className="label" key={label.key}>
            <div className="body">
              <div className="top">
                <span className="order">
                  {order.orderNumber} · {label.index}/{label.total}
                </span>
                <span className="pickup">#{pickupNumber}</span>
              </div>
              <div className="name">{label.name}</div>
              {label.modifier ? <div className="mod">{label.modifier}</div> : null}
              {guest ? <div className="guest">a/n {guest}</div> : null}
              {label.lineNotes ? <div className="extra">{label.lineNotes}</div> : null}
            </div>
            <div
              className="qr"
              aria-label={`QR DEMO-${order.orderNumber}`}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: client-rendered SVG from `qrcode` lib
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
