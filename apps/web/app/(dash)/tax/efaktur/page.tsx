import { db } from '@erp/db';
import { nsfpBlocks, taxInvoices } from '@erp/db/schema/accounting';
import { eq, desc } from '@erp/db';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@erp/services/iam';
import { redirect } from 'next/navigation';
import EFakturClient from './client';

export const metadata = {
  title: 'e-Faktur / NSFP',
};

export default async function EFakturPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  
  const user = session.user as Record<string, unknown>;
  const ctx = {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };

  const perm = await requirePermission(ctx.userId, 'tax.export');
  if (!perm.ok) redirect('/');

  // Load NSFP blocks
  const blocks = await db
    .select()
    .from(nsfpBlocks)
    .where(eq(nsfpBlocks.tenantId, ctx.tenantId))
    .orderBy(desc(nsfpBlocks.issueDate));

  // Load recent Tax Invoices
  const invoices = await db
    .select()
    .from(taxInvoices)
    .where(eq(taxInvoices.tenantId, ctx.tenantId))
    .orderBy(desc(taxInvoices.issueDate), desc(taxInvoices.nsfp))
    .limit(100);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">e-Faktur / NSFP</h1>
        <p className="text-muted-foreground">Manage NSFP blocks and export e-Faktur CSV for DJP.</p>
      </div>

      <EFakturClient initialBlocks={blocks} initialInvoices={invoices} />
    </div>
  );
}
