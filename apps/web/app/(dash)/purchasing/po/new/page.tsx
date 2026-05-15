import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { fetchPurchaseOrderFormData } from '../../actions';
import { PurchaseOrderForm } from './purchase-order-form';

export default async function NewPurchaseOrderPage() {
  const [data, t] = await Promise.all([
    fetchPurchaseOrderFormData(),
    getTranslations('purchasing.po.new'),
  ]);

  return (
    <main className="min-h-screen bg-brand-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-brand-ink">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">{t('subtitle')}</p>
          </div>
          <Link
            href="/purchasing"
            className="inline-flex items-center justify-center rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
          >
            {t('back')}
          </Link>
        </div>

        {data.suppliers.length === 0 ||
        data.products.length === 0 ||
        data.locations.length === 0 ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t('missingMasterData')}
          </div>
        ) : null}

        <PurchaseOrderForm data={data} />
      </section>
    </main>
  );
}
