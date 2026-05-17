/**
 * Cup Label Print Page — SD §21.4
 *
 * Renders one label per cup (per qty) for the cup-label thermal printer,
 * which is a different physical device from the receipt printer. Paper
 * dimensions are configurable per location via pos_settings
 * (receipt_label_width_mm / receipt_label_height_mm). Auto-prints on mount.
 */

import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import { and, db, eq } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { products } from '@erp/db/schema/inventory';
import { posSettings, salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { getLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { LabelAutoPrint } from './auto-print';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ orderId: string }>;
}

function extractGuestName(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/a\/n:\s*([^|]+)/i);
  return m ? (m[1] ?? '').trim() : null;
}

export default async function LabelPrintPage({ params }: Props) {
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
      notes: salesOrderLines.notes,
      modifierJson: salesOrderLines.modifierJson,
      productName: products.name,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(salesOrderLines.productId, products.id))
    .where(eq(salesOrderLines.salesOrderId, order.id));

  const setting = await db
    .select({
      labelWidthMm: posSettings.receiptLabelWidthMm,
      labelHeightMm: posSettings.receiptLabelHeightMm,
    })
    .from(posSettings)
    .where(eq(posSettings.locationId, order.locationId))
    .then((rows) => rows[0]);
  const labelWidthMm = setting?.labelWidthMm ?? 40;
  const labelHeightMm = setting?.labelHeightMm ?? 30;

  const customer = order.customerId
    ? await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, order.customerId))
        .then((rows) => rows[0])
    : null;
  const guest = customer?.name ?? extractGuestName(order.notes);
  const pickupNumber = order.number.split('-').pop() ?? order.number;

  // Expand: one printable label per cup (qty)
  const labels: Array<{
    key: string;
    index: number;
    total: number;
    name: string;
    modifier: string | null;
    lineNotes: string | null;
  }> = [];
  let runningIndex = 0;
  const totalCups = lines.reduce((sum, l) => sum + Math.ceil(Number(l.qty)), 0);
  for (const line of lines) {
    const name = pickLocalized(line.productName, locale, line.productId);
    const count = Math.ceil(Number(line.qty));
    const mods = line.modifierJson;
    const modParts: string[] = [];
    if (mods?.sugar) modParts.push(`Gula ${mods.sugar}`);
    if (mods?.ice) modParts.push(`Es ${mods.ice}`);
    if (mods?.toppings && mods.toppings.length > 0) {
      modParts.push(mods.toppings.map((t) => t.name).join(', '));
    }
    const modifier = modParts.length > 0 ? modParts.join(' · ') : null;
    for (let i = 0; i < count; i++) {
      runningIndex += 1;
      labels.push({
        key: `${line.id}-${i}`,
        index: runningIndex,
        total: totalCups,
        name,
        modifier,
        lineNotes: line.notes ?? null,
      });
    }
  }

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: print-only css
        dangerouslySetInnerHTML={{
          __html: `
@page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 1mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  .no-print { display: none !important; }
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
}
.label .top { display: flex; justify-content: space-between; align-items: baseline; }
.label .order { font-size: 8px; color: #555; }
.label .pickup { font-size: 12px; font-weight: 900; }
.label .name { font-weight: 800; font-size: 11px; line-height: 1.1; word-break: break-word; margin-top: 1mm; }
.label .mod { font-size: 8px; color: #222; margin-top: 0.5mm; }
.label .guest { font-size: 9px; margin-top: 1mm; font-weight: 700; }
.label .extra { font-size: 7px; color: #444; margin-top: 0.5mm; }
`,
        }}
      />
      <div>
        {labels.length === 0 ? (
          <div className="label">
            <div className="top">
              <span className="order">{order.number}</span>
              <span className="pickup">#{pickupNumber}</span>
            </div>
            <div className="name">—</div>
          </div>
        ) : null}
        {labels.map((label) => (
          <div className="label" key={label.key}>
            <div className="top">
              <span className="order">
                {order.number} · {label.index}/{label.total}
              </span>
              <span className="pickup">#{pickupNumber}</span>
            </div>
            <div className="name">{label.name}</div>
            {label.modifier ? <div className="mod">{label.modifier}</div> : null}
            {guest ? <div className="guest">a/n {guest}</div> : null}
            {label.lineNotes ? <div className="extra">{label.lineNotes}</div> : null}
          </div>
        ))}
      </div>
      <LabelAutoPrint />
    </>
  );
}
