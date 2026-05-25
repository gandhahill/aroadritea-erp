'use server';

import { getSession } from '@/lib/auth';
import { type CashFlowResult, cashFlow } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

/**
 * Wrapper that calls the long-standing `reporting.cashFlow` service.
 * Returns a serialisable shape (BigInts stringified) so it crosses
 * the Server Action boundary safely.
 */
export async function fetchCashFlow(input: {
  from: string;
  to: string;
  locationId?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  data?: {
    from: string;
    to: string;
    locationId: string | null;
    beginningCash: string;
    endingCash: string;
    netIncrease: string;
    isPreliminary: boolean;
    sections: Array<{
      label: string;
      kind: string;
      inflow: string;
      outflow: string;
      net: string;
      movements: Array<{
        postingDate: string;
        journalNumber: string;
        journalDescription: string;
        direction: 'inflow' | 'outflow';
        amount: string;
      }>;
    }>;
  };
}> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };
  const result = await cashFlow(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  const v = result.value;
  return {
    ok: true,
    data: {
      from: v.from,
      to: v.to,
      locationId: v.locationId,
      beginningCash: v.beginningCash.toString(),
      endingCash: v.endingCash.toString(),
      netIncrease: v.netIncrease.toString(),
      isPreliminary: v.isPreliminary,
      sections: ([v.operating, v.investing, v.financing] satisfies Array<typeof v.operating>).map(
        (s) => ({
          label: s.label,
          kind: s.kind,
          inflow: s.inflow.toString(),
          outflow: s.outflow.toString(),
          net: s.net.toString(),
          movements: s.movements.map((m) => ({
            postingDate: m.postingDate,
            journalNumber: m.journalNumber,
            journalDescription: m.journalDescription,
            direction: m.direction,
            amount: m.amount.toString(),
          })),
        }),
      ),
    },
  };
}
