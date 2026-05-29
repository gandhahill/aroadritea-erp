import { db } from '@erp/db';
import { payrolls, payrollLines, employmentContracts, attendance, cashAdvances, salaryComponents } from '@erp/db/schema/hr';
import { accounts } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';

export const RunPayrollInputSchema = z.object({
  locationId: z.string().min(1),
  periodCode: z.string().regex(/^\d{4}-\d{2}$/), // e.g. "2026-05"
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

export type RunPayrollInput = z.infer<typeof RunPayrollInputSchema>;

export async function generatePayrollRun(input: RunPayrollInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = RunPayrollInputSchema.safeParse(input);
  if (!parsed.success) return err(new Error(parsed.error.message));

  const permCheck = await requirePermission(ctx.userId, 'hr.manage_payroll', { locationId: input.locationId });
  if (!permCheck.ok) return permCheck;

  // Find active contracts in location
  const contracts = await db
    .select()
    .from(employmentContracts)
    .where(and(eq(employmentContracts.locationId, input.locationId), eq(employmentContracts.isActive, true)));

  if (contracts.length === 0) return err(AppError.businessRule('hr.payroll.no_employees'));

  // Get base salary component
  const [baseComponent] = await db
    .select()
    .from(salaryComponents)
    .where(and(eq(salaryComponents.code, 'SALARY_BASE'), eq(salaryComponents.tenantId, ctx.tenantId)));

  const baseComponentId = baseComponent ? baseComponent.id : 'base-salary-comp-id';

  let totalEarnings = 0n;
  let totalDeductions = 0n;
  let totalNet = 0n;

  const linesToInsert = [];

  const payrollId = generateId();

  for (const contract of contracts) {
    let employeeNet = 0n;
    let employeeEarning = 0n;
    let employeeDeduction = 0n;

    // 1. Base Salary
    const baseSalary = contract.baseSalary;
    employeeEarning += baseSalary;
    linesToInsert.push({
      id: generateId(),
      tenantId: ctx.tenantId,
      payrollId,
      employeeId: contract.employeeId,
      salaryComponentId: baseComponentId,
      amount: baseSalary,
      componentKind: 'earning',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // 2. Attendance Late Penalty
    // Simplification: calculate late minutes
    const attRecords = await db
      .select({ lateMinutes: attendance.lateMinutes })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, contract.employeeId),
          sql`${attendance.checkInAt} >= ${new Date(input.periodStart)}`,
          sql`${attendance.checkInAt} <= ${new Date(input.periodEnd)}`,
          eq(attendance.lateForgiven, false)
        )
      );
    
    let totalLateMin = 0;
    for (const r of attRecords) totalLateMin += r.lateMinutes;

    if (totalLateMin > 0) {
      // e.g. Rp 1.000 per late minute
      const lateDeduction = BigInt(totalLateMin * 1000);
      employeeDeduction += lateDeduction;
      linesToInsert.push({
        id: generateId(),
        tenantId: ctx.tenantId,
        payrollId,
        employeeId: contract.employeeId,
        salaryComponentId: 'late-penalty-comp-id', // Placeholder, in real world find POTONGAN_TELAT
        amount: lateDeduction,
        componentKind: 'deduction',
        notes: `${totalLateMin} mins late`,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // 3. Kasbon Auto-Deduction
    const pendingKasbons = await db
      .select()
      .from(cashAdvances)
      .where(and(eq(cashAdvances.employeeId, contract.employeeId), eq(cashAdvances.status, 'approved')));

    for (const kasbon of pendingKasbons) {
      employeeDeduction += kasbon.amount;
      linesToInsert.push({
        id: generateId(),
        tenantId: ctx.tenantId,
        payrollId,
        employeeId: contract.employeeId,
        salaryComponentId: 'kasbon-deduction-comp-id',
        amount: kasbon.amount,
        componentKind: 'deduction',
        notes: `Kasbon deduction ${kasbon.id}`,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      // In real implementation we'd also update Kasbon status to 'deducted' after payroll is approved
    }

    employeeNet = employeeEarning - employeeDeduction;
    if (employeeNet < 0n) employeeNet = 0n;

    totalEarnings += employeeEarning;
    totalDeductions += employeeDeduction;
    totalNet += employeeNet;
  }

  await db.insert(payrolls).values({
    id: payrollId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    periodCode: input.periodCode,
    periodStart: new Date(input.periodStart),
    periodEnd: new Date(input.periodEnd),
    totalEmployees: contracts.length,
    totalEarnings,
    totalDeductions,
    totalNet,
    status: 'draft',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  if (linesToInsert.length > 0) {
    await db.insert(payrollLines).values(linesToInsert);
  }

  return ok({ id: payrollId });
}

export async function approvePayroll(payrollId: string, expenseAccountId: string, cashAccountId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const [payroll] = await db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.tenantId, ctx.tenantId)));

  if (!payroll) return err(AppError.notFound('hr.payroll.not_found'));
  if (payroll.status !== 'draft') return err(AppError.businessRule('hr.payroll.not_draft'));

  const permCheck = await requirePermission(ctx.userId, 'hr.manage_payroll', { locationId: payroll.locationId });
  if (!permCheck.ok) return permCheck;

  // Auto-journal
  const jeResult = await createJournal(
    {
      postingDate: new Date().toISOString().split('T')[0] as string,
      locationId: payroll.locationId,
      description: `Payroll Run ${payroll.periodCode}`,
      referenceType: 'payroll',
      referenceId: payrollId,
      lines: [
        {
          accountId: expenseAccountId,
          locationId: payroll.locationId,
          description: `Salaries Expense`,
          debit: payroll.totalEarnings.toString(),
          credit: '0',
        },
        {
          accountId: cashAccountId, // Or Salaries Payable
          locationId: payroll.locationId,
          description: `Net Salary Paid`,
          debit: '0',
          credit: payroll.totalNet.toString(),
        },
        // We'd add other accounts for deductions (like kasbon receivable)
        // to balance the journal (totalEarnings = totalNet + totalDeductions).
        // Since we are mocking the deduction accounts for now, we just add the deduction to cash account for simplicity
        // In real world, we'd iterate payroll lines and group by component account.
        ...(payroll.totalDeductions > 0n ? [{
          accountId: 'kasbon-receivable-account', // placeholder
          locationId: payroll.locationId,
          description: `Payroll Deductions`,
          debit: '0',
          credit: payroll.totalDeductions.toString(),
        }] : []),
      ],
    },
    ctx
  );

  if (!jeResult.ok) return jeResult;

  await db
    .update(payrolls)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      journalEntryId: jeResult.value.id,
      updatedBy: ctx.userId,
    })
    .where(eq(payrolls.id, payrollId));
    
  // Update kasbon status
  const lines = await db.select().from(payrollLines).where(eq(payrollLines.payrollId, payrollId));
  for (const line of lines) {
    if (line.salaryComponentId === 'kasbon-deduction-comp-id' && line.notes?.includes('Kasbon deduction')) {
      const kasbonId = line.notes.replace('Kasbon deduction ', '');
      await db.update(cashAdvances).set({ status: 'deducted' }).where(eq(cashAdvances.id, kasbonId));
    }
  }

  return ok({ id: payrollId });
}
