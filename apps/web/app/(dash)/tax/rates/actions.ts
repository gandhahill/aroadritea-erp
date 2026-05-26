'use server';

import { getSession } from '@/lib/auth';
import { accounts, and, asc, auditLog, db, eq, isNull, taxRates } from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface TaxRateRow {
  id: string;
  code: string;
  name: Record<string, string>;
  ratePercent: number;
  calculation: string;
  postingAccountId: string;
  postingAccount: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface TaxAccountOption {
  id: string;
  label: string;
}

async function getContext(requiredPermission: 'tax.view' | 'tax.manage_global_rates') {
  const session = await getSession();
  if (!session?.user) return null;

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');
  const permission = await requirePermission(userId, requiredPermission);
  if (!permission.ok) return null;
  return { userId, tenantId };
}

export async function fetchTaxRates(locale: string): Promise<TaxRateRow[]> {
  const ctx = await getContext('tax.view');
  if (!ctx) return [];

  const rows = await db
    .select({
      id: taxRates.id,
      code: taxRates.code,
      name: taxRates.name,
      rateBps: taxRates.rateBps,
      calculation: taxRates.calculation,
      isActive: taxRates.isActive,
      effectiveFrom: taxRates.effectiveFrom,
      effectiveUntil: taxRates.effectiveUntil,
      postingAccountId: taxRates.postingAccountId,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(taxRates)
    .leftJoin(accounts, eq(taxRates.postingAccountId, accounts.id))
    .where(isNull(taxRates.deletedAt))
    .orderBy(asc(taxRates.code));

  return rows.map((row) => {
    const accountName = row.accountName as Record<string, string> | null;
    const postingAccount = row.accountCode
      ? `${row.accountCode} - ${accountName?.[locale] ?? accountName?.id ?? accountName?.en ?? row.accountCode}`
      : '-';

    return {
      id: row.id,
      code: row.code,
      name: row.name as Record<string, string>,
      ratePercent: row.rateBps / 100,
      calculation: row.calculation,
      postingAccountId: row.postingAccountId,
      postingAccount,
      isActive: row.isActive,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
    };
  });
}

export async function fetchTaxAccountOptions(locale: string): Promise<TaxAccountOption[]> {
  const ctx = await getContext('tax.manage_global_rates');
  if (!ctx) return [];

  const rows = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    )
    .orderBy(asc(accounts.code));

  return rows.map((row) => {
    const name = row.name as Record<string, string>;
    return { id: row.id, label: `${row.code} - ${name[locale] ?? name.id ?? name.en ?? row.code}` };
  });
}

export async function saveTaxRateAction(formData: FormData) {
  const ctx = await getContext('tax.manage_global_rates');
  if (!ctx) return;

  const id = String(formData.get('id') ?? '').trim();
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();
  const nameId = String(formData.get('nameId') ?? '').trim();
  const nameEn = String(formData.get('nameEn') ?? '').trim() || nameId;
  const nameZh = String(formData.get('nameZh') ?? '').trim() || nameEn || nameId;
  const ratePercent = Number(String(formData.get('ratePercent') ?? '0').replace(',', '.'));
  const postingAccountId = String(formData.get('postingAccountId') ?? '').trim();
  const calculation =
    String(formData.get('calculation') ?? '') === 'exclusive' ? 'exclusive' : 'inclusive';
  const effectiveFrom =
    String(formData.get('effectiveFrom') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const effectiveUntilRaw = String(formData.get('effectiveUntil') ?? '').trim();

  if (!code || !nameId || !postingAccountId || !Number.isFinite(ratePercent)) return;

  const [postingAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, postingAccountId),
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!postingAccount) return;

  const values = {
    code,
    name: { id: nameId, en: nameEn, zh: nameZh },
    rateBps: Math.round(ratePercent * 100),
    calculation,
    postingAccountId,
    isActive: formData.get('isActive') === 'on',
    effectiveFrom,
    effectiveUntil: effectiveUntilRaw || null,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  if (id) {
    const [before] = await db.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
    if (!before) return;
    await db.update(taxRates).set(values).where(eq(taxRates.id, id));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'tax_rate',
      entityId: id,
      before: before as never,
      after: values as never,
    });
  } else {
    const newId = generateId();
    await db.insert(taxRates).values({
      id: newId,
      ...values,
      createdBy: ctx.userId,
    });
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'tax_rate',
      entityId: newId,
      before: null,
      after: values as never,
    });
  }
  revalidatePath('/tax/rates');
}

export async function deleteTaxRateAction(formData: FormData) {
  const ctx = await getContext('tax.manage_global_rates');
  if (!ctx) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const [before] = await db.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
  if (!before) return;
  const deletedAt = new Date();
  await db
    .update(taxRates)
    .set({ isActive: false, deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
    .where(eq(taxRates.id, id));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'tax_rate',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), isActive: false } as never,
  });
  revalidatePath('/tax/rates');
}
