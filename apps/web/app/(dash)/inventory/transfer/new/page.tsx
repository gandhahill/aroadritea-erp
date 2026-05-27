import { can } from '@erp/services/iam';
import { getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchLocationOptions, fetchProductOptions } from '../actions';
import { NewTransferForm } from './new-transfer-form';

export const metadata: Metadata = {
  title: 'New Stock Transfer | Aroadri Tea ERP',
};

export default async function NewTransferPage() {
  const session = await getSession();
  const user = session?.user as any;
  if (!user || !user.id) redirect('/login');

  const perm = await can(user.id, 'inventory.transfer');
  if (!perm) redirect('/dashboard');

  const [locations, products] = await Promise.all([
    fetchLocationOptions(),
    fetchProductOptions(),
  ]);

  return (
    <NewTransferForm
      locations={locations}
      products={products}
      defaultLocationId={user.locationId || null}
    />
  );
}
