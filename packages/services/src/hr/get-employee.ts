/**
 * hr.getEmployee — SD §9.6, §21.8
 *
 * Full employee detail: master record + contract history + attendance summary.
 * Permission: hr.employee.read
 */

import { db } from '@erp/db';
import {
  attendance,
  employees,
  employmentContracts,
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { decryptPii } from '../security/pii';

export interface EmployeeContract {
  id: string;
  contractType: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  baseSalary: string;
  notes: string | null;
  createdAt: Date;
}

export interface AttendanceSummary {
  totalDays: number;
  lateDays: number;
  totalLateMinutes: number;
}

export interface LeaveBalanceRow {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: { id: string; en: string; zh: string };
  year: number;
  totalDays: string;
  usedDays: string;
  pendingDays: string;
}

export interface LeaveRequestRow {
  id: string;
  leaveTypeCode: string;
  leaveTypeName: { id: string; en: string; zh: string };
  startDate: Date;
  endDate: Date;
  totalDays: string;
  status: string;
  reason: string | null;
  approvedBy: string | null;
  createdAt: Date;
}

export interface EmployeeDetailResult {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: string;
  position: string;
  department: string | null;
  hireDate: Date;
  probationEndDate: Date | null;
  contractType: string;
  workSchedule: string;
  npwp: string | null;
  bpjsKesehatan: string | null;
  bpjsTenagakerja: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  currentContractId: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contracts: EmployeeContract[];
  attendanceSummary: AttendanceSummary;
  leaveBalances: LeaveBalanceRow[];
  recentLeaveRequests: LeaveRequestRow[];
}

export async function getEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<EmployeeDetailResult>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const [row] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, employeeId)))
        .limit(1);

      if (!row) {
        throw AppError.notFound('hr.employee.notFound', { employeeId });
      }

      // Contract history
      const contracts = await db
        .select({
          id: employmentContracts.id,
          contractType: employmentContracts.contractType,
          startDate: employmentContracts.startDate,
          endDate: employmentContracts.endDate,
          isActive: employmentContracts.isActive,
          baseSalary: employmentContracts.baseSalary,
          notes: employmentContracts.notes,
          createdAt: employmentContracts.createdAt,
        })
        .from(employmentContracts)
        .where(eq(employmentContracts.employeeId, employeeId))
        .orderBy(desc(employmentContracts.startDate));

      // Attendance summary (current year)
      const year = new Date().getFullYear();
      const yearStart = new Date(`${year}-01-01T00:00:00Z`);
      const yearEnd = new Date(`${year}-12-31T23:59:59Z`);

      const attRows = await db
        .select({
          totalDays: sql<number>`cast(count(*) as int)`,
          lateDays: sql<number>`cast(count(case when ${attendance.isLate} then 1 end) as int)`,
          totalLateMinutes: sql<number>`cast(coalesce(sum(${attendance.lateMinutes}), 0) as int)`,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.employeeId, employeeId),
            eq(attendance.tenantId, ctx.tenantId),
            sql`${attendance.checkInAt} >= ${yearStart}`,
            sql`${attendance.checkInAt} <= ${yearEnd}`,
          ),
        );

      const att = attRows[0] ?? { totalDays: 0, lateDays: 0, totalLateMinutes: 0 };

      // Leave balances (current year)
      const balanceRows = await db
        .select({
          leaveTypeId: leaveBalances.leaveTypeId,
          year: leaveBalances.year,
          totalDays: leaveBalances.totalDays,
          usedDays: leaveBalances.usedDays,
          pendingDays: leaveBalances.pendingDays,
          leaveTypeCode: leaveTypes.code,
          leaveTypeName: leaveTypes.name,
        })
        .from(leaveBalances)
        .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
        .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

      const leaveBalances_: LeaveBalanceRow[] = balanceRows.map((r) => ({
        leaveTypeId: r.leaveTypeId,
        leaveTypeCode: r.leaveTypeCode ?? '',
        leaveTypeName: (r.leaveTypeName ?? { id: '', en: '', zh: '' }) as {
          id: string;
          en: string;
          zh: string;
        },
        year: r.year,
        totalDays: String(r.totalDays),
        usedDays: String(r.usedDays),
        pendingDays: String(r.pendingDays),
      }));

      // Recent leave requests (last 6)
      const leaveReqRows = await db
        .select({
          id: leaveRequests.id,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          totalDays: leaveRequests.totalDays,
          status: leaveRequests.status,
          reason: leaveRequests.reason,
          approvedBy: leaveRequests.approvedBy,
          createdAt: leaveRequests.createdAt,
          leaveTypeCode: leaveTypes.code,
          leaveTypeName: leaveTypes.name,
        })
        .from(leaveRequests)
        .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(eq(leaveRequests.employeeId, employeeId))
        .orderBy(desc(leaveRequests.createdAt))
        .limit(6);

      const recentLeaveRequests: LeaveRequestRow[] = leaveReqRows.map((r) => ({
        id: r.id,
        leaveTypeCode: r.leaveTypeCode ?? '',
        leaveTypeName: (r.leaveTypeName ?? { id: '', en: '', zh: '' }) as {
          id: string;
          en: string;
          zh: string;
        },
        startDate: r.startDate!,
        endDate: r.endDate!,
        totalDays: String(r.totalDays),
        status: r.status,
        reason: r.reason,
        approvedBy: r.approvedBy as string | null,
        createdAt: r.createdAt!,
      }));

      const result: EmployeeDetailResult = {
        id: row.id,
        nik: decryptPii(row.nik, 'employees.nik') ?? row.nik,
        name: row.name,
        email: row.email,
        phone: decryptPii(row.phone, 'employees.phone'),
        address: decryptPii(row.address, 'employees.address'),
        status: row.status,
        position: row.position,
        department: row.department,
        hireDate: row.hireDate!,
        probationEndDate: row.probationEndDate,
        contractType: row.contractType,
        workSchedule: row.workSchedule,
        npwp: decryptPii(row.npwp, 'employees.npwp'),
        bpjsKesehatan: decryptPii(row.bpjsKesehatan, 'employees.bpjsKesehatan'),
        bpjsTenagakerja: decryptPii(row.bpjsTenagakerja, 'employees.bpjsTenagakerja'),
        emergencyContactName: row.emergencyContactName,
        emergencyContactPhone: decryptPii(
          row.emergencyContactPhone,
          'employees.emergencyContactPhone',
        ),
        currentContractId: row.currentContractId,
        locationId: row.locationId,
        createdAt: row.createdAt!,
        updatedAt: row.updatedAt!,
        contracts: contracts.map((c) => ({
          id: c.id,
          contractType: c.contractType,
          startDate: c.startDate!,
          endDate: c.endDate,
          isActive: c.isActive,
          baseSalary: String(c.baseSalary),
          notes: c.notes,
          createdAt: c.createdAt!,
        })),
        attendanceSummary: {
          totalDays: Number(att.totalDays),
          lateDays: Number(att.lateDays),
          totalLateMinutes: Number(att.totalLateMinutes),
        },
        leaveBalances: leaveBalances_,
        recentLeaveRequests,
      };

      return result;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.getFailed', e);
    },
  );
}
