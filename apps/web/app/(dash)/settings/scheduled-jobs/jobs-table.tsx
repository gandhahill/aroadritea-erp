/**
 * Scheduled Jobs Table - interactive client component.
 * Toggle enable/disable and edit cron expressions inline.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toggleScheduledJob, updateJobSchedule } from './actions';
import type { ScheduledJobItem } from './actions';

interface Props {
  jobs: ScheduledJobItem[];
  tenantId: string;
}

type TranslationFn = ReturnType<typeof useTranslations>;

function formatDate(d: Date | null): string {
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(d));
}

function resolveMessage(raw: string | null | undefined, t: TranslationFn): string {
  if (!raw) return '';
  if (!raw.startsWith('scheduledJobs.')) return raw;
  return t(raw.replace('scheduledJobs.', ''));
}

function StatusBadge({ status, t }: { status: string | null; t: TranslationFn }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full bg-brand-cream-2 px-2 py-0.5 text-[11px] font-medium text-brand-ink-3">
        {t('status.neverRun')}
      </span>
    );
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-jade-light px-2 py-0.5 text-[11px] font-medium text-brand-jade">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-jade" />
        {t('status.success')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 px-2 py-0.5 text-[11px] font-medium text-brand-red">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
      {t('status.failed')}
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:ring-offset-2 focus:ring-offset-brand-cream disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? 'bg-brand-jade' : 'bg-brand-ink-3/30'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-card shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function CronEditor({
  jobId,
  cronExpression,
  onSave,
  labels,
}: {
  jobId: string;
  cronExpression: string;
  onSave: (jobId: string, cron: string) => Promise<void>;
  labels: { edit: string; save: string; cancel: string; saving: string };
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cronExpression);
  const [saving, startSave] = useTransition();

  const handleSave = () => {
    startSave(async () => {
      await onSave(jobId, value);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 rounded bg-brand-cream-2 px-2 py-1 font-mono text-xs text-brand-ink-2 transition-colors hover:bg-brand-cream-3"
        title={labels.edit}
      >
        {cronExpression}
        <svg
          aria-hidden="true"
          className="h-3 w-3 text-brand-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-36 rounded border border-brand-cream-3 bg-card px-2 py-1 font-mono text-xs text-brand-ink focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red/30"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setEditing(false);
            setValue(cronExpression);
          }
        }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || value === cronExpression}
        className="rounded bg-brand-jade px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-brand-jade/80 disabled:opacity-50"
      >
        {saving ? labels.saving : labels.save}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(cronExpression);
        }}
        className="rounded px-2 py-1 text-[11px] font-medium text-brand-ink-3 transition-colors hover:bg-brand-cream-2"
      >
        {labels.cancel}
      </button>
    </div>
  );
}

export function ScheduledJobsTable({ jobs: initialJobs, tenantId }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('scheduledJobs');

  const handleToggle = (jobId: string, currentEnabled: boolean) => {
    setError(null);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, enabled: !currentEnabled } : j)));

    startTransition(async () => {
      const result = await toggleScheduledJob(tenantId, jobId, !currentEnabled);
      if (!result.success) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, enabled: currentEnabled } : j)),
        );
        setError(result.error ?? t('errors.toggleFailed'));
      }
    });
  };

  const handleCronSave = async (jobId: string, cron: string) => {
    setError(null);
    const result = await updateJobSchedule(tenantId, jobId, cron);
    if (!result.success) {
      setError(result.error ?? t('errors.scheduleFailed'));
    } else {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, cronExpression: cron } : j)));
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-brand-cream-3 bg-card px-6 py-12 text-center">
        <svg
          aria-hidden="true"
          className="mx-auto h-10 w-10 text-brand-ink-3/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <p className="mt-3 text-sm font-medium text-brand-ink-2">{t('empty.title')}</p>
        <p className="mt-1 text-xs text-brand-ink-3">{t('empty.body')}</p>
      </div>
    );
  }

  const cronLabels = {
    edit: t('actions.editSchedule'),
    save: t('actions.save'),
    cancel: t('actions.cancel'),
    saving: t('actions.saving'),
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-brand-red/20 bg-brand-red/5 px-4 py-2.5 text-sm text-brand-red">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-brand-cream-3 bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-cream-3 bg-brand-cream-2/50">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-ink-3">
                {t('fields.enabled')}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-ink-3">
                {t('fields.name')}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-ink-3">
                {t('fields.cronExpression')}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-ink-3">
                {t('fields.lastRunAt')}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-ink-3">
                {t('fields.lastRunStatus')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-cream-3">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className={`transition-colors hover:bg-brand-cream-2/30 ${
                  !job.enabled ? 'opacity-60' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <ToggleSwitch
                    enabled={job.enabled}
                    onToggle={() => handleToggle(job.id, job.enabled)}
                    disabled={isPending}
                  />
                </td>

                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brand-ink">
                      {resolveMessage(job.label, t)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-ink-3">
                      <code className="rounded bg-brand-cream-2 px-1 py-0.5 font-mono">
                        {job.name}
                      </code>
                    </p>
                    {job.description && (
                      <p className="mt-1 text-xs text-brand-ink-3 line-clamp-1">
                        {resolveMessage(job.description, t)}
                      </p>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <CronEditor
                    jobId={job.id}
                    cronExpression={job.cronExpression}
                    onSave={handleCronSave}
                    labels={cronLabels}
                  />
                  <p className="mt-1 text-[10px] text-brand-ink-3">{job.timezone}</p>
                </td>

                <td className="px-4 py-3">
                  <p className="text-xs text-brand-ink-2">{formatDate(job.lastRunAt)}</p>
                </td>

                <td className="px-4 py-3">
                  <StatusBadge status={job.lastRunStatus} t={t} />
                  {job.lastRunStatus === 'failed' && job.lastRunError && (
                    <p
                      className="mt-1 max-w-[200px] truncate text-[10px] text-brand-red/70"
                      title={job.lastRunError}
                    >
                      {job.lastRunError}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
