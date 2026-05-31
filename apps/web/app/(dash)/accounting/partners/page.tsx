import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchPartnersAction } from './actions';
import { PartnersClient } from './partners-client';

export const metadata: Metadata = { title: 'Partners' };

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');

  const perm = await requirePermission(userId, 'accounting.view');
  if (!perm.ok) redirect('/dashboard');

  const params = await searchParams;
  const kindFilter = params.kind || 'all';
  const t = await getTranslations('accounting.partners');

  // Fetch all partners (client-side will filter by tab)
  const data = await fetchPartnersAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-2">
            {t('count', { count: data.length })}
          </span>
        }
      />
      <PartnersClient initialData={data} initialKind={kindFilter} />
    </div>
  );
}
