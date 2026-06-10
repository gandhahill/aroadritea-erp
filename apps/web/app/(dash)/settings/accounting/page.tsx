import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { hasGlobalPermission } from '@/lib/authz';
import { and, db, eq, isNull } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import {
  POSTING_ACCOUNT_DEFAULTS,
  POSTING_ACCOUNT_PURPOSES,
  getPostingAccountOverrides,
} from '@erp/services/accounting';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AccountMappingForm } from './client';

export const metadata: Metadata = { title: 'Account Mapping' };

type Locale = 'id' | 'en' | 'zh';

function pickName(name: unknown, locale: Locale): string {
  if (name && typeof name === 'object') {
    const n = name as Record<string, string>;
    return n[locale] ?? n.id ?? n.en ?? Object.values(n)[0] ?? '';
  }
  return typeof name === 'string' ? name : '';
}

export default async function AccountingSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const allowed = await hasGlobalPermission(userId, 'settings.manage');
  if (!allowed) redirect('/dashboard');

  const t = await getTranslations('settings.accounting');
  const locale = (await getLocale()) as Locale;

  // Active, postable accounts → selectable options (value = COA code).
  const activeAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    )
    .orderBy(accounts.code);

  const accountOptions = activeAccounts.map((a) => ({
    code: a.code,
    label: `${a.code} — ${pickName(a.name, locale)}`,
  }));
  const knownCodes = new Set(accountOptions.map((a) => a.code));

  // Effective current mapping = explicit override ?? default.
  const overrides = await getPostingAccountOverrides(tenantId);
  const current: Record<string, string> = {};
  for (const purpose of POSTING_ACCOUNT_PURPOSES) {
    current[purpose] = overrides[purpose] ?? POSTING_ACCOUNT_DEFAULTS[purpose];
  }

  // Back-compat: reflect the legacy id-based AP setting when there is no
  // explicit override, so saving the form doesn't silently revert AP.
  if (!overrides['purchasing.ap']) {
    const [legacy] = await db
      .select({ value: cmsSettings.value })
      .from(cmsSettings)
      .where(
        and(
          eq(cmsSettings.tenantId, tenantId),
          eq(cmsSettings.key, 'accounting.payables.accountIds'),
        ),
      )
      .limit(1);
    const legacyId =
      Array.isArray(legacy?.value) && typeof legacy.value[0] === 'string'
        ? (legacy.value[0] as string)
        : null;
    if (legacyId) {
      const [acct] = await db
        .select({ code: accounts.code })
        .from(accounts)
        .where(and(eq(accounts.tenantId, tenantId), eq(accounts.id, legacyId)))
        .limit(1);
      if (acct?.code) current['purchasing.ap'] = acct.code;
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <AccountMappingForm
        accounts={accountOptions}
        current={current}
        defaults={POSTING_ACCOUNT_DEFAULTS}
        missingCurrent={POSTING_ACCOUNT_PURPOSES.filter((p) => !knownCodes.has(current[p]!))}
      />
    </div>
  );
}
