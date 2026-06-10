import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchKasbonPage } from './actions';
import { KasbonClient } from './kasbon-client';

export const metadata: Metadata = { title: 'Kasbon' };

export default async function KasbonPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; employeeId?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const result = await fetchKasbonPage(params.status, params.employeeId, page);
  if (!result) redirect('/dashboard');

  const t = await getTranslations('hr.kasbon');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <KasbonClient data={result.data} employees={result.employees} searchParams={params} />
    </div>
  );
}
