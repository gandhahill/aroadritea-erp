/**
 * Cup Label Print Page — SD §21.4
 *
 * Renders one label per cup (per qty) for the cup-label thermal printer,
 * which is a different physical device from the receipt printer.
 * Auto-prints on mount.
 */

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { partners } from '@erp/db/schema/accounting';
import { salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { notFound, redirect } from 'next/navigation';
import { LabelAutoPrint } from './label-auto-print';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ orderId: string }>;
}

/** Pull "a/n: <name>" prefix out of notes for label display. */
function extractGuestName(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/^a\/n:\s*([^|]+)/i);
  return m ? (m[1] ?? '').trim() : null;
}

export default async function LabelPrintPage({ params }: Props) {
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
      notes: salesOrderLines.notes,
      productName: products.name,
    })
    .from(salesOrderLines)
    .leftJoin(products, eq(salesOrderLines.productId, products.id))
    .where(eq(salesOrderLines.salesOrderId, order.id));

  const customer = order.customerId
    ? await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, order.customerId))
        .then((rows) => rows[0])
    : null;

  const guest = customer?.name ?? extractGuestName(order.notes);

  // Expand: one printable label per cup (qty)
  const labels: Array<{ key: string; index: number; total: number; name: string; lineNotes: string | null }> = [];
  let runningIndex = 0;
  const totalCups = lines.reduce((sum, l) => sum + Number(l.qty), 0);
  for (const line of lines) {
    const nameField = line.productName as Record<string, string> | null;
    const name = nameField?.id ?? nameField?.en ?? line.productId;
    const count = Number(line.qty);
    for (let i = 0; i < count; i++) {
      runningIndex += 1;
      labels.push({
        key: `${line.id}-${i}`,
        index: runningIndex,
        total: totalCups,
        name,
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
@page { size: 40mm 30mm; margin: 1mm; }
@media print {
  body { margin: 0; }
  .no-print { display: none !important; }
  .label { page-break-after: always; }
  .label:last-child { page-break-after: auto; }
}
body { font-family: 'Arial', sans-serif; }
.label {
  width: 40mm;
  height: 30mm;
  padding: 1mm;
  font-size: 10px;
  color: #000;
  box-sizing: border-box;
  border: 1px dashed #ccc;
  margin-bottom: 2mm;
}
.label .order { font-size: 9px; color: #555; }
.label .name { font-weight: bold; font-size: 11px; line-height: 1.1; word-break: break-word; }
.label .guest { font-size: 9px; margin-top: 1mm; }
.label .extra { font-size: 8px; color: #444; }
`,
        }}
      />
      <div>
        {labels.map((label) => (
          <div className="label" key={label.key}>
            <div className="order">
              {order.number} · {label.index}/{label.total}
            </div>
            <div className="name">{label.name}</div>
            {guest ? <div className="guest">a/n {guest}</div> : null}
            {label.lineNotes ? <div className="extra">{label.lineNotes}</div> : null}
          </div>
        ))}
      </div>
      <LabelAutoPrint />
    </>
  );
}
