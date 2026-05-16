/**
 * Receipt Print Page — SD §21.4
 *
 * Renders an 80mm thermal-friendly receipt and triggers window.print() on mount.
 * Opened in a popup from the POS payment flow after a successful sale.
 */

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { partners } from '@erp/db/schema/accounting';
import { posSettings } from '@erp/db/schema/pos';
import { payments, salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { notFound, redirect } from 'next/navigation';
import { ReceiptAutoPrint } from './receipt-auto-print';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ orderId: string }>;
}

function rupiah(value: bigint | string | number): string {
  const num = typeof value === 'bigint' ? Number(value) : Number(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

export default async function ReceiptPrintPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');

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
    .select({ widthMm: posSettings.receiptWidthMm })
    .from(posSettings)
    .where(eq(posSettings.locationId, order.locationId))
    .then((rows) => rows[0]);
  const widthMm = setting?.widthMm ?? 80;

  const customer = order.customerId
    ? await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, order.customerId))
        .then((rows) => rows[0])
    : null;

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print-only css
        dangerouslySetInnerHTML={{
          __html: `
@page { size: ${widthMm}mm auto; margin: 4mm; }
@media print {
  body { margin: 0; }
  .no-print { display: none !important; }
}
body { font-family: 'Courier New', monospace; }
.receipt { width: ${widthMm}mm; font-size: 11px; color: #000; }
.receipt h1 { font-size: 14px; margin: 0; text-align: center; }
.receipt .row { display: flex; justify-content: space-between; gap: 4px; }
.receipt .sep { border-top: 1px dashed #000; margin: 4px 0; }
.receipt table { width: 100%; border-collapse: collapse; }
.receipt td { vertical-align: top; padding: 1px 0; }
.receipt .right { text-align: right; }
`,
        }}
      />
      <div className="receipt">
        <h1>AROADRI TEA</h1>
        <div className="row">
          <span>Order</span>
          <span>{order.number}</span>
        </div>
        <div className="row">
          <span>Tgl</span>
          <span>{order.placedAt.toLocaleString('id-ID')}</span>
        </div>
        {customer?.name ? (
          <div className="row">
            <span>Pelanggan</span>
            <span>{customer.name}</span>
          </div>
        ) : null}
        {order.notes ? <div>Cat: {order.notes}</div> : null}
        <div className="sep" />
        <table>
          <tbody>
            {lines.map((line) => {
              const nameField = line.productName as Record<string, string> | null;
              const name = nameField?.id ?? nameField?.en ?? line.productId;
              return (
                <tr key={line.id}>
                  <td>
                    {name}
                    <br />
                    {line.qty} × {rupiah(line.unitPrice)}
                  </td>
                  <td className="right">{rupiah(line.lineSubtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="sep" />
        <div className="row">
          <span>Subtotal</span>
          <span>{rupiah(order.subtotal)}</span>
        </div>
        {order.discountTotal > 0n ? (
          <div className="row">
            <span>Diskon</span>
            <span>-{rupiah(order.discountTotal)}</span>
          </div>
        ) : null}
        {order.taxTotal > 0n ? (
          <div className="row">
            <span>PB1 (incl.)</span>
            <span>{rupiah(order.taxTotal)}</span>
          </div>
        ) : null}
        <div className="row" style={{ fontWeight: 'bold' }}>
          <span>TOTAL</span>
          <span>{rupiah(order.grandTotal)}</span>
        </div>
        <div className="sep" />
        {paymentRows.map((p) => (
          <div className="row" key={p.id}>
            <span>{p.method.toUpperCase()}</span>
            <span>{rupiah(p.amount)}</span>
          </div>
        ))}
        <div className="sep" />
        <p style={{ textAlign: 'center', fontSize: '10px' }}>
          Terima kasih atas kunjungan Anda
          <br />
          aroadritea.com
        </p>
      </div>
      <ReceiptAutoPrint />
    </>
  );
}
