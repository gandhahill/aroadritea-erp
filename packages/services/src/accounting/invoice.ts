/**
 * accounting.invoice
 *
 * Handles creation, updating, and posting of Invoices, which syncs to Journals.
 */

import { db } from '@erp/db';
import { invoiceLines, invoices } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { generateInvoiceNumber } from '../shared/number-generator';
import { createJournal } from './create-journal';
import { postJournal } from './post-journal';

export interface CreateInvoiceInput {
  type: 'sales' | 'purchase';
  date: string;
  dueDate: string | null;
  partnerName: string;
  partnerAddress?: string | null;
  partnerNpwp?: string | null;
  paymentTerms?: string | null;
  notes: string | null;
  locationId: string;
  lines: Array<{
    accountId: string;
    description: string;
    unit?: string;
    quantity: number;
    unitPrice: string; // From UI as string to avoid precision loss
    subtotal: string;
    taxCode?: string | null;
    taxRate?: number | null; // basis points, e.g. 1000 = 10%
  }>;
}

export async function createInvoice(
  input: CreateInvoiceInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; number: string }>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'accounting.journal.create', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const invoiceId = generateId();

  // Generate sequential invoice number server-side
  const invoiceNumber = await generateInvoiceNumber(ctx.tenantId, input.date);

  let totalSubtotal = 0n;
  let totalTax = 0n;
  const parsedLines = input.lines.map((line, idx) => {
    const unitPrice = BigInt(line.unitPrice);
    const subtotal = BigInt(line.subtotal);
    totalSubtotal += subtotal;
    // Calculate tax per line if rate is provided (bps → e.g. 1000 = 10%)
    let lineTax = 0n;
    if (line.taxRate && line.taxRate > 0) {
      lineTax = (subtotal * BigInt(line.taxRate)) / 10000n;
    }
    totalTax += lineTax;
    return {
      ...line,
      unitPrice,
      subtotal,
      lineTax,
      lineNo: idx + 1,
    };
  });

  const grandTotal = totalSubtotal + totalTax;

  const result = await tryCatch(
    async () => {
      await db.insert(invoices).values({
        id: invoiceId,
        tenantId: ctx.tenantId,
        number: invoiceNumber,
        type: input.type,
        date: input.date,
        dueDate: input.dueDate,
        partnerName: input.partnerName,
        partnerAddress: input.partnerAddress,
        partnerNpwp: input.partnerNpwp,
        paymentTerms: input.paymentTerms,
        notes: input.notes,
        status: 'draft',
        locationId: input.locationId,
        subtotal: totalSubtotal,
        taxAmount: totalTax,
        total: grandTotal,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      const lineValues = parsedLines.map((line) => ({
        id: generateId(),
        invoiceId: invoiceId,
        lineNo: line.lineNo,
        accountId: line.accountId,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
        taxAmount: line.lineTax,
      }));

      await db.insert(invoiceLines).values(lineValues);

      await auditRecord({
        action: 'create',
        entityType: 'invoice',
        entityId: invoiceId,
        before: null,
        after: {
          id: invoiceId,
          number: invoiceNumber,
          subtotal: totalSubtotal.toString(),
          taxAmount: totalTax.toString(),
          total: grandTotal.toString(),
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        ctx,
      });

      return { id: invoiceId, number: invoiceNumber };
    },
    (e) => AppError.internal('accounting.invoice.createFailed', e),
  );

  return result;
}

export async function postInvoice(
  invoiceId: string,
  receivableOrPayableAccountId: string,
  ctx: AuditContext,
): Promise<Result<{ success: boolean; journalId: string }>> {
  // Get Invoice
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)));
  const invoice = invoiceRows[0];
  if (!invoice) return err(AppError.notFound('invoice.notFound'));

  if (invoice.status !== 'draft') {
    return err(AppError.businessRule('invoice.notDraft'));
  }

  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));

  // Build Journal Entries
  // Sales Invoice: Debit Receivable (total), Credit Income (lines)
  // Purchase Invoice: Credit Payable (total), Debit Expense/Asset (lines)
  const journalLinesData: Array<any> = [];

  // Line for Partner (AR/AP)
  journalLinesData.push({
    accountId: receivableOrPayableAccountId,
    locationId: invoice.locationId,
    description: `Invoice ${invoice.number} - ${invoice.partnerName}`,
    debit: invoice.type === 'sales' ? invoice.total.toString() : '0',
    credit: invoice.type === 'purchase' ? invoice.total.toString() : '0',
    dueDate: invoice.dueDate,
  });

  // Lines for income/expense
  for (const line of lines) {
    journalLinesData.push({
      accountId: line.accountId,
      locationId: invoice.locationId,
      description: line.description,
      debit: invoice.type === 'purchase' ? line.subtotal.toString() : '0',
      credit: invoice.type === 'sales' ? line.subtotal.toString() : '0',
    });
  }

  const journalInput = {
    postingDate: invoice.date,
    locationId: invoice.locationId,
    description: `Sync from Invoice ${invoice.number} (${invoice.partnerName})`,
    referenceType: (invoice.type === 'sales' ? 'sales' : 'purchase') as 'sales' | 'purchase',
    referenceId: invoiceId,
    lines: journalLinesData,
  };

  const createRes = await createJournal(journalInput, ctx, { skipPermissionCheck: true });
  if (!createRes.ok) return createRes;
  const journalId = createRes.value.id;

  const postRes = await postJournal({ journalId }, ctx);
  if (!postRes.ok) return postRes;

  // Mark invoice as posted before attempting e-Faktur generation.
  // The journal is already posted above — update the invoice status to keep
  // the books consistent even if NSFP allocation fails later.
  await db
    .update(invoices)
    .set({ status: 'posted', journalId, updatedBy: ctx.userId })
    .where(eq(invoices.id, invoiceId));

  if (invoice.type === 'sales' && invoice.taxAmount > 0n) {
    const { generateTaxInvoice } = await import('../tax/efaktur');
    // e-Faktur generation is best-effort: a missing NSFP block does NOT
    // roll back the accounting entry. The operator must register an NSFP
    // block and re-trigger generation via the Tax → e-Faktur menu.
    await generateTaxInvoice(invoiceId, ctx);
  }

  return ok({ success: true, journalId });
}

