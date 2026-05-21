import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { fetchManualSalesPageData } from './actions';
import { ManualSalesClient } from './manual-sales-client';

export const metadata: Metadata = { title: 'Manual Sales Closing - POS' };

export default async function ManualSalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ locationId?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const user = session.user as Record<string, unknown>;
  const params = await searchParams;
  const page = Number.parseInt(params?.page ?? '1', 10);
  const defaultLocationId = params?.locationId ?? String(user.locationId ?? '');
  const data = await fetchManualSalesPageData(defaultLocationId, Number.isFinite(page) ? page : 1);

  return <ManualSalesClient data={data} defaultLocationId={defaultLocationId} />;
}
