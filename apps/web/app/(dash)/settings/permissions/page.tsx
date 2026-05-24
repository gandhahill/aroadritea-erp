import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchPermissionMatrix } from './actions';
import { PermissionsMatrix } from './permissions-matrix';
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: 'Permissions - Aroadri ERP',
};

export default async function PermissionsPage() {
  const t = await getTranslations('settings.permissions');
  const tc = await getTranslations('common');
  const matrix = await fetchPermissionMatrix();

  return (
    <div className="space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('subtitle')}</>}
            eyebrow={<>{tc('nav.settings', { fallback: 'Pengaturan' })}</>}
          />
      <PermissionsMatrix matrix={matrix} />
    </div>
  );
}
