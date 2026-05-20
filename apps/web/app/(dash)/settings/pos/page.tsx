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
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <PosSettingsClient settings={settings} accountOptions={accountOptions} />
    </div>
  );
}
