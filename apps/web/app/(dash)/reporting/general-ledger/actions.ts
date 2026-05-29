'use server';

import { getSession } from '@/lib/auth';
import { type GeneralLedgerResult, getGeneralLedger } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';

export async function fetchGeneralLedgerAction(
  accountId: string,
  startDate: string,
  endDate: string,
  locationId?: string,
): Promise<GeneralLedgerResult> {
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

  const res = await getGeneralLedger(
    {
      accountId,
      startDate,
      endDate,
      locationId: locationId === 'all' ? undefined : locationId,
    },
    ctx,
  );

  if (!res.ok) throw new Error(res.error.message);
  return res.value;
}
