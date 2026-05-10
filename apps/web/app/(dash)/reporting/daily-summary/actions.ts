/**
 * reporting.daily-summary — Server Actions (SD §25.5.2)
 *
 * Wraps the reporting/daily-summary service for the Next.js layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getDailySummary,
  type DailySummaryParams,
  type DailySummaryResult,
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

export async function fetchDailySummary(params: {
  locationId: string;
  startDate: string;
  endDate: string;
  cashierId?: string;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const result = await getDailySummary(params, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}
