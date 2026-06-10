import { getSession } from '@/lib/auth';
import { and, db, eq, isNull } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { products } from '@erp/db/schema/inventory';
import { requirePermission } from '@erp/services/iam';
import { getStockLedger } from '@erp/services/inventory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@erp/ui';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
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

  // Options for the selector UI — use locations (branches), not stockLocations (sub-areas).
  const [productRows, locationRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
      .orderBy(products.sku),
    db
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, tenantId),
          eq(locations.status, 'active'),
          isNull(locations.deletedAt),
        ),
      )
      .orderBy(locations.code),
  ]);

  const productOptions = productRows.map((p) => ({
    id: p.id,
    name: p.name as Record<string, string>,
  }));
  const locationOptions = locationRows.map((l) => ({
    id: l.id,
    name: {
      id: `${l.code} - ${(l.name as Record<string, string>)?.id ?? ''}`,
      en: `${l.code} - ${(l.name as Record<string, string>)?.en ?? ''}`,
      zh: `${l.code} - ${(l.name as Record<string, string>)?.zh ?? ''}`,
    },
  }));

  let detail = null;
  if (productId && locationId) {
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    const [location] = await db
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(eq(locations.id, locationId));
    const result = await getStockLedger({ tenantId, productId, locationId });
    const movements = result.ok ? result.value : [];

    const productLabel = (product?.name as Record<string, string>)?.id ?? productId;
    const locationLabel = location
      ? `${location.code} - ${(location.name as Record<string, string>)?.id ?? ''}`
      : locationId;

    detail = (
      <div className="surface-card overflow-hidden">
        <div className="border-b border-brand-cream-2 px-6 py-4">
          <h2 className="text-base font-semibold text-brand-ink">{t('movementHistory')}</h2>
          <p className="text-sm text-brand-muted">
            {t('productAt', { product: productLabel, location: locationLabel })}
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
                      {m.referenceType && m.referenceId
                        ? `${m.referenceType}: ${m.referenceId}`
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${formatWholeQty(m.qtyDelta) > 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatWholeQty(m.qtyDelta) > 0 ? '+' : ''}
                      {formatWholeQty(m.qtyDelta)}
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

function formatWholeQty(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}
