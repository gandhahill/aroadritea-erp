/**
 * CRM members — Server Actions (T-0183).
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  type ListMembersFilter,
  type MemberDetail,
  type MemberSummary,
  adjustMemberPoints,
  getMemberDetail,
  listMembers,
} from '@erp/services/crm';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function buildCtx(): Promise<AuditContext> {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function listMembersAction(filter: ListMembersFilter): Promise<{
  items?: MemberSummary[];
  total?: number;
  error?: string;
}> {
  const ctx = await buildCtx();
  const result = await listMembers(filter, ctx);
  if (!result.ok) return { error: result.error.message };
  return { items: result.value.items, total: result.value.total };
}

export async function fetchMemberDetailAction(
  memberId: string,
): Promise<{ data?: MemberDetail; error?: string }> {
  const ctx = await buildCtx();
  const result = await getMemberDetail(memberId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function adjustMemberPointsAction(input: {
  memberId: string;
  delta: number;
  reason: string;
}): Promise<{ ok: boolean; balanceAfter?: number; error?: string }> {
  const ctx = await buildCtx();
  const result = await adjustMemberPoints(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath(`/crm/members/${input.memberId}`);
  revalidatePath('/crm/members');
  return { ok: true, balanceAfter: result.value.balanceAfter };
}
