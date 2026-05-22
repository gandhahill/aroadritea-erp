import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchPermissionMatrix } from './actions';
import { PermissionsMatrix } from './permissions-matrix';

export const metadata: Metadata = {
  title: 'Permissions - Aroadri ERP',
};

export default async function PermissionsPage() {
  const t = await getTranslations('settings.permissions');
  const matrix = await fetchPermissionMatrix();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
          Pengaturan
        </p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-ink-3">
          {t('subtitle')}
        </p>
      </div>
      <PermissionsMatrix matrix={matrix} />
    </div>
  );
}
