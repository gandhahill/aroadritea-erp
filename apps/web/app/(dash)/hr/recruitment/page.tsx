/**
 * Recruitment (HR > Rekrutmen) — manage job openings and the applicant
 * pipeline. Best-practice basic flow: lowongan → kandidat → screening →
 * interview → offer → hired (atau ditolak / mengundurkan diri).
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchApplicants, fetchOpenings } from './actions';
import { RecruitmentClient } from './recruitment-client';

export const metadata: Metadata = { title: 'Rekrutmen' };

export default async function RecruitmentPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>)?.id ?? '');
  const allowed = await can(userId, 'hr.view');
  if (!allowed) redirect('/dashboard');

  const [openings, applicants] = await Promise.all([fetchOpenings(), fetchApplicants()]);
  const canManage = await can(userId, 'hr.employee.write');

  const t = await getTranslations('hr.recruitment');

  return (
    <div className="space-y-6">
      <PageHeader title={<>{t('title')}</>} description={<>{t('subtitle')}</>} />

      <RecruitmentClient
        initialOpenings={openings}
        initialApplicants={applicants}
        canManage={canManage}
      />
    </div>
  );
}
