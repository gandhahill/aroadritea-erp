/**
 * runPayroll — SD §21.8 §Payroll Run
 *
 * Creates a payroll run for a period/location:
 * 1. Fetch all active employees for the location
 * 2. Fetch attendance records for the period (late minutes, absent days)
 * 3. For each employee: calculate payroll via payroll-engine
 * 4. Insert payrolls header + payroll_lines
 *
 * Permission: hr.payroll.write
 */

import { db } from '@erp/db';
import {
  attendance,
  employees,
  employmentContracts,
  payrollLines,
  payrolls,
  salaryComponents,
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { type PayrollEmployeeContext, calculatePayroll } from './payroll-engine';

export const RunPayrollInputSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  locationId: z.string().min(1),
});

export type RunPayrollInput = z.infer<typeof RunPayrollInputSchema>;

export interface RunPayrollResult {
  payrollId: string;
  periodCode: string;
  totalEmployees: number;
  totalEarnings: bigint;
  totalDeductions: bigint;
  totalNet: bigint;
}

export async function runPayroll(
  input: RunPayrollInput,
  ctx: AuditContext,
): Promise<Result<RunPayrollResult>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = RunPayrollInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.payroll.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      // 1. Check for duplicate payroll run for this period/location
      const [existing] = await db
        .select({ id: payrolls.id })
        .from(payrolls)
        .where(
          and(
            eq(payrolls.tenantId, ctx.tenantId),
            eq(payrolls.periodCode, data.periodCode),
            eq(payrolls.locationId, data.locationId),
          ),
        )
        .limit(1);

      if (existing) {
        throw AppError.conflict('hr.payroll.alreadyRun', {
          periodCode: data.periodCode,
          locationId: data.locationId,
        });
      }

      // 2. Fetch active employees with current contracts
      const empRows = await db
        .select({
          id: employees.id,
          name: employees.name,
          status: employees.status,
          currentContractId: employees.currentContractId,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, ctx.tenantId),
            eq(employees.locationId, data.locationId),
            eq(employees.status, 'active'),
          ),
        );

      if (empRows.length === 0) {
        throw AppError.validation('hr.payroll.noEmployees', { locationId: data.locationId });
      }

      // 3. Fetch active contracts
      const contractIds = empRows
        .map((e) => e.currentContractId)
        .filter((id): id is string => id !== null);
      let contractMap: Map<string, bigint> = new Map();
      if (contractIds.length > 0) {
        const contracts = await db
          .select({ id: employmentContracts.id, baseSalary: employmentContracts.baseSalary })
          .from(employmentContracts)
          .where(
            and(
              eq(employmentContracts.tenantId, ctx.tenantId),
              eq(employmentContracts.isActive, true),
              sql`${employmentContracts.id} = ANY(${contractIds})`,
            ),
          );
        contractMap = new Map(contracts.map((c) => [c.id, c.baseSalary]));
      }

      // 4. Fetch salary components (for reference)
      const components = await db
        .select({
          id: salaryComponents.id,
          code: salaryComponents.code,
          kind: salaryComponents.kind,
          fixedAmount: salaryComponents.fixedAmount,
          percentage: salaryComponents.percentage,
          isTaxable: salaryComponents.isTaxable,
          isBpjsBase: salaryComponents.isBpjsBase,
          name: salaryComponents.name,
        })
        .from(salaryComponents)
        .where(eq(salaryComponents.tenantId, ctx.tenantId));

      const componentMap = new Map(components.map((c) => [c.code, c]));

      // 5. Fetch attendance for the period
      const periodStart = new Date(data.periodStart);
      const periodEnd = new Date(data.periodEnd);
      const attRows = await db
        .select({
          employeeId: attendance.employeeId,
          lateMinutes: sql<number>`coalesce(sum(${attendance.lateMinutes}), 0)`,
          absentDays: sql<number>`count(case when ${attendance.checkInAt} is null then 1 end)`,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.tenantId, ctx.tenantId),
            eq(attendance.locationId, data.locationId),
            sql`${attendance.checkInAt} >= ${periodStart}`,
            sql`${attendance.checkInAt} <= ${periodEnd}`,
          ),
        )
        .groupBy(attendance.employeeId);

      const attMap = new Map(
        attRows.map((a) => [
          a.employeeId,
          {
            lateMinutes: a.lateMinutes,
            absentDays: a.absentDays,
          },
        ]),
      );

      // 6. Calculate payroll for each employee
      let totalEarnings = 0n;
      let totalDeductions = 0n;
      let totalNet = 0n;
      const allLines: Array<{
        id: string;
        tenantId: string;
        payrollId: string;
        employeeId: string;
        salaryComponentId: string;
        amount: bigint;
        baseAmount: bigint;
        percentageApplied: string | null;
        componentKind: string;
        notes: string;
        createdBy: string;
        updatedBy: string;
      }> = [];

      for (const emp of empRows) {
        const baseSalary = contractMap.get(emp.currentContractId ?? '') ?? 0n;
        const att = attMap.get(emp.id) ?? { lateMinutes: 0, absentDays: 0 };

        const payrollCtx: PayrollEmployeeContext = {
          employeeId: emp.id,
          baseSalary,
          isBpjsBase: true,
          isTaxable: true,
          dependentsCount: 0,
          additionalEarnings: [],
          lateMinutes: att.lateMinutes,
          absentCount: att.absentDays,
        };

        const result = calculatePayroll(payrollCtx);

        totalEarnings += result.totalEarnings;
        totalDeductions += result.totalDeductions;
        totalNet += result.netSalary;

        // Build payroll lines
        for (const line of result.lines) {
          const comp = componentMap.get(line.componentCode);
          allLines.push({
            id: generateId(),
            tenantId: ctx.tenantId,
            payrollId: '', // set below
            employeeId: emp.id,
            salaryComponentId: comp?.id ?? '',
            amount: line.amount,
            baseAmount: line.baseAmount,
            percentageApplied:
              line.percentageApplied != null
                ? String(line.percentageApplied)
                : (null as string | null),
            componentKind: line.componentKind,
            notes: line.notes,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
        }
      }

      // 7. Insert payroll header
      const payrollId = generateId();
      await db.insert(payrolls).values({
        id: payrollId,
        tenantId: ctx.tenantId,
        locationId: data.locationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        periodCode: data.periodCode,
        periodStart: periodStart,
        periodEnd: periodEnd,
        status: 'draft',
        totalEmployees: empRows.length,
        totalEarnings,
        totalDeductions,
        totalNet,
      });

      // 8. Insert payroll lines
      for (const line of allLines) {
        line.payrollId = payrollId;
      }
      await db.insert(payrollLines).values(allLines);

      return {
        payrollId,
        periodCode: data.periodCode,
        totalEmployees: empRows.length,
        totalEarnings,
        totalDeductions,
        totalNet,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.payroll.runFailed', e);
    },
  );
}
