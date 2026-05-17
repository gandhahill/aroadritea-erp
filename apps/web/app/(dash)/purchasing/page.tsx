import Link from 'next/link';
import { fetchPurchasingDashboard } from './actions';
import { PoFilterTable } from './po-filter-table';
import { SupplierForm } from './supplier-form';

export default async function PurchasingPage() {
  const data = await fetchPurchasingDashboard();

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
              Purchasing
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-brand-ink">
              Pembelian & supplier
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Kelola supplier dan purchase order dari ERP. Alur penerimaan barang tetap memakai
              service GRN sehingga stok dan jurnal dapat dilacak.
            </p>
          </div>
          <Link
            href="/purchasing/po/new"
            className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
          >
            + Purchase Order
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              Supplier
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">{data.suppliers.length}</p>
          </div>
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              Purchase Order
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {data.purchaseOrders.length}
            </p>
          </div>
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              Draft/Submitted
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {
                data.purchaseOrders.filter((po) => ['draft', 'submitted'].includes(po.status))
                  .length
              }
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              <div className="border-b border-brand-cream-3 px-5 py-4">
                <h2 className="text-base font-semibold text-brand-ink">Purchase Order</h2>
              </div>
              <PoFilterTable purchaseOrders={data.purchaseOrders} />
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
              <div className="border-b border-brand-cream-3 px-5 py-4">
                <h2 className="text-base font-semibold text-brand-ink">Supplier</h2>
              </div>
              <div className="divide-y divide-brand-cream-3">
                {data.suppliers.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-brand-ink-3">
                    Belum ada supplier.
                  </p>
                ) : (
                  data.suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div>
                        <p className="font-semibold text-brand-ink">{supplier.name}</p>
                        <p className="mt-0.5 text-xs text-brand-ink-3">
                          {[supplier.phone, supplier.email].filter(Boolean).join(' · ') ||
                            'Kontak belum diisi'}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-cream-1 px-2.5 py-1 text-xs font-semibold text-brand-muted">
                        {supplier.isPkp ? 'PKP' : 'Non-PKP'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <SupplierForm />
        </div>
      </section>
    </main>
  );
}
