import { can } from '@erp/services/iam';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { fetchTransferDetail } from '../actions';
import { TransferDetail } from './transfer-detail';

export const metadata: Metadata = {
  title: 'Transfer Detail | Aroadri ERP',
};

export default async function TransferDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  const user = session?.user as any;
  if (!user || !user.id) redirect('/login');

  const perm = await can(user.id, 'inventory.transfer');
  if (!perm) redirect('/dashboard');

  const data = await fetchTransferDetail(params.id);
  if (!data) notFound();

  return <TransferDetail data={data} currentUserId={user.id} />;
}
