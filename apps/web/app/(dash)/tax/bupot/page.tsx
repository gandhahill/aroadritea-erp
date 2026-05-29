import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';
import BupotClient from './client';

export const metadata = {
  title: 'Bukti Potong PPh - Aroadri Tea ERP',
};

export default async function BuktiPotongPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  
  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');

  const perm = await requirePermission(userId, 'tax.view');
  if (!perm.ok) redirect('/');

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Bukti Potong (Bupot)</h2>
      </div>
      <div className="hidden items-center space-x-2 md:flex">
        <p className="text-muted-foreground">
          Daftar Bukti Potong PPh 23 dan PPh Final yang telah dipungut dari vendor/supplier.
        </p>
      </div>
      <BupotClient />
    </div>
  );
}
