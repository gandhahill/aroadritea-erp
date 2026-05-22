import { getTranslations } from 'next-intl/server';
import { fetchAuditTrail } from './actions';
import { AuditTrailClient } from './audit-trail-client';

export async function generateMetadata() {
  const t = await getTranslations('audit');
  return { title: t('title') };
}

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    action?: string;
    actor?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const filters = await searchParams;
  const data = await fetchAuditTrail(filters);
  return <AuditTrailClient data={data} filters={filters} />;
}
