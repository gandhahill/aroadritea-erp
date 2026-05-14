/**
 * COA Server Action — fetches Chart of Accounts for tree browser.
 * SD §21.1: COA browser (tree view, search, multi-bahasa).
 */

'use server';

import { getSession } from '@/lib/auth';
import { db } from '@erp/db';
import { and, eq, isNull } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { requirePermission } from '@erp/services/iam';

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
