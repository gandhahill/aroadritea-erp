/**
 * runPayroll — SD §21.8 §Payroll Run
 *
 * Creates a payroll run for a period/location:
 * 1. Fetch all active employees for the location
 * 2. Fetch attendance records for the period (late minutes, absent days)
 * 3. T-0245: Detect absences from shift_assignments vs attendance
 * 4. For each employee: calculate payroll via payroll-engine
 * 5. Insert payrolls header + payroll_lines
 *
 * Permission: hr.payroll.write
 */

import { db } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import {
  attendance,
  employees,
  employmentContracts,
  payrollLines,
  payrolls,
  salaryComponents,
  shiftAssignments,
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  type AttendancePolicy,
  DEFAULT_ATTENDANCE_POLICY,
  type PayrollEmployeeContext,
  calculatePayroll,
} from './payroll-engine';

export const ATTENDANCE_POLICY_SETTING_KEY = 'attendance.policy';

async function loadAttendancePolicy(tenantId: string): Promise<AttendancePolicy> {
  try {
    const row = await db
      .select({ value: cmsSettings.value })
      .from(cmsSettings)
      .where(
        and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, ATTENDANCE_POLICY_SETTING_KEY)),
      )
      .limit(1);
    const raw = row[0]?.value as Record<string, unknown> | null | undefined;
    if (!raw) return DEFAULT_ATTENDANCE_POLICY;
    const latePenalty =
      typeof raw.latePenalty === 'number' && raw.latePenalty >= 0
        ? BigInt(Math.round(raw.latePenalty))
        : DEFAULT_ATTENDANCE_POLICY.latePenalty;
    const freeLatesPerMonth =
      typeof raw.freeLatesPerMonth === 'number' && raw.freeLatesPerMonth >= 0
        ? Math.trunc(raw.freeLatesPerMonth)
        : DEFAULT_ATTENDANCE_POLICY.freeLatesPerMonth;
    const absentPenalty =
      typeof raw.absentPenalty === 'number' && raw.absentPenalty >= 0
        ? BigInt(Math.round(raw.absentPenalty))
        : DEFAULT_ATTENDANCE_POLICY.absentPenalty;
    return { latePenalty, freeLatesPerMonth, absentPenalty };
  } catch {
    return DEFAULT_ATTENDANCE_POLICY;
  }
}

export const RunPayrollInputSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  locationId: z.string().min(1),
  additionalEarnings: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        componentCode: z.string().min(1).max(64).default('BONUS'),
        amount: z.string().regex(/^[1-9]\d*$/),
        notes: z.string().max(240).optional(),
      }),
    )
    .optional()
    .default([]),
  additionalDeductions: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        componentCode: z.string().min(1).max(64).default('PINJAMAN'),
        amount: z.string().regex(/^[1-9]\d*$/),
        notes: z.string().max(240).optional(),
      }),
    )
    .optional()
    .default([]),
});

export type RunPayrollInput = z.input<typeof RunPayrollInputSchema>;

export interface RunPayrollResult {
  payrollId: string;
  periodCode: string;
  totalEmployees: number;
  totalEarnings: bigint;
  totalDeductions: bigint;
  totalNet: bigint;
  /** T-0243: total employer BPJS expense (not deducted from employee net) */
  totalEmployerBpjs: bigint;
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
      const attendancePolicy = await loadAttendancePolicy(ctx.tenantId);

      // 1. Check for duplicate payroll run for this period/location
      const [existing] = await db
        .select({ id: payrolls.id, status: payrolls.status })
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
        if (existing.status !== 'draft') {
          throw AppError.conflict('hr.payroll.alreadyRun', {
            periodCode: data.periodCode,
            locationId: data.locationId,
          });
        }
        
