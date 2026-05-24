/**
 * Scheduled Jobs Settings Page - SD §21.10, §35.1.4.
 * View and manage DB-driven cron schedules.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchScheduledJobs } from './actions';
import { ScheduledJobsTable } from './jobs-table';
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: 'Scheduled Jobs - Settings',
};

export default async function ScheduledJobsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const t = await getTranslations('scheduledJobs');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const jobs = await fetchScheduledJobs(tenantId);

  return (
    <div className="space-y-6">
      <PageHeader 
            title={<>{t('title')}</>}
            description={<>{t('copy.subtitle')}</>}
            actions={<>
          <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
                      {t('copy.activeCount', { count: jobs.filter((j) => j.enabled).length })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-3">
                      {t('copy.totalCount', { count: jobs.length })}
                    </span>
                  </div>
            </>}
          />

      <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-brand-ink">{t('copy.howItWorksTitle')}</p>
            <p className="mt-0.5 text-xs text-brand-ink-2">
              {t('copy.howItWorksBody')}{' '}
              <code className="rounded bg-brand-cream-2 px-1 py-0.5 font-mono text-[11px]">
                {t('copy.cronExample')}
              </code>
            </p>
          </div>
        </div>
      </div>

      <ScheduledJobsTable jobs={jobs} tenantId={tenantId} />
    </div>
  );
}
