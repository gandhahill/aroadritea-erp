/**
 * Loyalty config page — admins tune the loyalty program (earn rate, tier
 * thresholds) without editing source. SD §21.9, ADR-0010 spirit.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchLoyaltyConfig } from './actions';
import { LoyaltySettingsForm } from './loyalty-settings-form';

export const metadata: Metadata = {
  title: 'Pengaturan Loyalty',
};

export default async function LoyaltySettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');

  const allowed = await can(userId, 'settings.manage');
  if (!allowed) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Akun ini tidak memiliki akses untuk mengatur pengaturan sistem.
      </div>
    );
  }

  const config = await fetchLoyaltyConfig();
  const t = await getTranslations('settings.loyalty');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <LoyaltySettingsForm initial={config} />
    </div>
  );
}
