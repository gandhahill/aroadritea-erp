/**
 * Receipt Print Page — SD §21.4
 *
 * Renders an 80mm thermal-friendly receipt and triggers window.print() on
 * mount. Lives outside the (dash) route group so the sidebar/topbar/shift
 * bar never bleed into the print output. Layout follows the brand spec:
 *
 *   logo → brand → address → phone → channel → cashier → items →
 *   subtotal → PB1 → total → payment + amount → change → socials →
 *   website → custom footer → pickup number
 */

import { getSession } from '@/lib/auth';
import { formatQty } from '@/lib/format-qty';
import { pickLocalized } from '@/lib/pick-localized';
import { and, db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { users as usersTable } from '@erp/db/schema/auth';
import { partners } from '@erp/db/schema/accounting';
import { products } from '@erp/db/schema/inventory';
import { posSettings } from '@erp/db/schema/pos';
import { payments, salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { getLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { ReceiptAutoPrint } from './auto-print';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ orderId: string }>;
}

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

/** Try to pull "a/n: <name>" out of the order notes for pickup display. */
function extractGuestName(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/a\/n:\s*([^|]+)/i);
  return m ? (m[1] ?? '').trim() : null;
}

function stripGuestNamePrefix(notes: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(/a\/n:\s*[^|]+\|?\s*/i, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export default async function ReceiptPrintPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const locale = await getLocale();

  const { orderId } = await params;

  const order = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.id, orderId)))
    .then((rows) => rows[0]);
  if (!order) notFound();

  const lines = await db
    .select({
      id: salesOrderLines.id,
      productId: salesOrderLines.productId,
      qty: salesOrderLines.qty,
      unitPrice: salesOrderLines.unitPrice,
      lineSubtotal: salesOrderLines.lineSubtotal,
      productName: products.name,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(salesOrderLines.productId, products.id))
    .where(eq(salesOrderLines.salesOrderId, order.id));

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.salesOrderId, order.id));

  const setting = await db
    .select()
    .from(posSettings)
    .where(eq(posSettings.locationId, order.locationId))
    .then((rows) => rows[0]);
  const widthMm = setting?.receiptWidthMm ?? 80;

  const location = await db
    .select({ name: locations.name, address: locations.address })
    .from(locations)
    .where(eq(locations.id, order.locationId))
    .then((rows) => rows[0]);

  const cashier = await db
    .select({ displayName: usersTable.displayName })
    .from(usersTable)
    .where(eq(usersTable.id, order.cashierId))
    .then((rows) => rows[0]);

  const customer = order.customerId
    ? await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, order.customerId))
        .then((rows) => rows[0])
    : null;

  const guestName = customer?.name ?? extractGuestName(order.notes);
  const noteText = stripGuestNamePrefix(order.notes);
  const outletName = pickLocalized(location?.name, locale, 'Aroadri Tea');
  const outletAddress = setting?.receiptOutletAddress ?? location?.address ?? '';
  const outletPhone = setting?.receiptOutletPhone ?? '';
  const website = setting?.receiptWebsite ?? 'aroadritea.com';
  const instagram = setting?.receiptInstagram ?? '@aroadri.tea';
  const tiktok = setting?.receiptTiktok ?? '@aroadri.tea';
  const customFooter = setting?.receiptFooterText ?? '';
  const showLogo = setting?.receiptShowLogo ?? true;

  const totalPaid = paymentRows.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const change =
    totalPaid > BigInt(order.grandTotal) ? totalPaid - BigInt(order.grandTotal) : BigInt(0);

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print-only css
        dangerouslySetInnerHTML={{
          __html: `
@page { size: ${widthMm}mm auto; margin: 3mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  .no-print { display: none !important; }
}
html, body { background: #fff; margin: 0; padding: 0; }
body { font-family: 'Courier New', 'Consolas', monospace; }
.receipt {
  width: ${widthMm - 6}mm;
  font-size: 11px;
  color: #000;
  line-height: 1.35;
  margin: 0 auto;
}
.r-center { text-align: center; }
.r-row { display: flex; justify-content: space-between; gap: 4px; }
.r-sep { border-top: 1px dashed #000; margin: 4px 0; }
.r-double { border-top: 1px solid #000; margin: 4px 0; }
.r-bold { font-weight: 700; }
.r-brand { font-family: 'Montserrat', 'Arial Black', sans-serif; font-size: 16px; font-weight: 900; letter-spacing: 1px; }
.r-tiny { font-size: 9px; }
.r-logo { width: 18mm; height: auto; margin: 0 auto 1mm; display: block; }
.r-item-name { word-wrap: break-word; overflow-wrap: anywhere; max-width: 100%; }
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
        {showLogo ? (
          // Plain <img> — Next.js Image needs sizing & domain config that
          // doesn't apply on a print-only document.
          // biome-ignore lint/a11y/useAltText: print-only
          // biome-ignore lint/performance/noImgElement: print-only document
          <img className="r-logo" src="/logo-primary.png" alt="" />
        ) : null}

        <div className="r-center r-brand">AROADRI TEA</div>
        {outletName ? <div className="r-center r-tiny">{outletName}</div> : null}
        {outletAddress ? <div className="r-center r-tiny">{outletAddress}</div> : null}
        {outletPhone ? <div className="r-center r-tiny">Telp. {outletPhone}</div> : null}

        <div className="r-sep" />

        <div className="r-row">
          <span>No.</span>
          <span className="r-bold">{order.number}</span>
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
          <span>{cashier?.displayName ?? '—'}</span>
        </div>
        {guestName ? (
          <div className="r-row">
            <span>Pelanggan</span>
            <span>{guestName}</span>
          </div>
        ) : null}
        {noteText ? (
          <div className="r-row">
            <span>Cat</span>
            <span>{noteText}</span>
          </div>
        ) : null}

        <div className="r-sep" />

        <table>
          <tbody>
            {lines.map((line) => {
              const name = pickLocalized(line.productName, locale, line.productId);
              return (
                <tr key={line.id}>
                  <td>
                    <span className="r-item-name">{name}</span>
                    <br />
                    {formatQty(line.qty)} × {rupiah(line.unitPrice)}
                  </td>
                  <td className="r-right">{rupiah(line.lineSubtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="r-sep" />

        <div className="r-row">
          <span>Subtotal</span>
          <span>{rupiah(order.subtotal)}</span>
        </div>
        {order.discountTotal > 0n ? (
          <div className="r-row">
            <span>Diskon</span>
            <span>-{rupiah(order.discountTotal)}</span>
          </div>
        ) : null}
        {order.taxTotal > 0n ? (
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

        {paymentRows.map((p) => (
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
          <span className="ig">{instagram}</span>
          <span className="tt">{tiktok}</span>
        </div>
        <div className="r-center r-tiny">{website}</div>
        {customFooter ? (
          <div className="r-center r-tiny" style={{ marginTop: '3px' }}>
            {customFooter}
          </div>
        ) : null}

        <div className="r-center" style={{ marginTop: '6px' }}>
          <div className="r-tiny">No. Antrian</div>
          <div className="r-pickup">{order.number.split('-').pop() ?? order.number}</div>
        </div>
      </div>
      <ReceiptAutoPrint
        kioskPrinting={setting?.kioskPrintingEnabled ?? false}
        printerName={setting?.receiptPrinterName ?? null}
      />
    </>
  );
}
