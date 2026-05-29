import { getStockLedger } from '@erp/services/inventory';
import { db, eq } from '@erp/db';
import { products, stockLocations } from '@erp/db/schema/inventory';
import { getTranslations } from 'next-intl/server';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@erp/ui';

export default async function StockLedgerPage({
  searchParams,
}: {
  searchParams: { productId?: string; locationId?: string; tenantId?: string };
}) {
  const t = await getTranslations('inventory.stockLedger');
  const { productId, locationId, tenantId = 'TENANT-001' } = searchParams;

  if (!productId || !locationId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">{t('title')}</h1>
        <p>{t('selectPrompt')}</p>
      </div>
    );
  }

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  const [location] = await db.select().from(stockLocations).where(eq(stockLocations.id, locationId));

  const result = await getStockLedger({
    tenantId,
    productId,
    locationId,
  });

  const movements = result.ok ? result.value : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-brand-muted">
            {t('productAt', {
              product: product?.name?.id ?? productId,
              location: location?.name?.id ?? locationId,
            })}
          </p>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-brand-cream-2 px-6 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('movementHistory')}</h2>
        </div>
        <div className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('reason')}</TableHead>
                <TableHead>{t('reference')}</TableHead>
                <TableHead className="text-right">{t('qtyDelta')}</TableHead>
                <TableHead>{t('uom')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-brand-muted">
                    {t('noMovements')}
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.occurredAt).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{m.reason.replace('_', ' ')}</TableCell>
                    <TableCell>
                      {m.referenceType && m.referenceId ? `${m.referenceType}: ${m.referenceId}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${Number.parseFloat(m.qtyDelta) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number.parseFloat(m.qtyDelta) > 0 ? '+' : ''}{m.qtyDelta}
                    </TableCell>
                    <TableCell>{m.uom}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
