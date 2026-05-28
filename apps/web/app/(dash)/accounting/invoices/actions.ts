import type { PermissionCode } from '@erp/shared/types';
'use server';

import { getSession } from '@/lib/auth';
import { db, desc, eq, inArray, and } from '@erp/db';
import { invoices } from '@erp/db';
import { createInvoice, postInvoice } from '@erp/services/accounting';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { authorizedLocationIdsForTenant } from '@/lib/authz';

export async function fetchInvoicesAction() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as any;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id),
    'accounting.journal.view',
    String(user.tenantId ?? 'default'),
  );

  if (!scope.global && scope.locationIds.length === 0) return [];

  if (!scope.global && scope.locationIds.length > 0) {
    return db
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, String(user.tenantId ?? 'default')), inArray(invoices.locationId, scope.locationIds)))
      .orderBy(desc(invoices.createdAt));
  }

  return db
    .select()
    .from(invoices)
    .where(eq(invoices.tenantId, String(user.tenantId ?? 'default')))
    .orderBy(desc(invoices.createdAt));
}

export async function createInvoiceAction(input: any) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as any;

  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await createInvoice(input, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/accounting/invoices');
  return { success: true, id: res.value.id };
}

export async function postInvoiceAction(invoiceId: string, accountId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as any;

  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await postInvoice(invoiceId, accountId, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/accounting/invoices');
  return { success: true, journalId: res.value.journalId };
}

export async function payInvoiceAction(invoiceId: string, paymentAccountId: string, date: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = session.user as any;

  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  // We need to import payInvoice
  const { payInvoice } = await import('@erp/services/accounting');

  const res = await payInvoice(invoiceId, paymentAccountId, date, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/accounting/invoices');
  return { success: true, paymentJournalId: res.value.paymentJournalId };
}
