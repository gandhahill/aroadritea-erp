/**
 * COA Browser Page — SD §21.1
 * Tree view of Chart of Accounts with search, multi-bahasa display.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
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
      <PageHeader
        title={<>{t('title')}</>}
        description={<>{t('subtitle')}</>}
        actions={
          <>
            <div className="flex items-center gap-3 text-sm text-brand-ink-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-jade-light px-3 py-1 text-xs font-medium text-brand-jade">
                {tree.reduce((sum, node) => sum + countNodes(node), 0)} {t('account')}
              </span>
            </div>
          </>
        }
      />

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
