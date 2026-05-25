/**
 * COGS / Recipe Costing — T-0174.
 */

import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { fetchCogs } from './actions';
import { CogsClient } from './cogs-client';

export const metadata: Metadata = { title: 'COGS & Recipe Costing' };

export default async function CogsPage({
  searchParams,
}: {
  searchParams: Promise<{ includeInactive?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const params = await searchParams;
  const includeInactive = params.includeInactive === 'true';

  const t = await getTranslations('reporting.cogs');
  const result = await fetchCogs({ includeInactive });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <CogsClient
        includeInactive={includeInactive}
        data={result.ok ? (result.data ?? null) : null}
        error={result.ok ? null : (result.error ?? null)}
      />
    </div>
  );
}
