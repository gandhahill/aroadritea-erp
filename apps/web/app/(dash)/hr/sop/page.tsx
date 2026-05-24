/**
 * SOP list page — User Req 2.
 * Every authenticated employee with `hr.sop.read` sees this list.
 * Manage / upload actions surface only when the session has `hr.sop.manage`.
 */

import { getSession } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { can } from '@erp/services/iam';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchSopList } from './actions';
import { SopListClient } from './sop-list-client';

export const metadata: Metadata = { title: 'SOP — Aroadri Tea' };

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

  const result = await fetchSopList({
    status: params.status as never,
    category: params.category as never,
    search: params.search,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const canManage = await can(userId, 'hr.sop.manage');

  return (
    <main className="space-y-6 p-6">
      <PageHeader
        title="SOP / Standar Operasional"
        description="Dokumen prosedur kerja resmi yang wajib diketahui setiap karyawan."
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
    </main>
  );
}
