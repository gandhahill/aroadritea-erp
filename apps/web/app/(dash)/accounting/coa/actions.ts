/**
 * COA Server Action — fetches Chart of Accounts for tree browser.
 * SD §21.1: COA browser (tree view, search, multi-bahasa).
 */

'use server';

import { getSession } from '@/lib/auth';
import { auditLog, db } from '@erp/db';
import { and, count, eq, isNull, sql } from '@erp/db';
import {
  accounts,
  fixedAssetCategories,
  journalEntries,
  journalLines,
  taxRates,
} from '@erp/db/schema/accounting';
import { products } from '@erp/db/schema/inventory';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface COANode {
  id: string;
  code: string;
  name: Record<string, string>;
  type: string;
  subtype: string;
  normalBalance: string;
  isPostable: boolean;
  isActive: boolean;
  parentId: string | null;
  children: COANode[];
}

export interface COAAccountDraft {
  id?: string | null;
  code: string;
  name: { id: string; en: string; zh: string };
  type: string;
  subtype: string;
  normalBalance: string;
  parentId?: string | null;
  isPostable: boolean;
  isActive: boolean;
}

export type COAActionResult =
  | { success: true; id: string; message?: string }
  | { success: false; error: string };

async function requireCOAContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const perm = await requirePermission(userId, 'accounting.coa.manage');
  if (!perm.ok) return null;
  return { tenantId, userId };
}

/**
 * Fetch all COA accounts for a tenant, organized as a tree.
 */
export async function fetchCOATree(): Promise<COANode[]> {
  const session = await getSession();
  if (!session?.user) return [];
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');

  const perm = await requirePermission(userId, 'accounting.view');
  if (!perm.ok) return [];

  const rows = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      subtype: accounts.subtype,
      normalBalance: accounts.normalBalance,
      isPostable: accounts.isPostable,
      isActive: accounts.isActive,
      parentId: accounts.parentId,
    })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), isNull(accounts.deletedAt)))
    .then((r) =>
      r.map((row) => ({
        ...row,
        name: row.name as Record<string, string>,
      })),
    );

  // Build tree structure
  const nodeMap = new Map<string, COANode>();
  const roots: COANode[] = [];

  // First pass: create all nodes
  for (const row of rows) {
    nodeMap.set(row.id, { ...row, children: [] });
  }

  // Second pass: link children
  for (const node of nodeMap.values()) {
    const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort recursively by code
  const sortTree = (nodes: COANode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);

  return roots;
}

export async function saveCOAAccount(input: COAAccountDraft): Promise<COAActionResult> {
  const ctx = await requireCOAContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const code = input.code.trim();
  if (!/^[1-9]-\d{4,6}$/.test(code)) {
    return { success: false, error: 'Kode akun harus mengikuti format seperti 1-1100.' };
  }
  const nameId = input.name.id.trim();
  if (!nameId) return { success: false, error: 'Nama akun wajib diisi.' };

  const values = {
    code,
    name: {
      id: nameId,
      en: input.name.en.trim() || nameId,
      zh: input.name.zh.trim() || input.name.en.trim() || nameId,
    },
    type: input.type,
    subtype: input.subtype.trim() || input.type,
    parentId: input.parentId?.trim() || null,
    normalBalance: input.normalBalance === 'credit' ? 'credit' : 'debit',
    isPostable: Boolean(input.isPostable),
    isActive: Boolean(input.isActive),
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };

  try {
    if (input.id) {
      const [before] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.id)))
        .limit(1);
      if (!before) return { success: false, error: 'Akun tidak ditemukan.' };

      await db
        .update(accounts)
        .set(values)
        .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, input.id)));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'update',
        entityType: 'account',
        entityId: input.id,
        before: before as never,
        after: values as never,
      });
      revalidatePath('/accounting/coa');
      return { success: true, id: input.id };
    }

    const id = generateId();
    await db.insert(accounts).values({
      id,
      tenantId: ctx.tenantId,
      ...values,
      createdBy: ctx.userId,
    });

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'account',
      entityId: id,
      before: null,
      after: values as never,
    });
    revalidatePath('/accounting/coa');
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Gagal menyimpan akun.' };
  }
}

