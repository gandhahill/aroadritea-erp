'use server';

import { getSession } from '@/lib/auth';
import { type PosDraftKind, deletePosDraft, listPosDrafts, savePosDraft } from '@erp/services/pos';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

export interface PosDraftItem {
  id: string;
  title: string;
  locationId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function revalidateDraftPages() {
  revalidatePath('/pos/manual-sales');
  revalidatePath('/pos/manual-sales/consumed');
}

export async function fetchPosDraftsAction(kind: PosDraftKind): Promise<PosDraftItem[]> {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const result = await listPosDrafts(kind, ctx);
  if (!result.ok) return [];
  return result.value.map((draft) => ({
    id: draft.id,
    title: draft.title,
    locationId: draft.locationId,
    payload: draft.payload,
    updatedAt: draft.updatedAt,
  }));
}

export async function savePosDraftAction(input: {
  draftId: string | null;
  kind: PosDraftKind;
  locationId: string;
  title: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const result = await savePosDraft(
    {
      draftId: input.draftId ?? undefined,
      kind: input.kind,
      locationId: input.locationId,
      title: input.title,
      payload: input.payload,
    },
    ctx,
  );
  if (!result.ok) return { ok: false, error: errorMessage(result.error) };

  revalidateDraftPages();
  return { ok: true, id: result.value.id };
}

export async function deletePosDraftAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const result = await deletePosDraft(id, ctx);
  if (!result.ok) return { ok: false, error: errorMessage(result.error) };

  revalidateDraftPages();
  return { ok: true };
}
