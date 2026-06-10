import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchPurchasingDashboard } from './actions';
import { PoFilterTable } from './po-filter-table';
import { SupplierManagement } from './supplier-management';

export default async function PurchasingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'purchasing.view',
    String(user.tenantId ?? 'default'),
  );
  if (!scope.global && scope.locationIds.length === 0) redirect('/dashboard');

  const [data, t] = await Promise.all([fetchPurchasingDashboard(), getTranslations('purchasing')]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-6">
        <PageHeader
          title={<>{t('dashboardTitle')}</>}
          description={<>{t('dashboardSubtitle')}</>}
          eyebrow={<>{t('eyebrow')}</>}
          actions={
            <>
              <Link
                href="/purchasing/po/new"
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark"
              >
                {t('newPo')}
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {t('supplierTitle')}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">{data.suppliers.length}</p>
          </div>
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {t('purchaseOrder')}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {data.purchaseOrders.length}
            </p>
          </div>
          <div className="rounded-lg border border-brand-cream-3 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
              {t('draftSubmitted')}
            </p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {
                data.purchaseOrders.filter((po) => ['draft', 'submitted'].includes(po.status))
                  .length
              }
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-brand-cream-3 bg-card shadow-sm">
            <div className="border-b border-brand-cream-3 px-5 py-4">
              <h2 className="text-base font-semibold text-brand-ink">{t('purchaseOrder')}</h2>
            </div>
            <PoFilterTable purchaseOrders={data.purchaseOrders} />
          </div>
        </div>

        {/* Supplier Management Section */}
        <SupplierManagement suppliers={data.suppliers} />
      </section>
    </div>
  );
}
