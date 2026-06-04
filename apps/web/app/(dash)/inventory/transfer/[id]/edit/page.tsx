import { can } from '@erp/services/iam';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { fetchLocationOptions, fetchProductOptions, fetchTransferDetail } from '../../actions';
import { EditTransferForm } from './edit-transfer-form';

export const metadata: Metadata = {
  title: 'Edit Stock Transfer',
};

export default async function EditTransferPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  const user = session?.user as any;
  if (!user || !user.id) redirect('/login');

  const perm = await can(user.id, 'inventory.transfer');
  if (!perm) redirect('/dashboard');

  const [data, locations, products] = await Promise.all([
    fetchTransferDetail(params.id),
    fetchLocationOptions(),
    fetchProductOptions(),
  ]);

  if (!data || data.status !== 'draft') notFound();

  return (
    <EditTransferForm
      data={data}
      locations={locations}
      products={products}
    />
  );
}
