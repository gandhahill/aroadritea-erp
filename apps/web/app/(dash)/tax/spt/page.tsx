import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import SptMasaClient from './client';
import { fetchPeriodsAction } from './actions';

export const metadata = {
  title: 'SPT Masa PPN - Aroadri Tea ERP',
};

export default async function SptMasaPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');

  const perm = await requirePermission(userId, 'tax.view');
  if (!perm.ok) redirect('/');

  const t = await getTranslations('tax.spt');
  const periods = await fetchPeriodsAction();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
      </div>
      <div className="hidden items-center space-x-2 md:flex">
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SptMasaClient initialPeriods={periods} />
    </div>
  );
}
