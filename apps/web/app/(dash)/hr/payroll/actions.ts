'use server';

import { runPayroll } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';

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