export async function deleteCOAAccount(input: {
  id: string;
  replacementAccountId?: string | null;
}): Promise<COAActionResult> {
  const ctx = await requireCOAContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const id = input.id.trim();
  const replacementAccountId = input.replacementAccountId?.trim() || null;
  const [before] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, id), isNull(accounts.deletedAt)))
    .limit(1);
  if (!before) return { success: false, error: 'Akun tidak ditemukan.' };

  const [child] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.parentId, id), isNull(accounts.deletedAt)))
    .limit(1);
  if (child) {
    return { success: false, error: 'Akun masih memiliki sub-akun. Hapus atau pindahkan sub-akun terlebih dahulu.' };
  }

  if (replacementAccountId === id) {
    return { success: false, error: 'Akun pengganti tidak boleh sama dengan akun yang dihapus.' };
  }

  let replacement: typeof accounts.$inferSelect | null = null;
  if (replacementAccountId) {
    const [row] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, ctx.tenantId),
          eq(accounts.id, replacementAccountId),
          eq(accounts.isActive, true),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return { success: false, error: 'Akun pengganti tidak ditemukan atau tidak aktif.' };
    if (!row.isPostable) return { success: false, error: 'Akun pengganti harus postable.' };
    replacement = row;

    await replaceDraftAndConfigurationReferences(ctx.tenantId, id, replacementAccountId);
  }

  const journalUsage = await countJournalLineUsage(ctx.tenantId, id);
  const deletedAt = new Date();
  const canDelete = journalUsage === 0;
  await db
    .update(accounts)
    .set({
      isActive: false,
      deletedAt: canDelete ? deletedAt : null,
      updatedAt: deletedAt,
      updatedBy: ctx.userId,
    })
    .where(and(eq(accounts.tenantId, ctx.tenantId), eq(accounts.id, id)));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: canDelete ? 'delete' : 'deactivate',
    entityType: 'account',
    entityId: id,
    before: before as never,
    after: {
      deletedAt: canDelete ? deletedAt.toISOString() : null,
      isActive: false,
      replacementAccountId: replacement?.id ?? null,
      remainingJournalLineCount: journalUsage,
    } as never,
  });
  revalidatePath('/accounting/coa');
  return {
    success: true,
    id,
    message: canDelete
      ? 'Akun dihapus karena tidak pernah dipakai di jurnal.'
      : replacement
        ? 'Referensi konfigurasi dan jurnal draft sudah dipindahkan. Akun tetap disimpan nonaktif karena masih memiliki histori jurnal posted/reversed.'
        : 'Akun dinonaktifkan. Histori jurnal masih ada sehingga akun tidak dihapus dari arsip audit.',
  };
}

async function countJournalLineUsage(tenantId: string, accountId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(eq(journalEntries.tenantId, tenantId), eq(journalLines.accountId, accountId)));
  return Number(row?.c ?? 0);
}

async function replaceDraftAndConfigurationReferences(
  tenantId: string,
  accountId: string,
  replacementAccountId: string,
) {
  await db.execute(sql`
    UPDATE journal_lines AS jl
    SET account_id = ${replacementAccountId}
    FROM journal_entries AS je
    WHERE jl.journal_entry_id = je.id
      AND je.tenant_id = ${tenantId}
      AND je.status = 'draft'
      AND jl.account_id = ${accountId}
  `);

  await db
    .update(taxRates)
    .set({ postingAccountId: replacementAccountId, updatedAt: new Date() })
    .where(eq(taxRates.postingAccountId, accountId));

  await db
    .update(fixedAssetCategories)
    .set({ assetAccountId: replacementAccountId, updatedAt: new Date() })
    .where(and(eq(fixedAssetCategories.tenantId, tenantId), eq(fixedAssetCategories.assetAccountId, accountId)));
  await db
    .update(fixedAssetCategories)
    .set({ accumulatedDepreciationAccountId: replacementAccountId, updatedAt: new Date() })
    .where(
      and(
        eq(fixedAssetCategories.tenantId, tenantId),
        eq(fixedAssetCategories.accumulatedDepreciationAccountId, accountId),
      ),
    );
  await db
    .update(fixedAssetCategories)
    .set({ depreciationExpenseAccountId: replacementAccountId, updatedAt: new Date() })
    .where(
      and(
        eq(fixedAssetCategories.tenantId, tenantId),
        eq(fixedAssetCategories.depreciationExpenseAccountId, accountId),
      ),
    );

  await db
    .update(products)
    .set({ cogsAccountId: replacementAccountId, updatedAt: new Date() })
    .where(and(eq(products.tenantId, tenantId), eq(products.cogsAccountId, accountId)));
  await db
    .update(products)
    .set({ revenueAccountId: replacementAccountId, updatedAt: new Date() })
    .where(and(eq(products.tenantId, tenantId), eq(products.revenueAccountId, accountId)));
  await db
    .update(products)
    .set({ inventoryAccountId: replacementAccountId, updatedAt: new Date() })
    .where(and(eq(products.tenantId, tenantId), eq(products.inventoryAccountId, accountId)));
}
