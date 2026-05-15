import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchPosSettings } from './actions';
import { PosSettingsClient } from './pos-settings-client';

export const metadata: Metadata = {
  title: 'POS Settings — Settings',
};

export default async function PosSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const settings = await fetchPosSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">POS Settings</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Atur posting akuntansi POS, channel delivery, komisi platform, dan ukuran struk per
          outlet.
        </p>
      </div>

      <PosSettingsClient settings={settings} />
    </div>
  );
}
