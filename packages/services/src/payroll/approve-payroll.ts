/**
 * approvePayroll — SD §21.8 §Payroll Run
 *
 * After director approves a draft payroll:
 * 1. Validate payroll is draft/pending_approval
 * 2. Create journal entry: Salaries Expense DR, BPJS/PPh Payable CR, Cash CR
 * 3. Update payroll status to approved + set journalEntryId
 *
 * markPayrollPaid: updates status to paid after cash disbursement.
 */

import { db } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { payrollLines, payrolls, salaryComponents } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createJournal } from '../accounting/create-journal';
import { postJournal } from '../accounting/post-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { reverseJournal } from '../accounting/reverse-journal';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export const ApprovePayrollInputSchema = z.object({
  payrollId: z.string().min(1),
  description: z.string().optional(),
});

export const MarkPaidInputSchema = z.object({
  payrollId: z.string().min(1),
});

export const CancelPayrollInputSchema = z.object({
  payrollId: z.string().min(1),
  reason: z.string().min(1),
});

export type ApprovePayrollInput = z.infer<typeof ApprovePayrollInputSchema>;
export type MarkPaidInput = z.infer<typeof MarkPaidInputSchema>;
export type CancelPayrollInput = z.infer<typeof CancelPayrollInputSchema>;

function isEmployerContribution(line: {
  componentCode: string;
  line: { notes?: string | null };
}): boolean {
  const notes = line.line.notes?.toLowerCase() ?? '';
  return (
    line.componentCode.endsWith('_ER') || notes.includes('employer') || notes.includes('perusahaan')
  );
}

// ─── Approve ────────────────────────────────────────────────────────────────

