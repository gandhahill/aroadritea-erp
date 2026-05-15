import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchLocations } from './actions';
import { LocationsClient } from './locations-client';

export const metadata: Metadata = {
  title: 'Locations - Settings',
};

export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [locations, t] = await Promise.all([
    fetchLocations(),
    getTranslations('settings.locations'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <LocationsClient
        locations={locations}
        labels={{
          add: t('add'),
          save: t('save'),
          saving: t('saving'),
          code: t('code'),
          nameId: t('nameId'),
          nameEn: t('nameEn'),
          nameZh: t('nameZh'),
          type: t('type'),
          status: t('status'),
          timezone: t('timezone'),
          currency: t('currency'),
          address: t('address'),
          active: t('active'),
          inactive: t('inactive'),
          store: t('store'),
          office: t('office'),
          warehouse: t('warehouse'),
          saved: t('saved'),
          delete: t('delete'),
        }}
      />
    </div>
  );
}
