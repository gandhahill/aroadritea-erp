'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, isNull } from '@erp/db';
import { accounts, auditLog, bankAccounts } from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface BankAccountItem {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  accountId: string; // COA ID
  accountName?: { id: string; en: string; zh: string }; // from COA
  accountCode?: string; // from COA
  isActive: boolean;
}

export interface BankAccountDraft {
  id?: string | null;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  accountId: string;
  isActive: boolean;
}

export type BankAccountActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

async function requireContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const perm = await requirePermission(userId, 'settings.bank_accounts.manage');
  if (perm.ok) return { tenantId, userId };
  return null;
}

export async function fetchCoaAccounts() {
  const ctx = await requireContext();
  if (!ctx) return [];

  // Assuming bank accounts usually have type 'asset' and subtype 'current_asset' or similar,
  // but to be safe we'll fetch all active asset accounts to let users map them.
  const rows = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.type, 'asset'),
      ),
    )
    .orderBy(accounts.code);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name as { id: string; en: string; zh: string },
  }));
}

export async function fetchBankAccounts(): Promise<BankAccountItem[]> {
  const ctx = await requireContext();
  if (!ctx) return [];

  const rows = await db
    .select({
      id: bankAccounts.id,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      accountHolder: bankAccounts.accountHolder,
      accountId: bankAccounts.accountId,
      isActive: bankAccounts.isActive,
      coaCode: accounts.code,
      coaName: accounts.name,
    })
    .from(bankAccounts)
    .innerJoin(accounts, eq(bankAccounts.accountId, accounts.id))
    .where(and(eq(bankAccounts.tenantId, ctx.tenantId), isNull(bankAccounts.deletedAt)))
    .orderBy(bankAccounts.bankName);

  return rows.map((row) => ({
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountHolder: row.accountHolder,
    accountId: row.accountId,
    accountCode: row.coaCode,
    accountName: row.coaName as { id: string; en: string; zh: string },
    isActive: row.isActive,
  }));
}

export async function saveBankAccount(input: BankAccountDraft): Promise<BankAccountActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  if (!input.bankName.trim() || !input.accountNumber.trim() || !input.accountHolder.trim()) {
    return { success: false, error: 'Semua field (Nama Bank, Nomor, Pemilik) wajib diisi.' };
  }
  if (!input.accountId.trim()) {
    return { success: false, error: 'Pilih akun COA yang terhubung.' };
  }

  // Ensure the selected COA account belongs to this tenant
  const [coa] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.accountId)))
    .limit(1);

  if (!coa) {
    return { success: false, error: 'Akun COA tidak valid.' };
  }

  const values = {
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.trim(),
    accountHolder: input.accountHolder.trim(),
    accountId: input.accountId,
    isActive: input.isActive,
    updatedAt: new Date(),
    updatedBy: ctx.userId || null,
  };

  try {
    if (input.id) {
      const [before] = await db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.tenantId, ctx.tenantId), eq(bankAccounts.id, input.id)))
        .limit(1);
      if (!before) return { success: false, error: 'Akun bank tidak ditemukan.' };

      await db
        .update(bankAccounts)
        .set(values)
        .where(and(eq(bankAccounts.tenantId, ctx.tenantId), eq(bankAccounts.id, input.id)));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'bank_account',
        entityId: input.id,
        before: before as never,
        after: values as never,
      });

      revalidatePath('/settings/bank-accounts');
      return { success: true, id: input.id };
    }

    const id = generateId();
    await db.insert(bankAccounts).values({
      id,
      tenantId: ctx.tenantId,
      ...values,
      createdBy: ctx.userId || null,
    });

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'bank_account',
      entityId: id,
      before: null,
      after: values as never,
    });

    revalidatePath('/settings/bank-accounts');
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan akun bank.',
    };
  }
}

export async function deleteBankAccount(input: { id: string }): Promise<BankAccountActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const id = input.id.trim();
  if (!id) return { success: false, error: 'Akun bank tidak valid.' };

  const [before] = await db
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.tenantId, ctx.tenantId),
        eq(bankAccounts.id, id),
        isNull(bankAccounts.deletedAt),
      ),
    )
    .limit(1);
  if (!before) return { success: false, error: 'Akun bank tidak ditemukan.' };

  const deletedAt = new Date();
  await db
    .update(bankAccounts)
    .set({
      isActive: false,
      deletedAt,
      updatedAt: deletedAt,
      updatedBy: ctx.userId || null,
    })
    .where(and(eq(bankAccounts.tenantId, ctx.tenantId), eq(bankAccounts.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'bank_account',
    entityId: id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), isActive: false } as never,
  });

  revalidatePath('/settings/bank-accounts');
  return { success: true, id };
}
