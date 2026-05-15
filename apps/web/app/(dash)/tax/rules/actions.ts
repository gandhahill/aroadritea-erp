'use server';

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, taxRates, taxRules } from '@erp/db';
import { requirePermission } from '@erp/services/iam';

export interface TaxRuleRow {
  id: string;
  scopeKind: string;
  scopeId: string | null;
  taxCode: string;
  taxName: Record<string, string> | null;
  isAppliedDefault: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export async function fetchTaxRules(): Promise<TaxRuleRow[]> {
  const ctx = await getContext();
  if (!ctx) return [];
  const perm = await requirePermission(ctx.userId, 'tax.view');
  if (!perm.ok) return [];

  const rows = await db
    .select({
      id: taxRules.id,
      scopeKind: taxRules.scopeKind,
      scopeId: taxRules.scopeId,
      taxCode: taxRules.taxCode,
      taxName: taxRates.name,
      isAppliedDefault: taxRules.isAppliedDefault,
      priority: taxRules.priority,
      effectiveFrom: taxRules.effectiveFrom,
      effectiveUntil: taxRules.effectiveUntil,
    })
    .from(taxRules)
    .leftJoin(taxRates, eq(taxRules.taxCode, taxRates.code))
    .where(eq(taxRules.tenantId, ctx.tenantId))
    .orderBy(asc(taxRules.scopeKind), asc(taxRules.priority));

  return rows.map((row) => ({
    ...row,
    taxName: row.taxName as Record<string, string> | null,
  }));
}
