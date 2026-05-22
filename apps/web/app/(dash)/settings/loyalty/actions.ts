'use server';

import { getSession } from '@/lib/auth';
import { setSetting } from '@erp/services/cms';
import {
  DEFAULT_LOYALTY_CONFIG,
  LOYALTY_SETTING_KEY,
  type LoyaltyConfig,
  getLoyaltyConfig,
} from '@erp/services/crm';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

type ActionState = { ok: boolean; message?: string };

async function buildCtx(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchLoyaltyConfig(): Promise<LoyaltyConfig> {
  const session = await getSession();
  const tenantId =
    ((session?.user as Record<string, unknown> | undefined)?.tenantId as string) ?? 'default';
  return getLoyaltyConfig(tenantId);
}

export async function saveLoyaltyConfig(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, message: 'settings.loyalty.unauthorized' };
  const perm = await requirePermission(ctx.userId, 'settings.manage');
  if (!perm.ok) return { ok: false, message: 'settings.loyalty.forbidden' };

  const rupiahPerPoint = Number(formData.get('rupiahPerPoint') ?? 0);
  const tierCodesRaw = formData.getAll('tierCode').map((v) => String(v));
  const tierPointsRaw = formData.getAll('tierPoints').map((v) => Number(v));

  if (!Number.isFinite(rupiahPerPoint) || rupiahPerPoint <= 0) {
    return { ok: false, message: 'settings.loyalty.invalidRate' };
  }

  const tiers = tierCodesRaw
    .map((code, idx) => ({
      code: code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, ''),
      minLifetimePoints: tierPointsRaw[idx] ?? -1,
    }))
    .filter(
      (t) => t.code.length > 0 && Number.isFinite(t.minLifetimePoints) && t.minLifetimePoints >= 0,
    )
    .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);

  if (tiers.length === 0) {
    return { ok: false, message: 'settings.loyalty.invalidTiers' };
  }
  if ((tiers[0]?.minLifetimePoints ?? 1) > 0) {
    return { ok: false, message: 'settings.loyalty.firstTierMustBeZero' };
  }

  const config: LoyaltyConfig = { rupiahPerPoint, tiers };

  const result = await setSetting(ctx.tenantId, LOYALTY_SETTING_KEY, config, ctx);
  if (!result.ok) return { ok: false, message: 'settings.loyalty.saveFailed' };

  revalidatePath('/settings/loyalty');
  return { ok: true, message: 'settings.loyalty.saved' };
}

export async function resetLoyaltyConfig(): Promise<ActionState> {
  const ctx = await buildCtx();
  if (!ctx) return { ok: false, message: 'settings.loyalty.unauthorized' };
  const perm = await requirePermission(ctx.userId, 'settings.manage');
  if (!perm.ok) return { ok: false, message: 'settings.loyalty.forbidden' };

  const result = await setSetting(ctx.tenantId, LOYALTY_SETTING_KEY, DEFAULT_LOYALTY_CONFIG, ctx);
  if (!result.ok) return { ok: false, message: 'settings.loyalty.saveFailed' };

  revalidatePath('/settings/loyalty');
  return { ok: true, message: 'settings.loyalty.reset' };
}
