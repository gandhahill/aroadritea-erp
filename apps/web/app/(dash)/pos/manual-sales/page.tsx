import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchManualSalesPageData } from './actions';
import { fetchPosDraftsAction } from './draft-actions';
import { ManualSalesClient } from './manual-sales-client';

export const metadata: Metadata = { title: 'Manual Sales Closing' };

export default async function ManualSalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ locationId?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const params = await searchParams;
  const page = Number.parseInt(params?.page ?? '1', 10);
  const pageSize = Number.parseInt(params?.pageSize ?? '10', 10);

  // Resolve employee outlet location when session has no locationId
  let userLocationId = String(user.locationId ?? '');
  if (!userLocationId) {
    const tenantId = String(user.tenantId ?? 'default');
    const userId = String(user.id ?? '');
    const { resolveEmployeeForUser } = await import('@erp/services/hr');
    const employee = await resolveEmployeeForUser(tenantId, userId);
    userLocationId = employee?.locationId ?? '';
  }

  const requestedLocationId = params?.locationId;
  const [data, drafts] = await Promise.all([
    fetchManualSalesPageData(
      requestedLocationId || undefined,
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 10,
    ),
    fetchPosDraftsAction('manual_sales'),
  ]);
  // Use the employee's location for the input form default, otherwise fallback
  const defaultLocationId = userLocationId || requestedLocationId || data.locations[0]?.id || '';

  return <ManualSalesClient data={data} defaultLocationId={defaultLocationId} drafts={drafts} />;
}
