import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchOvertimePage } from './actions';
import { OvertimeClient } from './overtime-client';

export const metadata: Metadata = { title: 'Overtime' };

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    employeeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
  const result = await fetchOvertimePage(
    params.status,
    params.employeeId,
    params.dateFrom,
    params.dateTo,
    page,
  );
  if (!result) redirect('/dashboard');

  const t = await getTranslations('hr.overtime');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <OvertimeClient data={result.data} employees={result.employees} searchParams={params} />
    </div>
  );
}
