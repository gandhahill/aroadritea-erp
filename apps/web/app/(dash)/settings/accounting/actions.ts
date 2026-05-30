'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, inArray, isNull } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { auditRecord } from '@erp/services/audit';
import {
  ACCOUNT_MAP_SETTING_KEY,
  POSTING_ACCOUNT_PURPOSES,
} from '@erp/services/accounting';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

/**
 * Persist the posting-account mapping (purpose → COA code) to cms_settings.
 * Validates that every purpose is known and every chosen code is an active,
 * postable account in this tenant's chart of accounts.
 */
export async function saveAccountMapAction(
  input: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const t = await getTranslations('settings.accounting');
  const session = await getSession();
  if (!session) return { ok: false, error: t('errors.unauthorized') };

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const perm = await requirePermission(userId, 'settings.manage');
  if (!perm.ok) return { ok: false, error: t('errors.forbidden') };

  // Keep only known purposes with a non-empty code.
  const known = new Set<string>(POSTING_ACCOUNT_PURPOSES);
  const cleaned: Record<string, string> = {};
  for (const [purpose, code] of Object.entries(input)) {
    if (known.has(purpose) && typeof code === 'string' && code.trim()) {
      cleaned[purpose] = code.trim();
    }
  }

  // Every chosen code must be an active, postable account.
  const chosenCodes = [...new Set(Object.values(cleaned))];
  if (chosenCodes.length > 0) {
    const rows = await db
      .select({ code: accounts.code })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true),
          eq(accounts.isPostable, true),
          isNull(accounts.deletedAt),
          inArray(accounts.code, chosenCodes),
        ),
      );
    const valid = new Set(rows.map((r) => r.code));
    const invalid = chosenCodes.filter((c) => !valid.has(c));
    if (invalid.length > 0) {
      return { ok: false, error: t('errors.invalidAccount', { codes: invalid.join(', ') }) };
    }
  }

  const ctx: AuditContext = {
    userId,
    tenantId,
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const [existing] = await db
    .select({ id: cmsSettings.id, value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, ACCOUNT_MAP_SETTING_KEY)))
    .limit(1);

  if (existing) {
    await db.update(cmsSettings).set({ value: cleaned }).where(eq(cmsSettings.id, existing.id));
    await auditRecord({
      action: 'update',
      entityType: 'cms_settings',
      entityId: existing.id,
      before: { key: ACCOUNT_MAP_SETTING_KEY, value: existing.value },
      after: { key: ACCOUNT_MAP_SETTING_KEY, value: cleaned },
      ctx,
    });
  } else {
    const id = generateId();
    await db.insert(cmsSettings).values({ id, tenantId, key: ACCOUNT_MAP_SETTING_KEY, value: cleaned });
    await auditRecord({
      action: 'create',
      entityType: 'cms_settings',
      entityId: id,
      before: null,
      after: { key: ACCOUNT_MAP_SETTING_KEY, value: cleaned },
      ctx,
    });
  }

  revalidatePath('/settings/accounting');
  return { ok: true };
}