export async function payInvoice(
  invoiceId: string,
  paymentAccountId: string,
  amountStr: string,
  date: string,
  ctx: AuditContext,
): Promise<Result<{ success: boolean; paymentJournalId: string }>> {
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, ctx.tenantId)));
  const invoice = invoiceRows[0];
  if (!invoice) return err(AppError.notFound('invoice.notFound'));

  if (invoice.status !== 'posted' && invoice.status !== 'partial') {
    return err(AppError.businessRule('invoice.notPosted'));
  }

  const amountToPay = BigInt(amountStr);
  if (amountToPay <= 0n) return err(AppError.validation('invalid.amount'));

  const remaining = invoice.total - invoice.amountPaid;
  if (amountToPay > remaining) {
    return err(AppError.validation('invoice.amountExceedsRemaining'));
  }

  // Generate Payment Journal Entry
  // If Sales: Debit Cash, Credit AR
  // If Purchase: Debit AP, Credit Cash
  const journalLinesData = [
    {
      accountId: paymentAccountId, // Cash/Bank
      locationId: invoice.locationId,
      description: `Payment Receipt for Invoice ${invoice.number}`,
      debit: invoice.type === 'sales' ? amountToPay.toString() : '0',
      credit: invoice.type === 'purchase' ? amountToPay.toString() : '0',
    },
  ];

  // We need to fetch the AR/AP account from the original posting journal
  // To keep it simple, we reverse the balance of the original posting journal's partner line
  const journalInput = {
    postingDate: date,
    locationId: invoice.locationId,
    description: `Payment for Invoice ${invoice.number} (${invoice.partnerName})`,
    referenceType: (invoice.type === 'sales' ? 'sales' : 'purchase') as 'sales' | 'purchase',
    referenceId: invoiceId,
    lines: [
      ...journalLinesData,
      // To determine AR/AP account, we'll fetch the original journal lines
    ],
  };

  // Wait, better to just query the original journal to find the AR account
  const { journalLines } = await import('@erp/db/schema/accounting');
  const originalLines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, invoice.journalId!));
  // Sales invoice: AR line has a debit equal to invoice.total (full amount on the partner line).
  // Purchase invoice: AP line has a credit equal to invoice.total. We identify the partner
  // line by amount match rather than by account type to avoid ambiguity.
  const partnerLine = originalLines.find((l) =>
    invoice.type === 'sales'
      ? l.debit === invoice.total && l.credit === 0n
      : l.credit === invoice.total && l.debit === 0n,
  );

  if (!partnerLine) return err(AppError.internal('invoice.partnerLineNotFound'));

  journalInput.lines.push({
    accountId: partnerLine.accountId,
    locationId: invoice.locationId,
    description: `Clear AR/AP for Invoice ${invoice.number}`,
    debit: invoice.type === 'purchase' ? amountToPay.toString() : '0',
    credit: invoice.type === 'sales' ? amountToPay.toString() : '0',
  });

  const createRes = await createJournal(journalInput, ctx, { skipPermissionCheck: true });
  if (!createRes.ok) return createRes;
  const paymentJournalId = createRes.value.id;

  const postRes = await postJournal({ journalId: paymentJournalId }, ctx);
  if (!postRes.ok) return postRes;

  const newAmountPaid = invoice.amountPaid + amountToPay;
  const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partial';

  await db
    .update(invoices)
    .set({
      status: newStatus,
      amountPaid: newAmountPaid,
      paymentJournalId,
      updatedBy: ctx.userId,
    })
    .where(eq(invoices.id, invoiceId));

  await auditRecord({
    action: 'update',
    entityType: 'invoice',
    entityId: invoiceId,
    before: { status: invoice.status, amountPaid: invoice.amountPaid.toString() },
    after: { status: newStatus, amountPaid: newAmountPaid.toString(), paymentJournalId },
    ctx,
  });

  return ok({ success: true, paymentJournalId });
}
