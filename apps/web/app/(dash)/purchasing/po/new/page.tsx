import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchPurchaseOrderFormData } from '../../actions';
import { PurchaseOrderForm } from './purchase-order-form';

export default async function NewPurchaseOrderPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'purchasing.po.create',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const [data, t] = await Promise.all([
    fetchPurchaseOrderFormData(),
    getTranslations('purchasing.po.new'),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6">
        <PageHeader
          title={<>{t('title')}</>}
          description={<>{t('subtitle')}</>}
          eyebrow={<>{t('eyebrow')}</>}
          actions={
            <>
              <Link
                href="/purchasing"
                className="inline-flex items-center justify-center rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
              >
                {t('back')}
              </Link>
            </>
          }
        />

        {data.suppliers.length === 0 ||
        data.products.length === 0 ||
        data.locations.length === 0 ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t('missingMasterData')}
          </div>
        ) : null}

        <PurchaseOrderForm data={data} />
      </section>
    </div>
  );
}