        // T-0257: Allow recalculating draft
        await db.delete(payrollLines).where(eq(payrollLines.payrollId, existing.id));
        await db.delete(payrolls).where(eq(payrolls.id, existing.id));
      }

      // 2. Fetch active employees with current contracts + tax/BPJS data (T-0247)
      const empRows = await db
        .select({
          id: employees.id,
          name: employees.name,
          status: employees.status,
          currentContractId: employees.currentContractId,
          maritalStatus: employees.maritalStatus,
          dependentsCount: employees.dependentsCount,
          isBpjsBase: employees.isBpjsBase,
          isTaxable: employees.isTaxable,
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
      const employeeIdSet = new Set(empRows.map((employee) => employee.id));

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
          isActive: salaryComponents.isActive,
          name: salaryComponents.name,
        })
        .from(salaryComponents)
        .where(eq(salaryComponents.tenantId, ctx.tenantId));

      const componentMap = new Map(components.map((c) => [c.code, c]));
      const getComponent = (code: string) => {
        const component = componentMap.get(code);
        if (!component || !component.isActive) {
          throw AppError.internal('hr.payroll.missingSalaryComponent', { code });
        }
        return component;
      };
      for (const code of ['SALARY_BASE', 'PPh21', 'BPJS_KES', 'BPJS_TK']) {
        getComponent(code);
      }

      const additionalEarningsByEmployeeId = new Map<
        string,
        Array<{
          code: string;
          amount: bigint;
          isTaxable: boolean;
          isBpjsBase: boolean;
          notes?: string;
        }>
      >();
      for (const earning of data.additionalEarnings) {
        if (!employeeIdSet.has(earning.employeeId)) {
          throw AppError.validation('hr.payroll.adjustmentEmployeeNotInLocation', {
            employeeId: earning.employeeId,
            locationId: data.locationId,
          });
        }
        const component = getComponent(earning.componentCode);
        if (component.kind !== 'earning') {
          throw AppError.validation('hr.payroll.invalidAdditionalEarningComponent', {
            componentCode: earning.componentCode,
          });
        }
        const list = additionalEarningsByEmployeeId.get(earning.employeeId) ?? [];
        list.push({
          code: component.code,
          amount: BigInt(earning.amount),
          isTaxable: component.isTaxable,
          isBpjsBase: component.isBpjsBase,
          notes: earning.notes,
        });
        additionalEarningsByEmployeeId.set(earning.employeeId, list);
      }

      const additionalDeductionsByEmployeeId = new Map<
        string,
        Array<{
          code: string;
          amount: bigint;
          notes?: string;
        }>
      >();
      for (const deduction of data.additionalDeductions) {
        if (!employeeIdSet.has(deduction.employeeId)) {
          throw AppError.validation('hr.payroll.adjustmentEmployeeNotInLocation', {
            employeeId: deduction.employeeId,
            locationId: data.locationId,
          });
        }
        const component = getComponent(deduction.componentCode);
        if (component.kind !== 'deduction') {
          throw AppError.validation('hr.payroll.invalidAdditionalDeductionComponent', {
            componentCode: deduction.componentCode,
          });
        }
        const list = additionalDeductionsByEmployeeId.get(deduction.employeeId) ?? [];
        list.push({
          code: component.code,
          amount: BigInt(deduction.amount),
          notes: deduction.notes,
        });
        additionalDeductionsByEmployeeId.set(deduction.employeeId, list);
      }

      // 5. Fetch attendance for the period
      const periodStart = new Date(data.periodStart);
      const periodEnd = new Date(data.periodEnd);
      const attRows = await db
        .select({
          employeeId: attendance.employeeId,
          lateMinutes: sql<number>`coalesce(sum(case when ${attendance.lateForgiven} then 0 else ${attendance.lateMinutes} end), 0)`,
          lateCount: sql<number>`cast(count(case when ${attendance.isLate} and not ${attendance.lateForgiven} then 1 end) as int)`,
          attendanceDays: sql<number>`cast(count(distinct date(${attendance.checkInAt})) as int)`,
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
            lateCount: a.lateCount,
            attendanceDays: a.attendanceDays,
          },
        ]),
      );

      // T-0245: Count scheduled shift days per employee from shift_assignments
      const periodStartDate = data.periodStart.split('T')[0]!;
      const periodEndDate = data.periodEnd.split('T')[0]!;
      const shiftCountRows = await db
        .select({
          employeeId: shiftAssignments.employeeId,
          scheduledDays: sql<number>`cast(count(*) as int)`,
        })
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.tenantId, ctx.tenantId),
            eq(shiftAssignments.locationId, data.locationId),
            eq(shiftAssignments.kind, 'shift'),
            sql`${shiftAssignments.workDate} >= ${periodStartDate}`,
            sql`${shiftAssignments.workDate} <= ${periodEndDate}`,
          ),
        )
        .groupBy(shiftAssignments.employeeId);

      const shiftCountMap = new Map(
        shiftCountRows.map((s) => [s.employeeId, s.scheduledDays]),
      );

      // 6. Calculate payroll for each employee
      let totalEarnings = 0n;
      let totalDeductions = 0n;
      let totalNet = 0n;
      let totalEmployerBpjs = 0n;
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
        if (baseSalary === 0n) {
          throw AppError.validation('hr.payroll.baseSalaryZero', { employeeName: emp.name });
        }
        const att = attMap.get(emp.id) ?? { lateMinutes: 0, lateCount: 0, attendanceDays: 0 };

        // T-0245: Detect absences = scheduled shifts - actual attendance days
        const scheduledDays = shiftCountMap.get(emp.id) ?? 0;
        const absentDays = Math.max(0, scheduledDays - att.attendanceDays);

        // T-0247: Read maritalStatus + dependentsCount from employee data
        const maritalStatus = (emp.maritalStatus === 'K' ? 'K' : 'TK') as 'TK' | 'K';
        const dependentsCount = Math.min(3, Math.max(0, emp.dependentsCount ?? 0)) as 0 | 1 | 2 | 3;

        const payrollCtx: PayrollEmployeeContext = {
          employeeId: emp.id,
          baseSalary,
          isBpjsBase: emp.isBpjsBase,
          isTaxable: emp.isTaxable,
          maritalStatus,
          dependentsCount,
          additionalEarnings: additionalEarningsByEmployeeId.get(emp.id) ?? [],
          additionalDeductions: additionalDeductionsByEmployeeId.get(emp.id) ?? [],
          lateMinutes: att.lateMinutes,
          lateCount: att.lateCount,
          absentCount: absentDays,
          attendancePolicy,
        };

        const result = calculatePayroll(payrollCtx);

        totalEarnings += result.totalEarnings;
        totalDeductions += result.totalDeductions;
        totalNet += result.netSalary;
        // T-0243: track employer BPJS total
        totalEmployerBpjs +=
          result.bpjsKesEmployer +
          result.bpjsJkkEmployer +
          result.bpjsJkmEmployer +
          result.bpjsJhtEmployer +
          result.bpjsJpEmployer;

        // Build payroll lines
        for (const line of result.lines) {
          // Employer BPJS lines use the same component for now, or a new one
          const compCode = line.componentCode;
          let comp = componentMap.get(compCode);
          if (!comp) {
            // For employer BPJS lines that might not have a salary component yet,
            // use the base BPJS component and mark with notes
            if (compCode.endsWith('_ER')) {
              const baseCode = compCode.replace('_ER', '').replace('BPJS_JKK', 'BPJS_TK').replace('BPJS_JKM', 'BPJS_TK').replace('BPJS_JHT', 'BPJS_TK').replace('BPJS_JP', 'BPJS_TK');
              comp = componentMap.get(baseCode === 'BPJS_KES' ? 'BPJS_KES' : 'BPJS_TK');
            }
            if (!comp) continue; // skip if no matching component
          }
          allLines.push({
            id: generateId(),
            tenantId: ctx.tenantId,
            payrollId: '', // set below
            employeeId: emp.id,
            salaryComponentId: comp.id,
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

      await auditRecord({
        action: 'run_payroll',
        entityType: 'payroll',
        entityId: payrollId,
        before: null,
        after: {
          id: payrollId,
          periodCode: data.periodCode,
          locationId: data.locationId,
          totalEmployees: empRows.length,
          totalEarnings,
          totalDeductions,
          totalNet,
          totalEmployerBpjs,
        } as never,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        payrollId,
        periodCode: data.periodCode,
        totalEmployees: empRows.length,
        totalEarnings,
        totalDeductions,
        totalNet,
        totalEmployerBpjs,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.payroll.runFailed', e);
    },
  );
}
