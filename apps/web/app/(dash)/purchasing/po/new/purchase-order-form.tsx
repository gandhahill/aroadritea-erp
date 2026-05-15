'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useMemo, useState } from 'react';
import { type PurchaseOrderFormData, createPurchaseOrderAction } from '../../actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

interface LineDraft {
  key: number;
  productId: string;
  qtyOrdered: string;
  uom: string;
  unitPrice: string;
  taxCode: string;
}

export function PurchaseOrderForm({ data }: { data: PurchaseOrderFormData }) {
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
          Purchase order tersimpan.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Supplier</span>
          <select name="supplierId" required className={INPUT}>
            <option value="">Pilih supplier</option>
            {data.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} {supplier.isPkp ? '(PKP)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Lokasi</span>
          <select name="locationId" required className={INPUT}>
            <option value="">Pilih lokasi</option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Tanggal PO</span>
          <input name="orderDate" type="date" required defaultValue={today} className={INPUT} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Estimasi diterima</span>
          <input name="expectedDate" type="date" className={INPUT} />
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-ink">Barang</h2>
            <p className="text-sm text-brand-ink-3">
              Produk yang muncul di sini adalah produk dengan status purchasable.
            </p>
          </div>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg border border-brand-cream-3 bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            + Baris
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-cream-3 text-sm">
            <thead className="bg-brand-cream-1 text-left text-xs font-semibold uppercase tracking-wider text-brand-ink-3">
              <tr>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3">Pajak</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream-3 bg-white">
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td className="min-w-72 px-4 py-3">
                    <select
                      name={`productId-${index}`}
                      required
                      value={line.productId}
                      onChange={(event) => updateLine(line.key, { productId: event.target.value })}
                      className={INPUT}
                    >
                      <option value="">Pilih produk</option>
                      {data.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      name={`qtyOrdered-${index}`}
                      required
                      inputMode="decimal"
                      value={line.qtyOrdered}
                      onChange={(event) => updateLine(line.key, { qtyOrdered: event.target.value })}
                      className={`${INPUT} text-right`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      name={`uom-${index}`}
                      required
                      value={line.uom}
                      onChange={(event) => updateLine(line.key, { uom: event.target.value })}
                      className={INPUT}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      name={`unitPrice-${index}`}
                      required
                      inputMode="numeric"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                      className={`${INPUT} text-right`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      name={`taxCode-${index}`}
                      value={line.taxCode}
                      onChange={(event) => updateLine(line.key, { taxCode: event.target.value })}
                      className={INPUT}
                    >
                      <option value="">Tanpa pajak</option>
                      {data.taxRates.map((rate) => (
                        <option key={rate.code} value={rate.code}>
                          {rate.code} — {rate.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-40"
                      disabled={lines.length === 1}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-brand-ink">Catatan</span>
        <textarea name="notes" rows={3} className={INPUT} />
      </label>

      <div className="flex flex-col gap-3 border-t border-brand-cream-3 pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-brand-muted">
          Estimasi subtotal:{' '}
          <span className="font-semibold text-brand-ink">
            {new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
            }).format(grandTotal)}
          </span>
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/purchasing')}
            className="rounded-lg border border-brand-cream-3 bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending || data.suppliers.length === 0 || data.products.length === 0}
            className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
          >
            {pending ? 'Menyimpan...' : 'Simpan PO'}
          </button>
        </div>
      </div>
    </form>
  );
}