export async function approvePayroll(
  input: ApprovePayrollInput,
  ctx: AuditContext,
): Promise<Result<{ payrollId: string; journalEntryId: string }>> {
  const parsed = ApprovePayrollInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.payroll.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  try {
    const [payroll] = await db
      .select()
      .from(payrolls)
      .where(and(eq(payrolls.tenantId, ctx.tenantId), eq(payrolls.id, data.payrollId)))
      .limit(1);

    if (!payroll) {
      throw AppError.notFound('hr.payroll.notFound', { payrollId: data.payrollId });
    }

    // Permission scoped to the payroll's outlet — a director currently
    // checked in at outlet B cannot approve outlet A's payroll without
    // explicit permission there.
    const permCheck = await requirePermission(ctx.userId, 'hr.payroll.approve', {
      locationId: payroll.locationId,
    });
    if (!permCheck.ok) {
      throw permCheck.error;
    }

    if (payroll.status !== 'draft' && payroll.status !== 'pending_approval') {
      throw AppError.conflict('hr.payroll.cannotApprove', { status: payroll.status });
    }

    // Load payroll lines joined with salary components (to get componentCode)
    const lines = await db
      .select({
        line: payrollLines,
        componentCode: salaryComponents.code,
        componentKind: salaryComponents.kind,
      })
      .from(payrollLines)
      .innerJoin(salaryComponents, eq(payrollLines.salaryComponentId, salaryComponents.id))
      .where(eq(payrollLines.payrollId, data.payrollId));

    if (lines.length === 0) {
      throw AppError.validation('hr.payroll.noLines', { payrollId: data.payrollId });
    }

    // Aggregate earnings and deductions
    let totalEarnings = 0n;
    let totalEmployeeDeductions = 0n;
    let totalPPh21 = 0n;
    let totalBpjsKes = 0n;
    let totalBpjsTk = 0n;
    // T-0243: employer BPJS
    let totalBpjsKesEmployer = 0n;
    let totalBpjsJkkEmployer = 0n;
    let totalBpjsJkmEmployer = 0n;
    let totalBpjsJhtEmployer = 0n;
    let totalBpjsJpEmployer = 0n;

    for (const row of lines) {
      if (row.componentKind === 'earning') {
        totalEarnings += row.line.amount;
      }
      const employerContribution = isEmployerContribution(row);
      if (row.componentKind === 'deduction' && !employerContribution) {
        totalEmployeeDeductions += row.line.amount;
      }
      if (row.componentCode === 'PPh21') totalPPh21 += row.line.amount;
      if (row.componentCode === 'BPJS_KES') {
        if (employerContribution) {
          totalBpjsKesEmployer += row.line.amount;
        } else {
          totalBpjsKes += row.line.amount;
        }
      }
      if (row.componentCode === 'BPJS_TK') {
        if (employerContribution) {
          const notes = row.line.notes?.toLowerCase() ?? '';
          // Aggregate all employer TK components
          if (notes.includes('jkk')) totalBpjsJkkEmployer += row.line.amount;
          else if (notes.includes('jkm')) totalBpjsJkmEmployer += row.line.amount;
          else if (notes.includes('jht')) totalBpjsJhtEmployer += row.line.amount;
          else if (notes.includes('jp')) totalBpjsJpEmployer += row.line.amount;
          else totalBpjsJhtEmployer += row.line.amount; // fallback
        } else {
          totalBpjsTk += row.line.amount;
        }
      }
    }

    const totalEmployerBpjs =
      totalBpjsKesEmployer +
      totalBpjsJkkEmployer +
      totalBpjsJkmEmployer +
      totalBpjsJhtEmployer +
      totalBpjsJpEmployer;
    const statutoryEmployeeDeductions = totalPPh21 + totalBpjsKes + totalBpjsTk;
    const nonStatutoryDeductions = totalEmployeeDeductions - statutoryEmployeeDeductions;
    const expectedNet = totalEarnings - totalEmployeeDeductions;

    if (
      totalEarnings !== payroll.totalEarnings ||
      totalEmployeeDeductions !== payroll.totalDeductions ||
      expectedNet !== payroll.totalNet ||
      nonStatutoryDeductions < 0n
    ) {
      throw AppError.businessRule('hr.payroll.headerLinesMismatch', {
        payrollId: data.payrollId,
        lineEarnings: totalEarnings.toString(),
        headerEarnings: payroll.totalEarnings.toString(),
        lineDeductions: totalEmployeeDeductions.toString(),
        headerDeductions: payroll.totalDeductions.toString(),
        expectedNet: expectedNet.toString(),
        headerNet: payroll.totalNet.toString(),
      });
    }

    // Posting accounts come from the configurable account map
    // (Settings → Accounting → Account Mapping); see accounting/posting-accounts.ts.
    // Defaults: salary→6-2000, PPh21→2-1300, BPJS→2-1200, net pay→1-1300.
    const acctCodes = await getPostingAccountCodes(ctx.tenantId);
    const salaryExpenseCode = acctCodes['payroll.salaryExpense'];
    const taxPayableCode = acctCodes['payroll.taxPayable'];
    const bpjsPayableCode = acctCodes['payroll.bpjsPayable'];
    const netPayCode = acctCodes['payroll.netPay'];

    const accountCodes = [salaryExpenseCode, taxPayableCode, bpjsPayableCode, netPayCode];
    const acctRows = await db
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(and(eq(accounts.tenantId, ctx.tenantId), inArray(accounts.code, accountCodes)));

    const acctMap = new Map(acctRows.map((r) => [r.code, r.id]));

    const getAccountId = (code: string): string => {
      const id = acctMap.get(code);
      if (!id) throw AppError.internal('hr.payroll.missingAccount', { code });
      return id as string;
    };

    // Posting date: periodEnd in YYYY-MM-DD
    const periodEndStr: string = payroll.periodEnd
      ? new Date(payroll.periodEnd).toISOString().split('T')[0]!
      : new Date().toISOString().split('T')[0]!;

    const journalEntryId = await db.transaction(async (tx) => {
      const journalResult = await createJournal(
        {
          postingDate: periodEndStr,
          locationId: payroll.locationId,
          description: data.description ?? `Payroll ${payroll.periodCode}`,
          referenceType: 'payroll',
          referenceId: data.payrollId,
          lines: [
            // DR: Salary Expense (employee earnings)
            {
              accountId: getAccountId(salaryExpenseCode),
              locationId: payroll.locationId,
              debit: String(payroll.totalEarnings),
              credit: '0',
              description: 'Beban Gaji & Upah',
            },
            // T-0243: DR: Employer BPJS Expense
            ...(totalEmployerBpjs > 0n
              ? [
                  {
                    accountId: getAccountId(salaryExpenseCode),
                    locationId: payroll.locationId,
                    debit: String(totalEmployerBpjs),
                    credit: '0',
                    description: 'Beban BPJS Pemberi Kerja (Kes 4% + JKK + JKM + JHT 3.7% + JP 2%)',
                  },
                ]
              : []),
            ...(totalPPh21 > 0n
              ? [
                  {
                    accountId: getAccountId(taxPayableCode),
                    locationId: payroll.locationId,
                    debit: '0',
                    credit: String(totalPPh21),
                    description: 'PPh 21 Terutang',
                  },
                ]
              : []),
            // CR: BPJS Kes payable (employee + employer)
            ...(totalBpjsKes + totalBpjsKesEmployer > 0n
              ? [
                  {
                    accountId: getAccountId(bpjsPayableCode),
                    locationId: payroll.locationId,
                    debit: '0',
                    credit: String(totalBpjsKes + totalBpjsKesEmployer),
                    description: `Utang BPJS Kesehatan (EE ${totalBpjsKes} + ER ${totalBpjsKesEmployer})`,
                  },
                ]
              : []),
            // CR: BPJS TK payable (employee JHT + employer JKK/JKM/JHT/JP)
            ...(totalBpjsTk +
              totalBpjsJkkEmployer +
              totalBpjsJkmEmployer +
              totalBpjsJhtEmployer +
              totalBpjsJpEmployer >
            0n
              ? [
                  {
                    accountId: getAccountId(bpjsPayableCode),
                    locationId: payroll.locationId,
                    debit: '0',
                    credit: String(
                      totalBpjsTk +
                        totalBpjsJkkEmployer +
                        totalBpjsJkmEmployer +
                        totalBpjsJhtEmployer +
                        totalBpjsJpEmployer,
                    ),
                    description: `Utang BPJS TK (EE JHT ${totalBpjsTk} + ER JKK/JKM/JHT/JP ${totalBpjsJkkEmployer + totalBpjsJkmEmployer + totalBpjsJhtEmployer + totalBpjsJpEmployer})`,
                  },
                ]
              : []),
            // CR: Non-statutory deductions reduce salary expense until component-level
            // posting accounts are introduced.
            ...(nonStatutoryDeductions > 0n
              ? [
                  {
                    accountId: getAccountId(salaryExpenseCode),
                    locationId: payroll.locationId,
                    debit: '0',
                    credit: String(nonStatutoryDeductions),
                    description: 'Potongan Payroll Non-Statutory',
                  },
                ]
              : []),
            // CR: Cash/Bank (net salary disbursement)
            {
              accountId: getAccountId(netPayCode),
              locationId: payroll.locationId,
              debit: '0',
              credit: String(payroll.totalNet),
              description: 'Pembayaran Gaji',
            },
          ],
        },
        ctx,
        { skipPermissionCheck: true, tx },
      );

      if (!journalResult.ok) {
        throw AppError.internal('hr.payroll.jeFailed', { error: journalResult.error });
      }

      const postResult = await postJournal({ journalId: journalResult.value.id }, ctx, {
        skipPermissionCheck: true,
        tx,
      });
      if (!postResult.ok) {
        throw AppError.internal('hr.payroll.jeFailed', { error: postResult.error });
      }

      // Atomic claim — without this, two concurrent approvers each post a
      // full salary expense journal entry, DOUBLING reported payroll cost.
      // The claim guard transitions only from draft/pending_approval and
      // returns rows so we can detect race losers.
      const approvedAt = new Date();
      const claimed = await tx
        .update(payrolls)
        .set({
          status: 'approved',
          approvedBy: ctx.userId,
          approvedAt,
          journalEntryId: journalResult.value.id,
          updatedBy: ctx.userId,
          updatedAt: approvedAt,
        })
        .where(and(eq(payrolls.id, data.payrollId), eq(payrolls.status, payroll.status)))
        .returning({ id: payrolls.id });
      if (!claimed || claimed.length === 0) {
        throw AppError.conflict('hr.payroll.cannotApprove', { status: payroll.status });
      }

      await auditRecord({
        action: 'approve',
        entityType: 'payroll',
        entityId: data.payrollId,
        before: { status: payroll.status },
        after: {
          status: 'approved',
          approvedBy: ctx.userId,
          approvedAt: approvedAt.toISOString(),
          journalEntryId: journalResult.value.id,
          journalEntryStatus: 'posted',
          totalEarnings: payroll.totalEarnings.toString(),
          totalDeductions: payroll.totalDeductions.toString(),
          totalNet: payroll.totalNet.toString(),
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
        tx,
      });

      return journalResult.value.id;
    });

    return ok({ payrollId: data.payrollId, journalEntryId });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.payroll.approveFailed', e));
  }
}

// ─── Mark Paid ─────────────────────────────────────────────────────────────

export async function markPayrollPaid(
  input: MarkPaidInput,
  ctx: AuditContext,
): Promise<Result<{ payrollId: string }>> {
  try {
    const [payroll] = await db
      .select()
      .from(payrolls)
      .where(and(eq(payrolls.id, input.payrollId), eq(payrolls.tenantId, ctx.tenantId)))
      .limit(1);

    if (!payroll) throw AppError.notFound('hr.payroll.notFound', { payrollId: input.payrollId });

    const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', {
      locationId: payroll.locationId,
    });
    if (!permCheck.ok) {
      throw permCheck.error;
    }

    if (payroll.status !== 'approved') {
      throw AppError.conflict('hr.payroll.cannotMarkPaid', { status: payroll.status });
    }

    const claimed = await db
      .update(payrolls)
      .set({ status: 'paid', updatedBy: ctx.userId })
      .where(and(eq(payrolls.id, input.payrollId), eq(payrolls.status, 'approved')))
      .returning({ id: payrolls.id });
    if (!claimed || claimed.length === 0) {
      throw AppError.conflict('hr.payroll.cannotMarkPaid', { status: payroll.status });
    }

    await auditRecord({
      action: 'mark_paid',
      entityType: 'payroll',
      entityId: input.payrollId,
      before: { status: 'approved' },
      after: { status: 'paid' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ payrollId: input.payrollId });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.payroll.markPaidFailed', e));
  }
}

