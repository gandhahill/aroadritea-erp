/**
 * COA Browser Page — SD §21.1
 * Tree view of Chart of Accounts with search, multi-bahasa display.
 */

import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { fetchCOATree } from './actions';
import { COAEditor } from './coa-editor';
import { COATreeView } from './coa-tree';

export const metadata: Metadata = {
  title: 'Chart of Accounts',
};

export default async function COAPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const tree = await fetchCOATree();

  const t = await getTranslations('accounting.coa');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-brand-ink-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
            {tree.reduce((sum, node) => sum + countNodes(node), 0)} accounts
          </span>
        </div>
      </div>

      <COAEditor tree={tree} />

      {/* COA Tree */}
      <COATreeView tree={tree} />
    </div>
  );
}

function countNodes(node: { children: { children: unknown[] }[] }): number {
  return (
    1 + node.children.reduce((sum: number, child) => sum + countNodes(child as typeof node), 0)
  );
}
