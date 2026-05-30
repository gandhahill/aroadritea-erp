import { can } from '@erp/services/iam';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchLocationOptions, fetchTransferList } from './actions';
import { TransferListClient } from './transfer-list-client';

export const metadata: Metadata = {
  title: 'Stock Transfer',
};

export default async function TransferListPage(props: {
  searchParams: Promise<Record<string, string>>;
}) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  const user = session?.user as any;
  if (!user || !user.id) redirect('/login');

  const perm = await can(user.id, 'inventory.transfer');
  if (!perm) redirect('/dashboard');

  const page = Number.parseInt(searchParams.page || '1', 10);
  const locationId = searchParams.locationId;
  const status = searchParams.status;

  const [data, locations] = await Promise.all([
    fetchTransferList(locationId, status, page, 25),
    fetchLocationOptions(),
  ]);

  return <TransferListClient data={data} locations={locations} searchParams={searchParams} />;
}
