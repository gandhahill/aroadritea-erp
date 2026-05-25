import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import {
  and,
  db,
  eq,
  locations,
  partners,
  products,
  purchaseOrderLines,
  purchaseOrders,
} from '@erp/db';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { GrnForm } from './grn-form';

function shipmentBadgeClass(status: string | null, hasError: boolean): string {
  if (hasError) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (!status) return 'border-brand-cream-3 bg-brand-cream-1 text-brand-ink-3';
  if (['DELIVERED', 'TERKIRIM', 'DITERIMA'].includes(status.toUpperCase()))
    return 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade';
  return 'border-brand-gold/40 bg-brand-gold/15 text-brand-wood';
}

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
      shippingCourierCode: purchaseOrders.shippingCourierCode,
      shippingAwb: purchaseOrders.shippingAwb,
      shippingTrackingStatus: purchaseOrders.shippingTrackingStatus,
      shippingTrackingSyncedAt: purchaseOrders.shippingTrackingSyncedAt,
      shippingTrackingError: purchaseOrders.shippingTrackingError,
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
    })
    .from(purchaseOrderLines)
    .leftJoin(products, eq(purchaseOrderLines.productId, products.id))
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id));

  // A PO is receivable if its status is 'approved' or 'partial'
  const isReceivable = po.status === 'approved' || po.status === 'partial';
  const hasItemsToReceive = poLines.some((l) => Number(l.qtyOrdered) > Number(l.qtyReceived));

  const canReceive = isReceivable && hasItemsToReceive;

  // Format product names depending on language preference, but we'll try to extract id if it's a JSON
  const formatProductName = (nameData: any) => {
    if (!nameData) return 'Unknown Product';
    if (typeof nameData === 'string') return nameData;
    return nameData.id || nameData.en || nameData.zh || 'Unknown Product';
  };

  const formattedLines = poLines.map((l) => ({
    ...l,
    productName: formatProductName(l.productName),
  }));

  const localizedLocation = (nameData: any) => {
    if (!nameData) return 'Unknown';
    if (typeof nameData === 'string') return nameData;
    return nameData.id || nameData.en || nameData.zh || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 lg:px-8">
        <PageHeader
          title={
            <>
              {t('poDetails')}- {po.number}
            </>
          }
        />

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

        {/* T-0185: shipment quick-status with link to detail page. */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-ink-3">
                Pengiriman / Shipment
              </p>
              <p className="mt-1 text-sm font-medium text-brand-ink">
                {po.shippingAwb
                  ? `${po.shippingCourierCode?.toUpperCase() ?? ''} · ${po.shippingAwb}`
                  : 'Belum ada nomor resi'}
              </p>
              {po.shippingTrackingError ? (
                <p className="mt-1 text-xs text-rose-700">{po.shippingTrackingError}</p>
              ) : po.shippingTrackingSyncedAt ? (
                <p className="mt-1 text-xs text-brand-ink-3">
                  Disinkron:{' '}
                  {po.shippingTrackingSyncedAt.toISOString().slice(0, 16).replace('T', ' ')}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${shipmentBadgeClass(po.shippingTrackingStatus, Boolean(po.shippingTrackingError))}`}
              >
                {po.shippingTrackingError
                  ? 'Error'
                  : (po.shippingTrackingStatus ?? 'Belum disinkron')}
              </span>
              <Link
                href={`/purchasing/shipments/${po.id}`}
                className="rounded-lg border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-cream-1"
              >
                Detail
              </Link>
            </div>
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
              <Table className=" text-left">
                <TableHeader className="bg-brand-cream-1 text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
                  <tr>
                    <TableHead className="px-4 py-3">{t('product')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('ordered')}</TableHead>
                    <TableHead className="px-4 py-3 text-right">{t('alreadyReceived')}</TableHead>
                  </tr>
                </TableHeader>
                <TableBody className="divide-y divide-brand-cream-3">
                  {formattedLines.map((line) => (
                    <tr key={line.id}>
                      <TableCell className="px-4 py-3 text-brand-ink">{line.productName}</TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono text-brand-ink">
                        {line.qtyOrdered} {line.uom}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-mono text-brand-ink">
                        {line.qtyReceived} {line.uom}
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
