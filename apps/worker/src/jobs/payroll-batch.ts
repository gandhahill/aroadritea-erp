/**
 * Payroll batch job — process monthly payroll.
 * SD §19.5, §21.8: PPh 21 TER, slip gaji digital, payroll date: 8th.
 * Runs on the 7th of each month at 23:00 WIB.
 */

export interface PayrollJobData {
  periodId: string;
  tenantId: string;
  locationId?: string;
  dryRun?: boolean;
}

export async function payrollBatchHandler(data: PayrollJobData): Promise<void> {
  const { periodId, tenantId, locationId, dryRun } = data;
  console.info(`[payroll] Starting payroll batch`, { periodId, tenantId, locationId, dryRun });

  try {
    // TODO (Phase 4 — T-0102, T-0103): implement payroll engine
    // 1. Fetch employees with active contracts for period
    // 2. Calculate PPh 21 using TER method
    // 3. Generate journal entries for salary expense + payable
    // 4. Generate digital payslip (PDF)
    // 5. Record audit log
    console.info('[payroll] Payroll batch completed (placeholder — Phase 4)', { periodId });
  } catch (err) {
    console.error('[payroll] Payroll batch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
