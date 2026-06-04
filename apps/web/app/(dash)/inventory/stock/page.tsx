/**
 * Stok per Lokasi - read-only stock-level browser.
 *
 * Surfaces `stock_levels` joined to products and locations so the
 * operator can see at a glance: which location has what, what's
 * untracked, what's low. Edits happen through the Opname or Adjustment
 * workflows (linked from this page).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { formatQty as formatQuantity } from '@/lib/format-qty';
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
import { StockLocationFilter } from './stock-location-filter';

export const metadata: Metadata = {
  title: 'Stock Levels',
};

export const dynamic = 'force-dynamic';

interface SearchProps {
  searchParams: Promise<{ kind?: string; locationId?: string }>;
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
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  const scope = await authorizedLocationIdsForTenant(userId, 'inventory.view', tenantId);
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');
  const locale = await getLocale();
  const t = await getTranslations('inventory.stockPerOutlet');

  const { kind: kindParam, locationId: locationIdParam } = await searchParams;
  const kind = (
    KIND_TABS.map((k) => k.value).includes(kindParam as ProductKind | 'all') ? kindParam : 'all'
  ) as ProductKind | 'all';
  const selectedLocationId = locationIdParam || '';

  const locationConds = [
    eq(locations.tenantId, tenantId),
    eq(locations.status, 'active'),
    inArray(locations.type, ['store', 'warehouse', 'office']),
  ];
  if (!scope.global) {
    locationConds.push(inArray(locations.id, scope.locationIds));
  }

  // Active, authorized outlets, warehouses, and offices.
  const outletRows = await db
    .select({ id: locations.id, code: locations.code, name: locations.name })
    .from(locations)
    .where(and(...locationConds))
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
      defaultCostPrice: products.defaultCostPrice,
    })
    .from(products)
    .where(and(...productConditions))
    .orderBy(products.sku);

  // Stock totals per (productId, locationId), aggregating across batches/variants.
  const productIds = productRows.map((p) => p.id);
  const outletIds = outletRows.map((outlet) => outlet.id);
  const stockRows =
    productIds.length && outletIds.length
      ? await db
          .select({
            productId: stockLevels.productId,
            locationId: stockLevels.locationId,
            qtyOnHand: sql<string>`sum(${stockLevels.qtyOnHand})::text`,
            qtyAvailable: sql<string>`sum(${stockLevels.qtyAvailable})::text`,
            inventoryValue: sql<string>`round(sum(${stockLevels.qtyOnHand} * COALESCE(${stockLevels.avgUnitCost}, ${products.defaultCostPrice}, 0)::numeric))::text`,
          })
          .from(stockLevels)
          .innerJoin(products, eq(products.id, stockLevels.productId))
          .where(
            and(
              eq(stockLevels.tenantId, tenantId),
              eq(products.tenantId, tenantId),
              inArray(stockLevels.productId, productIds),
              inArray(stockLevels.locationId, outletIds),
            ),
          )
          .groupBy(stockLevels.productId, stockLevels.locationId)
      : [];

  const stockMap = new Map<string, { onHand: string; available: string; inventoryValue: string }>();
  for (const row of stockRows) {
    stockMap.set(`${row.productId}::${row.locationId}`, {
      onHand: row.qtyOnHand ?? '0',
      available: row.qtyAvailable ?? '0',
      inventoryValue: row.inventoryValue ?? '0',
    });
  }

  const productSummaries = new Map<
    string,
    { totalOnHand: number; inventoryValue: bigint; unitCost: number }
  >();
  let totalInventoryValue = 0n;
  for (const product of productRows) {
    let totalOnHand = 0;
    let inventoryValue = 0n;

    for (const outlet of outletRows) {
      const stock = stockMap.get(`${product.id}::${outlet.id}`);
      if (!stock) continue;
      totalOnHand += parseQty(stock.onHand);
      inventoryValue += parseMoneyValue(stock.inventoryValue);
    }

    totalInventoryValue += inventoryValue;
    productSummaries.set(product.id, {
      totalOnHand,
      inventoryValue,
      unitCost:
        totalOnHand > 0
          ? Number(inventoryValue) / totalOnHand
          : Number(product.defaultCostPrice ?? 0n),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        eyebrow={t('eyebrow')}
        actions={
          <div className="flex items-center gap-2">
            <ExportXlsxButton
              filename={`stock-location-${new Date().toISOString().split('T')[0]}.xlsx`}
              sheets={[
                {
                  name: 'Stock',
                  rows: [
                    [
                      t('columns.sku'),
                      t('columns.name'),
                      t('columns.uom'),
                      ...outletRows.map((o) => o.code),
                      t('columns.totalStock'),
                      t('columns.costPrice'),
                      t('columns.inventoryValue'),
                    ],
                    ...productRows.map((product) => {
                      const summary = productSummaries.get(product.id);
                      return [
                        product.sku,
                        pickLocalized(product.name, locale, product.sku),
                        product.uom,
                        ...outletRows.map((outlet) => {
                          const stock = stockMap.get(`${product.id}::${outlet.id}`);
                          return stock ? Number(stock.available) : 0;
                        }),
                        summary?.totalOnHand ?? 0,
                        Math.round(summary?.unitCost ?? 0),
                        Number(summary?.inventoryValue ?? 0n),
                      ];
                    }),
                  ],
                },
              ]}
              label={t('exportExcel')}
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
        }
      />

      <div className="rounded-lg border border-brand-cream-3 bg-card px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase text-brand-ink-3">
          {t('totalInventoryValue')}
        </p>
        <p className="mt-1 text-2xl font-bold text-brand-ink">
          {formatMoney(totalInventoryValue, locale)}
        </p>
        <p className="mt-1 text-xs text-brand-ink-3">{t('stockValueHint')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {KIND_TABS.map((tab) => {
            const params = new URLSearchParams();
            if (tab.value !== 'all') params.set('kind', tab.value);
            if (selectedLocationId) params.set('locationId', selectedLocationId);
            const href = `/inventory/stock${params.size > 0 ? `?${params.toString()}` : ''}`;
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
        <StockLocationFilter
          outlets={outletRows.map((o) => ({ id: o.id, label: `${o.code} — ${pickLocalized(o.name, locale, o.code)}` }))}
          selectedId={selectedLocationId}
          kind={kind}
          allLocationsLabel={t('allLocations')}
          locationFilterLabel={t('filterLocation')}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="px-4 py-3">{t('columns.sku')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.name')}</TableHead>
              <TableHead className="px-4 py-3">{t('columns.uom')}</TableHead>
              {(selectedLocationId ? outletRows.filter((o) => o.id === selectedLocationId) : outletRows).map((outlet) => (
                <TableHead key={outlet.id} className="px-4 py-3 text-right">
                  {outlet.code}
                </TableHead>
              ))}
              <TableHead className="px-4 py-3 text-right">{t('columns.totalStock')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{t('columns.costPrice')}</TableHead>
              <TableHead className="px-4 py-3 text-right">{t('columns.inventoryValue')}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {(() => {
              const filteredProducts = selectedLocationId
                ? productRows.filter((product) => {
                    const stock = stockMap.get(`${product.id}::${selectedLocationId}`);
                    return stock && Number(stock.available) > 0;
                  })
                : productRows;
              const displayOutlets = selectedLocationId
                ? outletRows.filter((o) => o.id === selectedLocationId)
                : outletRows;
              return filteredProducts.length === 0 ? (
              <tr>
                <td
                  colSpan={6 + displayOutlets.length}
                  className="px-4 py-8 text-center text-brand-ink-3"
                >
                  {t('empty')}
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const displayName = pickLocalized(product.name, locale, product.sku);
                const summary = productSummaries.get(product.id);
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
                    {(selectedLocationId ? outletRows.filter((o) => o.id === selectedLocationId) : outletRows).map((outlet) => {
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
                          {isUntracked ? t('untracked') : formatQty(available ?? 0)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatQty(summary?.totalOnHand ?? 0)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatMoney(BigInt(Math.round(summary?.unitCost ?? 0)), locale)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-brand-ink">
                      {formatMoney(summary?.inventoryValue ?? 0n, locale)}
                    </TableCell>
                  </tr>
                );
              })
            );
            })()}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatQty(value: number): string {
  return formatQuantity(value);
}

function parseQty(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoneyValue(value: string | null | undefined): bigint {
  const parsed = Number(value ?? 0);
  return BigInt(Number.isFinite(parsed) ? Math.round(parsed) : 0);
}

function formatMoney(value: bigint, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
