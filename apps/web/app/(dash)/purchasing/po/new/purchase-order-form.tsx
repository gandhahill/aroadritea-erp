'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useMemo, useState } from 'react';
import { type PurchaseOrderFormData, createPurchaseOrderAction } from '../../actions';
import { Button, TableCell, Select, Input, TableBody, TableHead, TableHeader, Table } from "@erp/ui";

interface LineDraft {
  key: number;
  productId: string;
  qtyOrdered: string;
  uom: string;
  unitPrice: string;
  taxCode: string;
}

export function PurchaseOrderForm({ data }: { data: PurchaseOrderFormData }) {
  const t = useTranslations('purchasing');
  const tc = useTranslations('common');
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [state, action, pending] = useActionState(createPurchaseOrderAction, { success: false });
  const [lines, setLines] = useState<LineDraft[]>([
    { key: 0, productId: '', qtyOrdered: '', uom: '', unitPrice: '', taxCode: '' },
  ]);

  const productById = useMemo(
    () => new Map(data.products.map((product) => [product.id, product])),
    [data.products],
  );

  function addLine() {
    setLines((current) => [
      ...current,
      { key: Date.now(), productId: '', qtyOrdered: '', uom: '', unitPrice: '', taxCode: '' },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  }

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = productById.get(patch.productId);
          next.uom = product?.uom ?? next.uom;
          next.unitPrice = product?.defaultCostPrice ?? next.unitPrice;
        }
        return next;
      }),
    );
  }

  const grandTotal = lines.reduce((sum, line) => {
    const qty = Number.parseFloat(line.qtyOrdered || '0');
    const price = Number.parseInt(line.unitPrice || '0', 10);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  return (
    <form
      action={action}
      className="space-y-6 rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
    >
      <input type="hidden" name="lineCount" value={lines.length} />

      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/10 px-4 py-3 text-sm text-brand-jade">
          {t('poSaved')}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('supplierTitle')}</span>
          <Select name="supplierId" required>
            <option value="">{t('selectSupplier')}</option>
            {data.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} {supplier.isPkp ? '(PKP)' : ''}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{tc('labels.location')}</span>
          <Select name="locationId" required>
            <option value="">{t('selectLocation')}</option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('orderDate')}</span>
          <Input name="orderDate" type="date" required defaultValue={today} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{t('expectedDate')}</span>
          <Input name="expectedDate" type="date" />
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">{t('items')}</h2>
            <p className="text-sm text-brand-ink-3">{t('itemsHint')}</p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('addLine')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="px-4 py-3">{tc('labels.product')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{tc('labels.qty')}</TableHead>
                <TableHead className="px-4 py-3">{tc('labels.uom')}</TableHead>
                <TableHead className="px-4 py-3 text-right">{tc('labels.price')}</TableHead>
                <TableHead className="px-4 py-3">{tc('labels.tax')}</TableHead>
                <TableHead className="px-4 py-3" />
              </tr>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <TableCell className="min-w-72 px-4 py-3">
                    <Select
                      name={`productId-${index}`}
                      required
                      value={line.productId}
                      onChange={(event) => updateLine(line.key, { productId: event.target.value })}
                     
                    >
                      <option value="">{t('selectProduct')}</option>
                      {data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Input
                      name={`qtyOrdered-${index}`}
                      required
                      inputMode="decimal"
                      value={line.qtyOrdered}
                      onChange={(event) => updateLine(line.key, { qtyOrdered: event.target.value })}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Input
                      name={`uom-${index}`}
                      required
                      value={line.uom}
                      onChange={(event) => updateLine(line.key, { uom: event.target.value })}
                     
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Input
                      name={`unitPrice-${index}`}
                      required
                      inputMode="numeric"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Select
                      name={`taxCode-${index}`}
                      value={line.taxCode}
                      onChange={(event) => updateLine(line.key, { taxCode: event.target.value })}
                     
                    >
                      <option value="">{t('noTax')}</option>
                      {data.taxRates.map((rate) => (
                        <option key={rate.code} value={rate.code}>
                          {rate.code} — {rate.name}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-40"
                      disabled={lines.length === 1}
                    >
                      {t('deleteItem')}
                    </button>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">{tc('labels.notes')}</span>
        <textarea name="notes" rows={3} />
      </label>

      <div className="flex flex-col gap-3 border-t border-brand-cream-3 pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-brand-muted">
          {t('estimatedSubtotal')}:{' '}
          <span className="font-semibold text-brand-ink">
            {new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
            }).format(grandTotal)}
          </span>
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={() => router.push('/purchasing')}
            className="rounded-lg " variant="secondary" size="md"
          >
            {tc('actions.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={pending || data.suppliers.length === 0 || data.products.length === 0}
            className="rounded-lg " variant="primary" size="lg"
          >
            {pending ? tc('actions.saving') : t('savePo')}
          </Button>
        </div>
      </div>
    </form>
  );
}
