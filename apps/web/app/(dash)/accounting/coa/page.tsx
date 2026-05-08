/**
 * COA Browser Page — SD §21.1
 * Tree view of Chart of Accounts with search, multi-bahasa display.
 */

import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchCOATree } from './actions';
import { COATreeView } from './coa-tree';

export const metadata: Metadata = {
  title: 'Chart of Accounts',
};

export default async function COAPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string ?? 'default';
  const tree = await fetchCOATree(tenantId);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            Browse and manage your chart of accounts hierarchy.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-brand-ink-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {tree.reduce((sum, node) => sum + countNodes(node), 0)} accounts
          </span>
        </div>
      </div>

      {/* COA Tree */}
      <COATreeView tree={tree} />
    </div>
  );
}

function countNodes(node: { children: { children: unknown[] }[] }): number {
  return 1 + node.children.reduce((sum: number, child) => sum + countNodes(child as typeof node), 0);
}
