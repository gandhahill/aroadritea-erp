'use client';

import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button, Input, Select, SearchableSelect, Table, TableBody, TableCell, TableHead } from '@erp/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { type ManualSalesPageData, createManualSalesAction, fetchManualSaleDetailAction, deleteManualSalesAction, updateManualSalesAction } from './actions';
import { ExportManualSalesButton } from './export-manual-sales-button';

interface Props {
  data: ManualSalesPageData;
  defaultLocationId: string;
}

export function ManualSalesClient({ data, defaultLocationId }: Props) {
  const t = useTranslations('pos.manualSales');
  const pagination = useTranslations('common.pagination');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, submitAction, isPending] = useActionState(async (prev: any, formData: FormData) => {
    const id = formData.get('id') as string;
    return id 
      ? await updateManualSalesAction(id, prev, formData)
      : await createManualSalesAction(prev, formData);
  }, null);
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
  
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      channel: string;
      method: string;
      grossSales: string;
      transactionCount: number;
    }>
  >([{ id: Date.now().toString(), channel: 'walk_in', method: 'cash', grossSales: '', transactionCount: 0 }]);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deductBom, setDeductBom] = useState(true);

  // Automatically calculate grossSales from lineItems if only 1 payment exists
  useEffect(() => {
    if (lineItems.length > 0 && payments.length === 1) {
      const sum = lineItems.reduce((acc, curr) => acc + BigInt(curr.total || '0'), BigInt(0));
      setPayments((prev) => {
        const newPayments = [...prev];
        newPayments[0] = { ...newPayments[0]!, grossSales: sum.toString() };
        return newPayments;
      });
    }
  }, [lineItems]);

  useEffect(() => {
    if (state?.ok) {
      const form = document.getElementById('manual-sales-form') as HTMLFormElement | null;
      form?.reset();
      setPayments([{ id: Date.now().toString(), channel: 'walk_in', method: 'cash', grossSales: '', transactionCount: 0 }]);
      setLineItems([]);
      setEditId(null);
    }
  }, [state]);

  const startEdit = async (id: string) => {
    setEditId(id);
    const res = await fetchManualSaleDetailAction(id);
    if (res.ok && res.value) {
      const data = res.value;
      if (data.lineItems && Array.isArray(data.lineItems)) {
        setLineItems(data.lineItems.map((l: any) => ({
          productId: l.productId,
          variantId: l.variantId || undefined,
          name: l.name,
          qty: l.qty,
          price: l.price,
          total: l.total,
        })));
      } else {
        setLineItems([]);
      }
      setPayments([{
        id: Date.now().toString(),
        channel: data.closing.channel,
        method: data.closing.paymentMethod,
        grossSales: data.closing.grossSales,
        transactionCount: data.closing.transactionCount,
      }]);
      // find inputs and set them manually because defaultValue doesn't react
      const form = document.getElementById('manual-sales-form') as HTMLFormElement | null;
      if (form) {
        const dInput = form.elements.namedItem('discountTotal') as HTMLInputElement;
        if (dInput) dInput.value = data.closing.discountTotal || '0';
        const sInput = form.elements.namedItem('salesDate') as HTMLInputElement;
        if (sInput) sInput.value = data.closing.salesDate;
        const refInput = form.elements.namedItem('sourceReference') as HTMLInputElement;
        if (refInput) refInput.value = data.closing.sourceReference || '';
        const noteInput = form.elements.namedItem('notes') as HTMLInputElement;
        if (noteInput) noteInput.value = data.closing.notes || '';
      }
      document.getElementById('manual-sales-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    await deleteManualSalesAction(deleteConfirmId);
    setIsDeleting(false);
    setDeleteConfirmId(null);
  };

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
      <div className="flex items-start justify-between">
        <PageHeader
          title={<>{t('title')}</>}
          description={<>{t('subtitle')}</>}
          eyebrow={<>{t('eyebrow')}</>}
        />
        <Link 
          href="/pos/manual-sales/consumed" 
          className="inline-flex items-center justify-center rounded-lg bg-brand-cream px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-2 border border-brand-cream-3"
        >
          {t('consumedIngredients', { defaultValue: 'Pemakaian Bahan' })} &rarr;
        </Link>
      </div>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <form id="manual-sales-form" action={submitAction} className="grid gap-4 lg:grid-cols-4">
          <input type="hidden" name="id" value={editId || ''} />
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
          <Field label={t('sourceReference')}>
            <Input name="sourceReference" />
          </Field>
          <Field label={t('notes')}>
            <Input name="notes" />
          </Field>

          {/* Payments Section */}
          <div className="lg:col-span-4 rounded-xl border border-brand-cream-3 p-4 bg-brand-cream-2/30">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">{t('payments', { defaultValue: 'Metode Pembayaran' })}</h3>
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={payment.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-cream-3 bg-card p-3 shadow-sm">
                  <div className="w-32">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">{t('channel')}</span>
                    <Select
                      value={payment.channel}
                      onChange={(e) => {
                        const newPayments = [...payments];
                        newPayments[index] = { ...newPayments[index]!, channel: e.target.value };
                        setPayments(newPayments);
                      }}
                    >
                      <option value="walk_in">{t('walkIn')}</option>
                      <option value="gofood">GoFood</option>
                      <option value="grabfood">GrabFood</option>
                      <option value="shopeefood">ShopeeFood</option>
                    </Select>
                  </div>
                  <div className="w-32">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">{t('paymentMethod')}</span>
                    <Select
                      value={payment.method}
                      onChange={(e) => {
                        const newPayments = [...payments];
                        newPayments[index] = { ...newPayments[index]!, method: e.target.value };
                        setPayments(newPayments);
                      }}
                    >
                      <option value="cash">{t('cash')}</option>
                      <option value="qris">QRIS</option>
                      <option value="card">{t('card', { defaultValue: 'Kartu' })}</option>
                      <option value="gofood">GoFood</option>
                      <option value="grabfood">GrabFood</option>
                      <option value="shopeefood">ShopeeFood</option>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">{t('grossSales')}</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={payment.grossSales}
                      required
                      onChange={(e) => {
                        const newPayments = [...payments];
                        newPayments[index] = { ...newPayments[index]!, grossSales: e.target.value.replace(/\D/g, '') };
                        setPayments(newPayments);
                      }}
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">{t('transactionCount')}</span>
                    <Input
                      type="number"
                      min={0}
                      value={payment.transactionCount}
                      onChange={(e) => {
                        const newPayments = [...payments];
                        newPayments[index] = { ...newPayments[index]!, transactionCount: Number.parseInt(e.target.value) || 0 };
                        setPayments(newPayments);
                      }}
                    />
                  </div>
                  {payments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-brand-red mb-1"
                      onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPayments([...payments, { id: Date.now().toString(), channel: 'walk_in', method: 'cash', grossSales: '', transactionCount: 0 }])}
              >
                + {t('addPayment', { defaultValue: 'Tambah Pembayaran' })}
              </Button>
            </div>
            <input type="hidden" name="paymentsJson" value={JSON.stringify(payments)} />
          </div>

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
                    <SearchableSelect
                      options={[
                        { value: '', label: t('selectProduct', { defaultValue: 'Select Product...' }) },
                        ...data.products.map(p => ({
                          value: `${p.id}::${p.variantId || ''}`,
                          label: p.name
                        }))
                      ]}
                      value={`${item.productId}::${item.variantId || ''}`}
                      searchPlaceholder={t('search', { defaultValue: 'Cari...' })}
                      emptyMessage={t('noResultsFound', { defaultValue: 'Tidak ada hasil' })}
                      onChange={(val) => {
                        const [pid, vid] = val.split('::');
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
                    />
                  </div>
                  <div className="w-24">
                    <span className="mb-1.5 block text-xs font-medium text-brand-ink-3">
                      {t('qty')}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step="1"
                      value={item.qty}
                      onKeyDown={(e) => {
                        if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const qty = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
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
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="deductBom"
                name="deductBom"
                value="true"
                checked={deductBom}
                onChange={(e) => setDeductBom(e.target.checked)}
                className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-red"
              />
              <label htmlFor="deductBom" className="text-sm font-medium text-brand-ink-2">
                {t('deductBom')}
              </label>
            </div>
          </div>

          <Field label={t('discountTotal')}>
            <Input name="discountTotal" inputMode="numeric" defaultValue="0" />
          </Field>
          
          <div className="lg:col-span-3 flex items-end">
            <Button
              type="submit"
              disabled={isPending || data.locations.length === 0}
              className="w-full rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
              variant="primary"
              size="lg"
            >
              {isPending ? t('posting') : (editId ? t('update', { defaultValue: 'Update' }) : t('post'))}
            </Button>
            {editId && (
              <Button
                type="button"
                variant="ghost"
                className="ml-3"
                onClick={() => {
                  setEditId(null);
                  (document.getElementById('manual-sales-form') as HTMLFormElement)?.reset();
                  setPayments([{ id: Date.now().toString(), channel: 'walk_in', method: 'cash', grossSales: '', transactionCount: 0 }]);
                  setLineItems([]);
                }}
              >
                {t('cancel', { defaultValue: 'Batal' })}
              </Button>
            )}
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
                <Th>{t('postedBy', { defaultValue: 'Dibuat Oleh' })}</Th>
                <Th align="right">{t('actions', { defaultValue: 'Aksi' })}</Th>
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
                    <Td>{item.createdByName || '-'}</Td>
                    <Td align="right">
                      {item.status !== 'voided' ? (
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(item.id)}>
                            {t('edit', { defaultValue: 'Edit' })}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-brand-red" onClick={() => confirmDelete(item.id)}>
                            {t('delete', { defaultValue: 'Hapus' })}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-ink-3 italic">{t('voided', { defaultValue: 'Dibatalkan' })}</span>
                      )}
                    </Td>
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
                <p className="text-center text-sm text-brand-ink-3">{t('loadingDetail')}</p>
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
                      <p className="text-sm text-brand-ink-3 italic">{t('noProducts')}</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-brand-ink">{t('stockAdjustment')}</h4>
                    {detailData.stockMovements && detailData.stockMovements.length > 0 ? (
                      <table className="w-full text-sm border border-brand-cream-3 rounded-lg overflow-hidden">
                        <thead className="bg-brand-cream-2 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium text-brand-ink-2">{t('productOrIngredient')}</th>
                            <th className="px-3 py-2 font-medium text-brand-ink-2 text-right">{t('change')}</th>
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
                      <p className="text-sm text-brand-ink-3 italic">{t('noStockAdjustment')}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-rose-600">{t('failedToLoad')}</p>
              )}
            </div>
            <div className="border-t border-brand-cream-3 p-4 bg-brand-cream flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setDetailModalOpen(false)}>
                {t('close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <button type="button" aria-label="close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirmId(null)} />
          <div className="relative z-10 flex w-full max-w-sm flex-col rounded-2xl bg-card shadow-2xl overflow-hidden">
            <div className="border-b border-brand-cream-3 px-6 py-4 flex justify-between items-center bg-brand-cream">
              <h3 className="text-lg font-semibold text-brand-ink">{t('confirmDeleteTitle', { defaultValue: 'Hapus Transaksi?' })}</h3>
              <button type="button" disabled={isDeleting} onClick={() => setDeleteConfirmId(null)} className="text-brand-ink-3 hover:text-brand-ink disabled:opacity-50">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-brand-ink-2">
                {t('confirmDelete', { defaultValue: 'Yakin hapus transaksi ini? (Jurnal dan stok akan dibalikkan)' })}
              </p>
            </div>
            <div className="border-t border-brand-cream-3 p-4 bg-brand-cream flex justify-end gap-3">
              <Button type="button" variant="ghost" disabled={isDeleting} onClick={() => setDeleteConfirmId(null)}>
                {t('cancel', { defaultValue: 'Batal' })}
              </Button>
              <Button type="button" variant="primary" disabled={isDeleting} className="bg-brand-red hover:bg-brand-red-dark text-white" onClick={executeDelete}>
                {isDeleting ? t('deleting', { defaultValue: 'Menghapus...' }) : t('delete', { defaultValue: 'Hapus' })}
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
