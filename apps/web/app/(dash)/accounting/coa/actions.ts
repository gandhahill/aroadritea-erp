/**
 * COA Server Action — fetches Chart of Accounts for tree browser.
 * SD §21.1: COA browser (tree view, search, multi-bahasa).
 */

'use server';

import { db } from '@erp/db';
import { and, eq, isNull } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';

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
export async function fetchCOATree(tenantId: string): Promise<COANode[]> {
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
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
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
