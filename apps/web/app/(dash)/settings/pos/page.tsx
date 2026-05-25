import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchAccountOptions, fetchPosSettings } from './actions';
import { PosSettingsClient } from './pos-settings-client';

export const metadata: Metadata = {
  title: 'POS Settings - Settings',
};

export default async function PosSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [settings, accountOptions, t] = await Promise.all([
    fetchPosSettings(),
    fetchAccountOptions(),
    getTranslations('settings.pos'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <PosSettingsClient settings={settings} accountOptions={accountOptions} />
    </div>
  );
}
