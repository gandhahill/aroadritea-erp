/**
 * inventory.variance — Server Actions (SD §25.9.4)
 *
 * Wraps inventory/variance-service for the Next.js layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  type VarianceReportParams,
  type VarianceReportResult,
  getVarianceReport,
} from '@erp/services/inventory';
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

export async function fetchVarianceReport(params: {
  locationId?: string;
  startDate: string;
  endDate: string;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const ctx = buildCtx(session);
  const result = await getVarianceReport(params, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}
