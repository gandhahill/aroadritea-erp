/**
 * reporting.daily-summary — Server Actions (SD §25.5.2)
 *
 * Wraps the reporting/daily-summary service for the Next.js layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  type DailySummaryParams,
  type DailySummaryResult,
  getDailySummary,
  previousPeriod,
} from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import { redirect } from 'next/navigation';

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

/**
 * Fetch the previous-period summary for the same length window
 * (e.g. May → April equivalent, or yesterday → day before yesterday).
 *
 * Returns null when there's no permission for the previous range or no
 * data exists yet — callers should treat this as "no baseline" rather
 * than an error, so the report still renders.
 */
export async function fetchDailySummaryPrevious(params: {
  locationId: string;
  startDate: string;
  endDate: string;
  cashierId?: string;
}): Promise<{
  previous: DailySummaryResult | null;
  prevRange: { from: string; to: string };
}> {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const prevRange = previousPeriod({ from: params.startDate, to: params.endDate });
  const result = await getDailySummary(
    {
      locationId: params.locationId,
      startDate: prevRange.from,
      endDate: prevRange.to,
      cashierId: params.cashierId,
    },
    ctx,
  );
  return { previous: result.ok ? result.value : null, prevRange };
}
