import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { CompanySettingsForm } from './client';
import { fetchCompanySettings } from './actions';

export const metadata: Metadata = { title: 'Company Settings' };

export default async function CompanySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('settings.company');

  const defaults = await fetchCompanySettings();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <CompanySettingsForm defaults={defaults} />
    </div>
  );
}
