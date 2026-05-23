import { getSession } from '@/lib/auth';
import { db, purchaseOrders, purchaseOrderLines, partners, locations, products } from '@erp/db';
import { eq, and } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { GrnForm } from './grn-form';

export default async function PoDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user) return redirect('/login');
  
  const user = session.user as Record<string, unknown>;
  const tenantId = (user.tenantId as string | undefined) ?? 'default';

  const t = await getTranslations('purchasing.grn');

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      status: purchaseOrders.status,
      orderDate: purchaseOrders.orderDate,
      supplierName: partners.name,
      locationName: locations.name,
      notes: purchaseOrders.notes,
    })
    .from(purchaseOrders)
    .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
    .leftJoin(locations, eq(purchaseOrders.locationId, locations.id))
    .where(and(eq(purchaseOrders.id, params.id), eq(purchaseOrders.tenantId, tenantId)))
    .limit(1);

  if (!po) return notFound();

  const poLines = await db
    .select({
      id: purchaseOrderLines.id,
      productId: purchaseOrderLines.productId,
      variantId: purchaseOrderLines.variantId,
      productName: products.name,
      uom: purchaseOrderLines.uom,
      qtyOrdered: purchaseOrderLines.qtyOrdered,
      qtyReceived: purchaseOrderLines.qtyReceived,
      notes: purchaseOrderLines.notes,
    })
    .from(purchaseOrderLines)
    .leftJoin(products, eq(purchaseOrderLines.productId, products.id))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id));

  // A PO is receivable if its status is 'approved' or 'partial'
  const isReceivable = po.status === 'approved' || po.status === 'partial';
  const hasItemsToReceive = poLines.some(l => Number(l.qtyOrdered) > Number(l.qtyReceived));
  
  const canReceive = isReceivable && hasItemsToReceive;

  // Format product names depending on language preference, but we'll try to extract id if it's a JSON
  const formatProductName = (nameData: any) => {
    if (!nameData) return 'Unknown Product';
    if (typeof nameData === 'string') return nameData;
    return nameData.id || nameData.en || nameData.zh || 'Unknown Product';
  };

  const formattedLines = poLines.map(l => ({
    ...l,
    productName: formatProductName(l.productName),
  }));

  const localizedLocation = (nameData: any) => {
    if (!nameData) return 'Unknown';
    if (typeof nameData === 'string') return nameData;
    return nameData.id || nameData.en || nameData.zh || 'Unknown';
  };

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/purchasing" className="text-sm font-semibold text-brand-ink-3 hover:text-brand-ink">
            &larr; Kembali
          </Link>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">
            {t('poDetails')} - {po.number}
          </h1>
        </div>

        <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-ink-3">{t('supplier')}</p>
            <p className="font-medium text-brand-ink">{po.supplierName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-ink-3">{t('date')}</p>
            <p className="font-medium text-brand-ink">{po.orderDate}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-ink-3">Lokasi</p>
            <p className="font-medium text-brand-ink">{localizedLocation(po.locationName)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-ink-3">{t('status')}</p>
            <span className="inline-block mt-1 rounded-full bg-brand-cream-1 px-2.5 py-1 text-xs font-semibold text-brand-ink">
              {po.status}
            </span>
          </div>
        </div>

        {canReceive ? (
          <GrnForm poId={po.id} lines={formattedLines} />
        ) : (
          <div className="rounded-xl border border-brand-cream-3 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-brand-ink mb-4">{t('items')}</h2>
            {hasItemsToReceive === false ? (
              <p className="text-sm text-brand-jade font-medium bg-brand-jade/10 p-3 rounded-md">
                {t('fullyReceived')}
              </p>
            ) : (
              <p className="text-sm text-brand-gold font-medium bg-brand-gold/10 p-3 rounded-md">
                PO is in status "{po.status}" and cannot be received right now.
              </p>
            )}
            
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-cream-3 text-sm text-left">
                <thead className="bg-brand-cream-1 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  <tr>
                    <th className="px-4 py-3">{t('product')}</th>
                    <th className="px-4 py-3 text-right">{t('ordered')}</th>
                    <th className="px-4 py-3 text-right">{t('alreadyReceived')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream-3">
                  {formattedLines.map(line => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-brand-ink">{line.productName}</td>
                      <td className="px-4 py-3 text-right font-mono text-brand-ink">{line.qtyOrdered} {line.uom}</td>
                      <td className="px-4 py-3 text-right font-mono text-brand-ink">{line.qtyReceived} {line.uom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
