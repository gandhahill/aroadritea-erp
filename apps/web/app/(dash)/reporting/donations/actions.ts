'use server';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getDonationReport,
  type DonationReportParams,
} from '@erp/services/reporting';
import { type AuditContext } from '@erp/shared/types';

function buildCtx(session: Awaited<ReturnType<typeof getSession>>): AuditContext {
  const user = session?.user as Record<string, unknown> | null;
  return {
    userId: (user?.id as string) ?? 'unknown',
    tenantId: (user?.tenantId as string) ?? 'default',
    locationId: (user?.locationId as string) ?? '',
  };
}

export async function fetchDonationReport(params: DonationReportParams) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const result = await getDonationReport(params, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}