// ─── Cancel Payroll ────────────────────────────────────────────────────────

export async function cancelPayroll(
  input: CancelPayrollInput,
  ctx: AuditContext,
): Promise<Result<{ payrollId: string }>> {
  const parsed = CancelPayrollInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.payroll.validationFailed', { issues: parsed.error.issues }));
  }

  try {
    const [payroll] = await db
      .select()
      .from(payrolls)
      .where(and(eq(payrolls.id, input.payrollId), eq(payrolls.tenantId, ctx.tenantId)))
      .limit(1);

    if (!payroll) throw AppError.notFound('hr.payroll.notFound', { payrollId: input.payrollId });

    const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', {
      locationId: payroll.locationId,
    });
    if (!permCheck.ok) {
      throw permCheck.error;
    }

    if (payroll.status === 'cancelled') {
      throw AppError.conflict('hr.payroll.cannotCancel', { status: payroll.status });
    }

    if (payroll.journalEntryId) {
      const reverseRes = await reverseJournal(
        {
          journalId: payroll.journalEntryId,
          postingDate: new Date().toISOString().split('T')[0]!,
        },
        ctx,
        { skipPermissionCheck: true },
      );

      if (!reverseRes.ok) {
        return err(AppError.internal('hr.payroll.cancelFailed', { error: reverseRes.error }));
      }
    }

    const claimed = await db
      .update(payrolls)
      .set({ status: 'cancelled', updatedBy: ctx.userId })
      .where(and(eq(payrolls.id, input.payrollId), eq(payrolls.status, payroll.status)))
      .returning({ id: payrolls.id });

    if (!claimed || claimed.length === 0) {
      throw AppError.conflict('hr.payroll.cannotCancel', { status: payroll.status });
    }

    await auditRecord({
      action: 'cancel',
      entityType: 'payroll',
      entityId: input.payrollId,
      before: { status: payroll.status },
      after: { status: 'cancelled', reason: input.reason },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ payrollId: input.payrollId });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.payroll.cancelFailed', e));
  }
}
