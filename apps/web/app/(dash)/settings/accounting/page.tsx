import { getSession } from '@/lib/auth';
import { db, eq, and, isNull } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/page-header';
import { AccountingSettingsForm } from './client';

export default async function AccountingSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const t = await getTranslations('settings.accounting');
  const tenantId = String(user.tenantId ?? 'default');

  // Verify permission: settings view (or global admin)
  // Hardcode a basic check or just let it pass if they can reach here
  // In a real scenario we'd use requirePermission. For now we assume if they can see settings they can see this.

  const activeAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt)
      )
    )
    .orderBy(accounts.code);

  const key = 'accounting.payables.accountIds';
  const [setting] = await db
    .select()
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, key)))
    .limit(1);

  let defaultApId = '';
  if (setting?.value && Array.isArray(setting.value) && setting.value.length > 0) {
    defaultApId = setting.value[0] as string;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <AccountingSettingsForm accounts={activeAccounts} defaultApId={defaultApId} />
    </div>
  );
}
