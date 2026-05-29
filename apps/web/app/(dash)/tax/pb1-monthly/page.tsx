import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';
import { db } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { eq } from '@erp/db';
import Pb1MonthlyClient from './client';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('tax.pb1Monthly');
  return {
    title: `${t('title')} - Aroadri Tea ERP`,
  };
}

export default async function Pb1MonthlyPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const perm = await requirePermission(userId, 'tax.view');
  if (!perm.ok) redirect('/');

  const t = await getTranslations('tax.pb1Monthly');

  // Get a default location for the client
  const [locRow] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.tenantId, tenantId))
    .limit(1);
    
  const defaultLocationId = locRow?.id ?? '';

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
      </div>
      <div className="hidden items-center space-x-2 md:flex">
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Pb1MonthlyClient initialLocationId={defaultLocationId} />
    </div>
  );
}
