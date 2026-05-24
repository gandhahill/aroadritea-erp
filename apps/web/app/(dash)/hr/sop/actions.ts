/**
 * SOP Server Actions — User Req 2.
 *
 * AuditContext is resolved server-side on every action so a client
 * cannot spoof tenant / location / userId (B2-001 pattern).
 */

'use server';

import { getSession } from '@/lib/auth';
import {
  type ListSopInput,
  type SopRow,
  createSopDocument,
  deleteSopDocument,
  getSopDocument,
  listSopDocuments,
  updateSopDocument,
} from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

async function resolveCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  if (!userId || !tenantId) return null;
  return { userId, tenantId, locationId: String(user.locationId ?? '') };
}

export interface SopListResult {
  items: SopRow[];
  total: number;
  error?: string;
}

export async function fetchSopList(input: ListSopInput): Promise<SopListResult> {
  const ctx = await resolveCtx();
  if (!ctx) return { items: [], total: 0, error: 'unauthenticated' };

  const result = await listSopDocuments(input, ctx);
  if (!result.ok) {
    return { items: [], total: 0, error: result.error.messageKey };
  }
  return { items: result.value.items, total: result.value.total };
}

export async function fetchSopDetail(id: string): Promise<{ ok: boolean; row?: SopRow; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };

  const result = await getSopDocument(id, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  return { ok: true, row: result.value };
}

export async function createSopAction(input: {
  title: string;
  description?: string;
  category?: 'general' | 'operations' | 'hr' | 'finance' | 'safety' | 'service';
  locationId?: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  publish?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };

  const result = await createSopDocument(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  revalidatePath('/hr/sop');
  return { ok: true, id: result.value.id };
}

export async function updateSopAction(input: {
  id: string;
  title?: string;
  description?: string | null;
  category?: 'general' | 'operations' | 'hr' | 'finance' | 'safety' | 'service';
  locationId?: string | null;
  status?: 'draft' | 'published' | 'archived';
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };

  const result = await updateSopDocument(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  revalidatePath('/hr/sop');
  revalidatePath(`/hr/sop/${input.id}`);
  return { ok: true };
}

export async function deleteSopAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await resolveCtx();
  if (!ctx) return { ok: false, error: 'unauthenticated' };

  const result = await deleteSopDocument(id, ctx);
  if (!result.ok) return { ok: false, error: result.error.messageKey };
  revalidatePath('/hr/sop');
  return { ok: true };
}
