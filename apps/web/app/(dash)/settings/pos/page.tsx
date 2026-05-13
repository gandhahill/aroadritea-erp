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
          Atur posting akuntansi POS, channel delivery, dan ukuran struk lewat database/UI.
        </p>
      </div>

      <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <p className="text-sm font-medium text-brand-ink">Konfigurasi non-secret</p>
        <p className="mt-1 text-xs text-brand-ink-2">
          Nilai di halaman ini menggantikan konfigurasi POS lama berbasis environment variable.
          Secret dan URL deployment tetap berada di environment.
        </p>
      </div>

      <PosSettingsClient settings={settings} />
    </div>
  );
}
