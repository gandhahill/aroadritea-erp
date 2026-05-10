import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchReimbursements, fetchLocations } from './actions';
import { ReimbursementClient } from './reimbursement-view';

export const metadata: Metadata = {
  title: 'Reimbursement',
};

export default async function ReimbursementPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = (session.user as Record<string, unknown>)?.id as string ?? '';
  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string ?? 'default';

  const [items, locations] = await Promise.all([
    fetchReimbursements(tenantId),
    fetchLocations(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Reimbursement</h1>
        <p className="mt-1 text-sm text-brand-ink-3">
          Ajukan dan kelola pengajuan dana reimbursement.
        </p>
      </div>

      <ReimbursementClient
        initialItems={items}
        locations={locations}
        tenantId={tenantId}
        userId={userId}
      />
    </div>
  );
}