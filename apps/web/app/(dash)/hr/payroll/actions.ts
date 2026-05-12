'use server';

import { runPayroll, approvePayroll, markPayrollPaid } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';
import type { ApprovePayrollInput, MarkPaidInput } from '@erp/services/payroll';

export async function runPayrollAction(input: {
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  locationId: string;
}) {
  const ctx: AuditContext = {
    userId: 'system',
    tenantId: 'default',
    locationId: input.locationId,
  };
  return runPayroll(input, ctx);
}

export async function approvePayrollAction(input: ApprovePayrollInput, ctx: AuditContext) {
  return approvePayroll(input, ctx);
}

export async function markPayrollPaidAction(input: MarkPaidInput, ctx: AuditContext) {
  return markPayrollPaid(input, ctx);
}
