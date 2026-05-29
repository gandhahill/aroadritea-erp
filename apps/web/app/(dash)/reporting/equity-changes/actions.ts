'use server';

import { getSession } from '@/lib/auth';
import { type EquityChangesResult, equityChanges } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';
import dayjs from 'dayjs';

export async function getEquityChangesAction(
  startDate: string,
  endDate: string,
  locationId: string,
): Promise<EquityChangesResult> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as any;

  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  // Prevent accessing future dates that break accounting equations
  const maxDate = dayjs().endOf('month').format('YYYY-MM-DD');
  const safeEndDate = endDate > maxDate ? maxDate : endDate;

  const res = await equityChanges(
    {
      startDate,
      endDate: safeEndDate,
      locationId: locationId === 'all' ? undefined : locationId,
    },
    ctx,
  );

  if (!res.ok) throw new Error(res.error.message);
  return res.value;
}
