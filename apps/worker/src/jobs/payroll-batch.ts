/**
 * Payroll batch job.
 *
 * Automatic payroll execution is disabled by default. Payroll should be run
 * from the HR Payroll UI/service until an explicit service-user policy exists.
 */

export interface PayrollJobData {
  periodCode?: string;
  periodStart?: string;
  periodEnd?: string;
  tenantId?: string;
  locationId?: string;
  dryRun?: boolean;
}

export async function payrollBatchHandler(data: PayrollJobData): Promise<void> {
  const { periodCode, periodStart, periodEnd, tenantId = 'default', locationId, dryRun } = data;
  console.info('[payroll] Starting payroll batch', {
    periodCode,
    periodStart,
    periodEnd,
    tenantId,
    locationId,
    dryRun,
  });

  if (!periodCode || !periodStart || !periodEnd || !locationId) {
    console.warn(
      '[payroll] Skipped because periodCode, periodStart, periodEnd, or locationId is missing.',
    );
    return;
  }

  const serviceUserId = process.env.PAYROLL_SERVICE_USER_ID;
  if (!serviceUserId) {
    console.warn('[payroll] Skipped because PAYROLL_SERVICE_USER_ID is not configured.');
    return;
  }

  if (dryRun === true) {
    console.info('[payroll] Dry run requested; no payroll rows will be created.');
    return;
  }

  const { runPayroll } = await import('@erp/services/payroll');
  const result = await runPayroll(
    {
      periodCode,
      periodStart,
      periodEnd,
      locationId,
    },
    {
      tenantId,
      userId: serviceUserId,
      locationId,
    },
  );

  if (!result.ok) {
    throw result.error;
  }

  console.info('[payroll] Payroll batch completed', {
    payrollId: result.value.payrollId,
    totalEmployees: result.value.totalEmployees,
  });
}
