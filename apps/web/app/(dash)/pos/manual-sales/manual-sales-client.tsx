'use client';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button, Input, Select, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { type ManualSalesPageData, createManualSalesAction, fetchManualSaleDetailAction } from './actions';
import { ExportManualSalesButton } from './export-manual-sales-button';

interface Props {
  data: ManualSalesPageData;
  defaultLocationId: string;
}

export function ManualSalesClient({ data, defaultLocationId }: Props) {
  const t = useTranslations('pos.manualSales');
  const pagination = useTranslations('common.pagination');
  const [state, submitAction, isPending] = useActionState(createManualSalesAction, null);
  const [lineItems, setLineItems] = useState<
    Array<{
      productId: string;
      variantId?: string;
      name: string;
      qty: number;
      price: string;
      total: string;
    }>
  >([]);
  const [grossSales, setGrossSales] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Automatically calculate grossSales from lineItems
  useEffect(() => {
    if (lineItems.length > 0) {
      const sum = lineItems.reduce((acc, curr) => acc + BigInt(curr.total || '0'), BigInt(0));
      setGrossSales(sum.toString());
    }
  }, [lineItems]);

  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById('manual-sales-form') as HTMLFormElement | null;
      form?.reset();
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasPrevious = data.page > 1;
  const hasNext = data.page < totalPages;
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (defaultLocationId) params.set('locationId', defaultLocationId);
    return `/pos/manual-sales?${params.toString()}`;
  };

  return (
    <div className="h-full w-full overflow-y-auto space-y-6 pb-24 px-4 pt-4">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        eyebrow={<>{t('eyebrow')}</>}
      />

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form id="manual-sales-form" action={submitAction} className="grid gap-4 lg:grid-cols-4">
          <Field label={t('location')}>
            <Select name="locationId" defaultValue={defaultLocationId} required>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('salesDate')}>
            <Input name="salesDate" type="date" defaultValue={today} required />
          </Field>
          <Field label={t('channel')}>
            <Select name="channel" defaultValue="walk_in">
              <option value="walk_in">{t('walkIn')}</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
            </Select>
          </Field>
          <Field label={t('paymentMethod')}>
            <Select name="paymentMethod" defaultValue="cash">
              <option value="cash">{t('cash')}</option>
              <option value="qris">QRIS</option>
              <option value="debit">Debit</option>
              <option value="credit">{t('credit')}</option>
              <option value="gofood">GoFood</option>
              <option value="grabfood">GrabFood</option>
              <option value="shopeefood">ShopeeFood</option>
            </Select>
          </Field>
          <div className="lg:col-span-4 rounded-xl border border-brand-cream-3 p-4">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">{t('products')}</h3>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-cream-3 bg-brand-cream-2/50 p-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('product')}
                    </span>
                    <Select
                      value={`${item.productId}::${item.variantId || ''}`}
                      onChange={(e) => {
                        const [pid, vid] = e.target.value.split('::');
                        const product = data.products.find(
                          (p) => p.id === pid && (p.variantId || '') === vid,
                        );
                        if (!product) return;
                        const newItems = [...lineItems];
                        const current = newItems[index];
                        if (!current) return;
                        newItems[index] = {
                          productId: product.id,
                          variantId: product.variantId || undefined,
                          name: product.name,
                          qty: current.qty || 1,
                          price: product.sellPrice,
                          total: (BigInt(current.qty || 1) * BigInt(product.sellPrice)).toString(),
                        };
                        setLineItems(newItems);
                      }}
                    >
                      <option value="::" disabled>
                        {t('selectProduct')}
                      </option>
                      {data.products.map((p) => (
                        <option
                          key={`${p.id}::${p.variantId || ''}`}
                          value={`${p.id}::${p.variantId || ''}`}
                        >
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('qty')}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => {
                        const qty = Math.max(1, Number.parseInt(e.target.value) || 1);
                        const newItems = [...lineItems];
                        const current = newItems[index];
                        if (!current) return;
                        newItems[index] = {
                          productId: current.productId,
                          variantId: current.variantId,
                          name: current.name,
                          qty,
                          price: current.price,
                          total: (BigInt(qty) * BigInt(current.price)).toString(),
                        };
                        setLineItems(newItems);
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('price')}
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={item.price}
                      onChange={(e) => {
                        const price = e.target.value.replace(/\D/g, '') || '0';
                        const newItems = [...lineItems];
                        const current = newItems[index];
                        if (!current) return;
                        newItems[index] = {
                          productId: current.productId,
                          variantId: current.variantId,
                          name: current.name,
                          qty: current.qty,
                          price,
                          total: (BigInt(current.qty) * BigInt(price)).toString(),
                        };
                        setLineItems(newItems);
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('total')}
                    </span>
                    <Input
                      type="text"
                      readOnly
                      value={formatRupiah(item.total).replace('Rp', '').trim()}
                      className="bg-brand-cream/50"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-brand-red mb-1"
                    onClick={() => {
                      setLineItems(lineItems.filter((_, i) => i !== index));
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setLineItems([
                    ...lineItems,
                    { productId: '', name: '', qty: 1, price: '0', total: '0' },
                  ]);
                }}
              >
                + {t('addProduct', { defaultValue: 'Add Product' })}
              </Button>
            </div>
            <input
              type="hidden"
              name="lineItemsJson"
              value={JSON.stringify(lineItems.filter((i) => i.productId))}
            />
          </div>

          <Field label={t('grossSales')}>
            <Input
              name="grossSales"
              inputMode="numeric"
              required
              value={grossSales}
              onChange={(e) => setGrossSales(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label={t('discountTotal')}>
            <Input name="discountTotal" inputMode="numeric" defaultValue="0" />
          </Field>
          <Field label={t('transactionCount')}>
            <Input name="transactionCount" type="number" min={0} defaultValue={0} />
          </Field>
          <Field label={t('sourceReference')}>
            <Input name="sourceReference" />
          </Field>
          <div className="lg:col-span-3">
            <Field label={t('notes')}>
              <textarea name="notes" rows={3} />
            </Field>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isPending || data.locations.length === 0}
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
              variant="primary"
              size="lg"
            >
              {isPending ? t('posting') : t('post')}
            </Button>
          </div>
          {state?.error ? (
            <div className="lg:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}
          {state?.ok ? (
            <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t('posted')}
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card shadow-sm">
        <div className="border-b border-brand-cream-3 px-5 py-4 flex justify-between items-center">
          <h2 className="text-base font-semibold text-brand-ink">{t('history')}</h2>
          <ExportManualSalesButton locationId={defaultLocationId} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-brand-cream">
              <tr className="text-left text-brand-ink-2">
                <Th>{t('number')}</Th>
                <Th>{t('salesDate')}</Th>
                <Th>{t('channel')}</Th>
                <Th>{t('paymentMethod')}</Th>
                <Th align="right">{t('grossSales')}</Th>
                <Th align="right">{t('taxTotal')}</Th>
                <Th align="right">{t('netRevenue')}</Th>
                <Th>{t('journal')}</Th>
              </tr>
            </thead>
            <TableBody className="divide-y divide-brand-cream-3">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-ink-3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.id} className="text-brand-ink cursor-pointer hover:bg-brand-cream/50" onClick={async () => {
    setDetailModalOpen(true);
    setDetailData(null);
    setLoadingDetail(true);
    const res = await fetchManualSaleDetailAction(item.id);
    if (res.ok) {
      setDetailData(res.value);
    }
    setLoadingDetail(false);
  }}>
                    <Td>{item.number}</Td>
                    <Td>{item.salesDate}</Td>
                    <Td>{item.channel}</Td>
                    <Td>{item.paymentMethod}</Td>
                    <Td align="right">{formatRupiah(item.grossSales)}</Td>
                    <Td align="right">{formatRupiah(item.taxTotal)}</Td>
                    <Td align="right">{formatRupiah(item.netRevenue)}</Td>
                    <Td>{item.journalEntryId ? t('synced') : t('notSynced')}</Td>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pagination currentPage={data.page} totalItems={data.total} pageSize={data.pageSize} />
      </section>

      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <button type="button" aria-label="close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailModalOpen(false)} />
          <div className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl bg-card shadow-2xl overflow-hidden max-h-[90vh]">
            <div className="border-b border-brand-cream-3 px-6 py-4 flex justify-between items-center bg-brand-cream">
              <h3 className="text-lg font-semibold text-brand-ink">{t('history')} - Detail</h3>
              <button type="button" onClick={() => setDetailModalOpen(false)} className="text-brand-ink-3 hover:text-brand-ink">&times;</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-6">
              {loadingDetail ? (
                <p className="text-center text-sm text-brand-ink-3">Memuat detail...</p>
              ) : detailData ? (
                <>
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-brand-ink">{t('products')}</h4>
                    {detailData.lineItems && detailData.lineItems.length > 0 ? (
                      <table className="w-full text-sm border border-brand-cream-3 rounded-lg overflow-hidden">
                        <thead className="bg-brand-cream-2 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium text-brand-ink-2">{t('product')}</th>
                            <th className="px-3 py-2 font-medium text-brand-ink-2 text-right">{t('qty')}</th>
                            <th className="px-3 py-2 font-medium text-brand-ink-2 text-right">{t('price')}</th>
                            <th className="px-3 py-2 font-medium text-brand-ink-2 text-right">{t('total')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-cream-3">
                          {detailData.lineItems.map((l: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-brand-ink">{l.name}</td>
                              <td className="px-3 py-2 text-right text-brand-ink-2">{l.qty}</td>
                              <td className="px-3 py-2 text-right text-brand-ink-2">{formatRupiah(l.price)}</td>
                              <td className="px-3 py-2 text-right text-brand-ink-2">{formatRupiah(l.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-brand-ink-3 italic">Tidak ada rincian produk.</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-brand-ink">Penyesuaian Stok (BOM Terpotong)</h4>
                    {detailData.stockMovements && detailData.stockMovements.length > 0 ? (
                      <table className="w-full text-sm border border-brand-cream-3 rounded-lg overflow-hidden">
                        <thead className="bg-brand-cream-2 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium text-brand-ink-2">Produk / Bahan</th>
                            <th className="px-3 py-2 font-medium text-brand-ink-2 text-right">Perubahan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-cream-3">
                          {detailData.stockMovements.map((m: any, i: number) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-brand-ink">{m.productName}</td>
                              <td className="px-3 py-2 text-right text-brand-red">{m.qtyDelta} {m.uom}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-sm text-brand-ink-3 italic">Tidak ada penyesuaian stok yang terpotong.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-rose-600">Gagal memuat data.</p>
              )}
            </div>
            <div className="border-t border-brand-cream-3 p-4 bg-brand-cream flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setDetailModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <TableHead
      className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </TableHead>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <TableCell
      className={`whitespace-nowrap px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </TableCell>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-brand-cream-3 px-3 py-1.5 text-brand-ink-3 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-brand-cream-3 px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-cream"
    >
      {children}
    </Link>
  );
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
