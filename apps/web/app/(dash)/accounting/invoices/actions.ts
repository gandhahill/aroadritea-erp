import type { PermissionCode } from '@erp/shared/types';
'use server';

import { getSession } from '@/lib/auth';
import { db, desc, eq, inArray, and, isNull } from '@erp/db';
import {
  accounts,
  invoiceLines,
  invoices,
  partners,
  bankAccounts,
} from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { locations } from '@erp/db/schema/auth';
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

export async function payInvoiceAction(invoiceId: string, paymentAccountId: string, amount: string, date: string) {
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

  const res = await payInvoice(invoiceId, paymentAccountId, amount, date, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/accounting/invoices');
  return { success: true, paymentJournalId: res.value.paymentJournalId };
}

export async function fetchPrintInvoiceData(invoiceId: string) {
  const session = await getSession();
  if (!session) return null;
  const user = session.user as any;
  const tenantId = String(user.tenantId ?? 'default');

  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      type: invoices.type,
      date: invoices.date,
      dueDate: invoices.dueDate,
      partnerName: invoices.partnerName,
      partnerAddress: invoices.partnerAddress,
      partnerNpwp: invoices.partnerNpwp,
      paymentTerms: invoices.paymentTerms,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxAmount: invoices.taxAmount,
      total: invoices.total,
      notes: invoices.notes,
      locationName: locations.name,
    })
    .from(invoices)
    .leftJoin(locations, eq(invoices.locationId, locations.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (invoiceRows.length === 0) return null;
  const invoice = invoiceRows[0];

  const lines = await db
    .select({
      id: invoiceLines.id,
      invoiceId: invoiceLines.invoiceId,
      lineNo: invoiceLines.lineNo,
      accountId: invoiceLines.accountId,
      description: invoiceLines.description,
      unit: invoiceLines.unit,
      quantity: invoiceLines.quantity,
      unitPrice: invoiceLines.unitPrice,
      subtotal: invoiceLines.subtotal,
      taxAmount: invoiceLines.taxAmount,
    })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(invoiceLines.lineNo);

  const settings = await db.select().from(cmsSettings).where(eq(cmsSettings.tenantId, tenantId));
  const map = new Map<string, unknown>();
  for (const s of settings) {
    map.set(s.key, s.value);
  }

  const bankRows = await db
    .select({
      id: bankAccounts.id,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      accountHolder: bankAccounts.accountHolder,
    })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, tenantId), eq(bankAccounts.isActive, true), isNull(bankAccounts.deletedAt)));

  const companyInfo = {
    name: (map.get('company.name') as string) || 'PT. Gandha Hill Catering Management Indonesia',
    address: (map.get('company.address') as string) || '',
    npwp: (map.get('company.npwp') as string) || '',
    phone: (map.get('company.phone') as string) || '',
  };

  return { invoice, lines, companyInfo, bankAccounts: bankRows };
}
