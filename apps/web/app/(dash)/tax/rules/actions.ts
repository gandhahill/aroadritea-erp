'use server';

import { getSession } from '@/lib/auth';
import { and, asc, auditLog, db, eq, isNull, taxRates, taxRules } from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

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

export interface TaxRuleOption {
  code: string;
  label: string;
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
    .where(and(eq(taxRules.tenantId, ctx.tenantId), isNull(taxRules.deletedAt)))
    .orderBy(asc(taxRules.scopeKind), asc(taxRules.priority));

  return rows.map((row) => ({
    ...row,
    taxName: row.taxName as Record<string, string> | null,
  }));
}

export async function fetchTaxRuleOptions(): Promise<TaxRuleOption[]> {
  const ctx = await getContext();
  if (!ctx) return [];
  const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
  if (!perm.ok) return [];

  const rows = await db
    .select({ code: taxRates.code, name: taxRates.name })
    .from(taxRates)
    .where(and(eq(taxRates.isActive, true), isNull(taxRates.deletedAt)))
    .orderBy(asc(taxRates.code));

  return rows.map((row) => {
    const name = row.name as Record<string, string>;
    return { code: row.code, label: `${row.code} - ${name.id ?? name.en ?? row.code}` };
  });
}

export async function saveTaxRuleAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
  if (!perm.ok) return;

  const id = String(formData.get('id') ?? '').trim();
  const scopeKind = String(formData.get('scopeKind') ?? '').trim() || 'global_default';
  const scopeIdRaw = String(formData.get('scopeId') ?? '').trim();
  const taxCode = String(formData.get('taxCode') ?? '').trim();
  const priority = Number.parseInt(String(formData.get('priority') ?? '10'), 10);
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const effectiveUntilRaw = String(formData.get('effectiveUntil') ?? '').trim();
  if (!taxCode) return;

  const values = {
    scopeKind,
    scopeId: scopeKind === 'global_default' ? null : scopeIdRaw || null,
    taxCode,
    isAppliedDefault: formData.get('isAppliedDefault') === 'on',
    priority: Number.isFinite(priority) ? priority : 10,
    effectiveFrom,
    effectiveUntil: effectiveUntilRaw || null,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (id) {
    const [before] = await db
      .select()
      .from(taxRules)
      .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, id)))
      .limit(1);
    if (!before) return;
    await db
      .update(taxRules)
      .set(values)
      .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, id)));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'tax_rule',
      entityId: id,
      before: before as never,
      after: values as never,
    });
  } else {
    const newId = generateId();
    await db.insert(taxRules).values({
      id: newId,
      tenantId: ctx.tenantId,
      ...values,
      createdBy: ctx.userId,
    });
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'tax_rule',
      entityId: newId,
      before: null,
      after: values as never,
    });
  }
  revalidatePath('/tax/rules');
}

export async function deleteTaxRuleAction(formData: FormData) {
  const ctx = await getContext();
  if (!ctx) return;
  const perm = await requirePermission(ctx.userId, 'tax.manage_rates');
  if (!perm.ok) return;

  const id = String(formData.get('id') ?? '').trim();
  const [before] = await db
    .select()
    .from(taxRules)
    .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, id)))
    .limit(1);
  if (!before) return;
  const deletedAt = new Date();
  await db
    .update(taxRules)
    .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
    .where(and(eq(taxRules.tenantId, ctx.tenantId), eq(taxRules.id, id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'tax_rule',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString() } as never,
  });
  revalidatePath('/tax/rules');
}
