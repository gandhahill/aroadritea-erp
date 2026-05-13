/**
 * Scheduled Jobs Settings Page — SD §21.10, §35.1.4
 * View and manage DB-driven cron schedules.
 * Worker syncs from this table every 60 seconds — no redeploy needed.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchScheduledJobs } from './actions';
import { ScheduledJobsTable } from './jobs-table';

export const metadata: Metadata = {
  title: 'Scheduled Jobs — Settings',
};

export default async function ScheduledJobsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = ((session.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  const jobs = await fetchScheduledJobs(tenantId);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Scheduled Jobs</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Manage background task schedules. Changes apply within 60 seconds — no restart needed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {jobs.filter((j) => j.enabled).length} active
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream-2 px-3 py-1 text-xs font-medium text-brand-ink-3">
            {jobs.length} total
          </span>
        </div>
      </div>

      {/* Info banner */}
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
            <p className="text-sm font-medium text-brand-ink">How it works</p>
            <p className="mt-0.5 text-xs text-brand-ink-2">
              The worker process polls this table every 60 seconds using pg-boss. Toggle a job or
              change its cron schedule here — it takes effect automatically. Cron format:{' '}
              <code className="rounded bg-brand-cream-2 px-1 py-0.5 text-[11px] font-mono">
                minute hour day month weekday
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <ScheduledJobsTable jobs={jobs} tenantId={tenantId} />
    </div>
  );
}
