/**
 * Payroll batch job.
 *
 * Automatic payroll execution is disabled by default. Payroll should be run
 * from the HR Payroll UI/service until an explicit service-user policy exists.
 */

export interface PayrollJobData {
  periodId?: string;
  tenantId?: string;
  locationId?: string;
  dryRun?: boolean;
}

export async function payrollBatchHandler(data: PayrollJobData): Promise<void> {
  const { periodId, tenantId, locationId, dryRun } = data;
  console.info('[payroll] Starting payroll batch', { periodId, tenantId, locationId, dryRun });

  throw new Error(
    'Payroll batch job is not configured. Keep this scheduled job disabled and run payroll from the HR Payroll UI/service.',
  );
}
