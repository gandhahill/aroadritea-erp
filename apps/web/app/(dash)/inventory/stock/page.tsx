/**
 * Stok per Outlet — read-only stock-level browser.
 *
 * Surfaces `stock_levels` joined to products and locations so the
 * operator can see at a glance: which outlet has what, what's
 * untracked, what's low. Edits happen through the Opname or Adjustment
 * workflows (linked from this page).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import { and, db, eq, inArray, sql } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { products, stockLevels } from '@erp/db/schema/inventory';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '@erp/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExportXlsxButton } from '../../reporting/export-button';

export const metadata: Metadata = {
  title: 'Stok per Outlet',
};

export const dynamic = 'force-dynamic';

interface SearchProps {
  searchParams: Promise<{ kind?: string }>;
}

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';
const KIND_TABS: { value: ProductKind | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'finished_good', labelKey: 'finishedGood' },
  { value: 'raw_material', labelKey: 'rawMaterial' },
  { value: 'consumable', labelKey: 'consumable' },
  { value: 'merchandise', labelKey: 'merchandise' },
];

export default async function StockPerOutletPage({ searchParams }: SearchProps) {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const locale = await getLocale();
  const t = await getTranslations('inventory.stockPerOutlet');

  const { kind: kindParam } = await searchParams;
  const kind = (
    KIND_TABS.map((k) => k.value).includes(kindParam as ProductKind | 'all') ? kindParam : 'all'
  ) as ProductKind | 'all';

  // Active store outlets
  const outletRows = await db
    .select({ id: locations.id, code: locations.code, name: locations.name })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
      ),
    )
    .orderBy(locations.code);

  // Products in the chosen kind
  const productConditions = [eq(products.tenantId, tenantId), eq(products.isActive, true)];
  if (kind !== 'all') {
    productConditions.push(eq(products.kind, kind));
  }
  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      kind: products.kind,
      uom: products.uom,
    })
    .from(products)
    .where(and(...productConditions))
    .orderBy(products.sku);

  // Stock totals per (productId, locationId), aggregating across batches/variants.
  const productIds = productRows.map((p) => p.id);
  const stockRows = productIds.length
    ? await db
        .select({
          productId: stockLevels.productId,
          locationId: stockLevels.locationId,
          qtyOnHand: sql<string>`sum(${stockLevels.qtyOnHand})::text`,
          qtyAvailable: sql<string>`sum(${stockLevels.qtyAvailable})::text`,
        })
        .from(stockLevels)
        .where(and(eq(stockLevels.tenantId, tenantId), inArray(stockLevels.productId, productIds)))
        .groupBy(stockLevels.productId, stockLevels.locationId)
    : [];

  const stockMap = new Map<string, { onHand: string; available: string }>();
  for (const row of stockRows) {
    stockMap.set(`${row.productId}::${row.locationId}`, {
      onHand: row.qtyOnHand ?? '0',
      available: row.qtyAvailable ?? '0',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        eyebrow={<>Inventory</>}
        actions={
          <>
            <div className="flex items-center gap-2">
              <ExportXlsxButton
                filename={`stock-outlet-${new Date().toISOString().split('T')[0]}.xlsx`}
                sheets={[
                  {
                    name: 'Stock',
                    rows: [
                      ['SKU', 'Name', 'UOM', ...outletRows.map((o) => o.code)],
                      ...productRows.map((product) => [
                        product.sku,
                        pickLocalized(product.name, locale, product.sku),
                        product.uom,
                        ...outletRows.map((outlet) => {
                          const stock = stockMap.get(`${product.id}::${outlet.id}`);
                          return stock ? Number(stock.available) : 0;
                        }),
                      ]),
                    ],
                  },
                ]}
                label={t('exportExcel') || 'Export Excel'}
              />
              <Link
                href="/inventory/opname"
                className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-cream-1"
              >
                {t('opnameLink')}
              </Link>
              <Link
                href="/inventory/adjust"
                className="rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark"
              >
                {t('adjustLink')}
              </Link>
            </div>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => {
          const href = `/inventory/stock${tab.value === 'all' ? '' : `?kind=${tab.value}`}`;
          const isActive = (kind === 'all' && tab.value === 'all') || kind === tab.value;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-cream-2 text-brand-ink-2 hover:bg-brand-cream-3'
              }`}
            >
              {t(`kinds.${tab.labelKey}`)}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{t('columns.sku')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.name')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.uom')}</TableHead>
              {outletRows.map((outlet) => (
                <TableHead key={outlet.id} className="px-4 py-3 text-right">
                  {outlet.code}
                </TableHead>
              ))}
            </tr>
          </TableHeader>
          <TableBody>
            {productRows.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + outletRows.length}
                  className="px-4 py-8 text-center text-brand-ink-3"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              productRows.map((product) => {
                const displayName = pickLocalized(product.name, locale, product.sku);
                return (
                  <tr key={product.id} className="hover:bg-brand-cream-1/60">
                    <TableCell className="px-4 py-3 font-mono text-xs text-brand-ink">
                      {product.sku}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-brand-ink">
                      {displayName}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-brand-ink-3">
                      {product.uom}
                    </TableCell>
                    {outletRows.map((outlet) => {
                      const stock = stockMap.get(`${product.id}::${outlet.id}`);
                      const available = stock ? Number(stock.available) : null;
                      const isUntracked = available === null;
                      const isEmpty = !isUntracked && available <= 0;
                      const isLow = !isUntracked && available > 0 && available < 5;
                      return (
                        <TableCell
                          key={outlet.id}
                          className={`px-4 py-3 text-right font-semibold ${
                            isUntracked
                              ? 'text-brand-ink-3'
                              : isEmpty
                                ? 'text-rose-600'
                                : isLow
                                  ? 'text-amber-600'
                                  : 'text-brand-ink'
                          }`}
                        >
                          {isUntracked ? t('untracked') : formatQty(available!)}
                        </TableCell>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}
