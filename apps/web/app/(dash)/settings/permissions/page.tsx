import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { hasGlobalPermission } from '@/lib/authz';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchPermissionMatrix } from './actions';
import { PermissionsMatrix } from './permissions-matrix';

export const metadata: Metadata = {
  title: 'Permissions',
};

export default async function PermissionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const allowed = await hasGlobalPermission(String(user.id ?? ''), 'iam.manage_permissions');
  if (!allowed) redirect('/dashboard');

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
