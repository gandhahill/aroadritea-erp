import { getStockLedger } from '@erp/services/inventory';
import { db, eq, and, isNull } from '@erp/db';
import { products, stockLocations } from '@erp/db/schema/inventory';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@erp/ui';
import { StockLedgerFilter } from './stock-ledger-filter';

export default async function StockLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; locationId?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const perm = await requirePermission(userId, 'inventory.view');
  if (!perm.ok) redirect('/');

  const t = await getTranslations('inventory.stockLedger');
  const sp = await searchParams;
  const { productId, locationId } = sp;

  // Options for the selector UI.
  const [productRows, locationRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), isNull(products.deletedAt))),
    db
      .select({ id: stockLocations.id, name: stockLocations.name })
      .from(stockLocations)
      .where(eq(stockLocations.tenantId, tenantId)),
  ]);
  const productOptions = productRows.map((p) => ({ id: p.id, name: p.name as Record<string, string> }));
  const locationOptions = locationRows.map((l) => ({ id: l.id, name: l.name as Record<string, string> }));

  let detail = null;
  if (productId && locationId) {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    const [location] = await db.select().from(stockLocations).where(eq(stockLocations.id, locationId));
    const result = await getStockLedger({ tenantId, productId, locationId });
    const movements = result.ok ? result.value : [];

    detail = (
      <div className="surface-card overflow-hidden">
        <div className="border-b border-brand-cream-2 px-6 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('movementHistory')}</h2>
          <p className="text-sm text-brand-muted">
            {t('productAt', {
              product: (product?.name as Record<string, string>)?.id ?? productId,
              location: (location?.name as Record<string, string>)?.id ?? locationId,
            })}
          </p>
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
                    <TableCell
                      className={`text-right font-medium ${Number.parseFloat(m.qtyDelta) > 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {Number.parseFloat(m.qtyDelta) > 0 ? '+' : ''}
                      {m.qtyDelta}
                    </TableCell>
                    <TableCell>{m.uom}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <StockLedgerFilter
        products={productOptions}
        locations={locationOptions}
        productId={productId}
        locationId={locationId}
      />
      {!productId || !locationId ? <p className="text-brand-muted">{t('selectPrompt')}</p> : detail}
    </div>
  );
}
