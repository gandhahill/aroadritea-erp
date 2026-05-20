/**
 * Scheduled jobs seed data — default cron jobs for Aroadri Tea ERP.
 * SD §35.1.4: schedules managed via DB, editable in Settings UI.
 * Times are stored as cron expressions in UTC.
 * UI renders labels via i18n keys (e.g., 'scheduledJobs.backup.label').
 */

import { generateId } from '@erp/shared/id';

export const SCHEDULED_JOBS_SEED = [
  {
    name: 'backup',
    label: 'scheduledJobs.backup.label',
    description: 'scheduledJobs.backup.description',
    cronExpression: '0 0 19 * * *', // 02:00 WIB = 19:00 UTC
    timezone: 'Asia/Jakarta',
    jobData: {},
    enabled: false,
  },
  {
    name: 'payroll-batch',
    label: 'scheduledJobs.payrollBatch.label',
    description: 'scheduledJobs.payrollBatch.description',
    cronExpression: '0 0 16 8 * *', // 8th monthly 23:00 WIB = 16:00 UTC
    timezone: 'Asia/Jakarta',
    jobData: {},
    enabled: false,
  },
  {
    name: 'stock-low-alert',
    label: 'scheduledJobs.stockLowAlert.label',
    description: 'scheduledJobs.stockLowAlert.description',
    cronExpression: '0 0 1 * * 1', // Monday 08:00 WIB = 01:00 UTC
    timezone: 'Asia/Jakarta',
    jobData: {},
    enabled: false,
  },
  {
    name: 'isr-revalidate',
    label: 'scheduledJobs.isrRevalidate.label',
    description: 'scheduledJobs.isrRevalidate.description',
    cronExpression: '0 0 21 * * *', // 04:00 WIB = 21:00 UTC
    timezone: 'Asia/Jakarta',
    jobData: {},
    enabled: false,
  },
  {
    name: 'party-ledger-reminders',
    label: 'scheduledJobs.partyLedgerReminders.label',
    description: 'scheduledJobs.partyLedgerReminders.description',
    cronExpression: '0 0 1 * * *', // daily 08:00 WIB = 01:00 UTC
    timezone: 'Asia/Jakarta',
    jobData: {},
    enabled: true,
  },
] as const;
