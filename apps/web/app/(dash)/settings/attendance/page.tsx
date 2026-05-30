/**
 * Kebijakan Presensi — admins tune late/absent penalties without redeploying.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchAttendancePolicy } from './actions';
import { AttendancePolicyForm } from './attendance-policy-form';

export const metadata: Metadata = {
  title: 'Attendance Policy',
};

export default async function AttendancePolicyPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');

  const t = await getTranslations('settings.attendance');
  const allowed = await can(userId, 'settings.manage');
  if (!allowed) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {t('noAccess')}
      </div>
    );
  }

  const policy = await fetchAttendancePolicy();

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />
      <AttendancePolicyForm initial={policy} />
    </div>
  );
}
