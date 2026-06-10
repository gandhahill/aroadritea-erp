'use server';

import { getSession } from '@/lib/auth';
import { listApiTokens, mintApiToken, revokeApiToken } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

function auditCtx(session: { user?: Record<string, unknown> | null }): AuditContext {
  const user = (session.user ?? {}) as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };
}

export async function fetchMcpTokens() {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthorized');
  return listApiTokens(String(session.user.id));
}

export async function createMcpTokenAction(
  name: string,
  expiresAt?: string,
): Promise<{ ok: true; token: string; id: string } | { ok: false; error: string }> {
  const t = await getTranslations('settings.mcpTokens.errors');
  const session = await getSession();
  if (!session?.user) return { ok: false, error: t('unauthorized') };

  const res = await mintApiToken(
    { name, expiresAt: expiresAt || undefined },
    auditCtx(session as { user?: Record<string, unknown> }),
  );
  if (!res.ok) return { ok: false, error: t('mintFailed') };

  revalidatePath('/settings/mcp-tokens');
  return { ok: true, token: res.value.token, id: res.value.id };
}

export async function revokeMcpTokenAction(
  tokenId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getTranslations('settings.mcpTokens.errors');
  const session = await getSession();
  if (!session?.user) return { ok: false, error: t('unauthorized') };

  const res = await revokeApiToken(
    tokenId,
    auditCtx(session as { user?: Record<string, unknown> }),
  );
  if (!res.ok) return { ok: false, error: t('revokeFailed') };

  revalidatePath('/settings/mcp-tokens');
  return { ok: true };
}
