/**
 * SOP list page — User Req 2.
 * Every authenticated employee with `hr.sop.read` sees this list.
 * Manage / upload actions surface only when the session has `hr.sop.manage`.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { fetchSopList } from './actions';
import { SopListClient } from './sop-list-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('hr.sop');
  return { title: `${t('title')} — Aroadri Tea` };
}

export default async function SopPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    search?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const userId = String((session.user as Record<string, unknown>).id ?? '');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const pageSize = Math.max(1, Math.min(200, Number(params.pageSize ?? '25') || 25));

  const [result, canManage, t] = await Promise.all([
    fetchSopList({
      status: params.status as never,
      category: params.category as never,
      search: params.search,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    can(userId, 'hr.sop.manage'),
    getTranslations('hr.sop')
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <SopListClient
        rows={result.items}
        total={result.total}
        page={page}
        pageSize={pageSize}
        initialStatus={params.status ?? ''}
        initialCategory={params.category ?? ''}
        initialSearch={params.search ?? ''}
        canManage={canManage}
        error={result.error ?? null}
      />
    </div>
  );
}
