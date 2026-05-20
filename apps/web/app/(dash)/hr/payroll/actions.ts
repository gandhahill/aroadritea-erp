'use server';

import { getSession } from '@/lib/auth';
import { approvePayroll, markPayrollPaid, runPayroll } from '@erp/services/payroll';
import type { ApprovePayrollInput, MarkPaidInput } from '@erp/services/payroll';
import type { AuditContext } from '@erp/shared/types';

/**
 * Resolve the active-session audit context. Previously runPayrollAction
 * hard-coded `userId: 'system'`, `tenantId: 'default'`, and the approve
 * / markPaid actions accepted `ctx` from the client — meaning the
 * browser could spoof any actor / tenant. Now every action derives ctx
 * server-side from the authenticated session.
 */
async function resolveCtx(locationId?: string): Promise<AuditContext> {
  const session = await getSession();
  const user = (session?.user ?? {}) as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: locationId ?? String(user.locationId ?? ''),
  };
}

export async function runPayrollAction(input: {
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  locationId: string;
  additionalEarnings?: Array<{
    employeeId: string;
    componentCode?: string;
    amount: string;
    notes?: string;
  }>;
}) {
  const ctx = await resolveCtx(input.locationId);
  return runPayroll(input, ctx);
}

export async function approvePayrollAction(input: ApprovePayrollInput) {
  const ctx = await resolveCtx();
  return approvePayroll(input, ctx);
}

export async function markPayrollPaidAction(input: MarkPaidInput) {
  const ctx = await resolveCtx();
  return markPayrollPaid(input, ctx);
}
