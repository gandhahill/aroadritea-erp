/**
 * reporting.hourly-sales — Server Actions (SD §25.6.3)
 *
 * Wraps the reporting/hourly-sales service for the Next.js layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getHourlySales,
  type HourlySalesParams,
  type HourlySalesResult,
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

export async function fetchHourlySales(params: {
  locationId?: string;
  startDate: string;
  endDate: string;
  groupBy?: 'channel' | 'day';
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const serviceParams = {
    locationId: params.locationId ?? ctx.locationId,
    startDate: params.startDate,
    endDate: params.endDate,
    groupBy: params.groupBy,
  };
  const result = await getHourlySales(serviceParams, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}
