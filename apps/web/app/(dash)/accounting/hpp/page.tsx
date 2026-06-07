import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { HppClient } from './hpp-client';

export const metadata: Metadata = { title: 'HPP Adjustment' };

export default async function HppPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const allowed = await can(userId, 'accounting.hpp.view');
  if (!allowed) redirect('/dashboard');
  const locale = (await getLocale()) as 'id' | 'en' | 'zh';
  const t = await getTranslations('accounting.hpp');

  const locations = await getActiveLocationOptions({ tenantId, locale });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <HppClient locations={locations.map((l) => ({ value: l.id, label: l.label }))} />
    </div>
  );
}
