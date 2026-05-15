'use server';

import { getSession } from '@/lib/auth';
import {
  and,
  asc,
  db,
  desc,
  employees,
  eq,
  leaveBalances,
  leaveRequests,
  leaveTypes,
} from '@erp/db';
import { requirePermission } from '@erp/services/iam';

export interface LeaveDashboardData {
  types: Array<{
    id: string;
    code: string;
    name: Record<string, string>;
    annualQuotaDays: number;
    isPaid: boolean;
    requiresApproval: boolean;
    isActive: boolean;
  }>;
  requests: Array<{
    id: string;
    employeeName: string | null;
    leaveTypeName: Record<string, string> | null;
    startDate: Date;
    endDate: Date;
    totalDays: string;
    status: string;
    reason: string | null;
  }>;
  balances: Array<{
    id: string;
    employeeName: string | null;
    leaveTypeName: Record<string, string> | null;
    year: number;
    totalDays: string;
    usedDays: string;
    pendingDays: string;
  }>;
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export async function fetchLeaveDashboard(): Promise<LeaveDashboardData | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const perm = await requirePermission(ctx.userId, 'hr.view');
  if (!perm.ok) return null;

  const [typeRows, requestRows, balanceRows] = await Promise.all([
    db
      .select({
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
        annualQuotaDays: leaveTypes.annualQuotaDays,
        isPaid: leaveTypes.isPaid,
        requiresApproval: leaveTypes.requiresApproval,
        isActive: leaveTypes.isActive,
      })
      .from(leaveTypes)
      .where(eq(leaveTypes.tenantId, ctx.tenantId))
      .orderBy(asc(leaveTypes.code)),
    db
      .select({
        id: leaveRequests.id,
        employeeName: employees.name,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(eq(leaveRequests.tenantId, ctx.tenantId))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(50),
    db
      .select({
        id: leaveBalances.id,
        employeeName: employees.name,
        leaveTypeName: leaveTypes.name,
        year: leaveBalances.year,
        totalDays: leaveBalances.totalDays,
        usedDays: leaveBalances.usedDays,
        pendingDays: leaveBalances.pendingDays,
      })
      .from(leaveBalances)
      .leftJoin(employees, eq(leaveBalances.employeeId, employees.id))
      .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(eq(leaveBalances.tenantId, ctx.tenantId))
      .orderBy(desc(leaveBalances.year))
      .limit(100),
  ]);

  return {
    types: typeRows.map((row) => ({ ...row, name: row.name as Record<string, string> })),
    requests: requestRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
    })),
    balances: balanceRows.map((row) => ({
      ...row,
      leaveTypeName: row.leaveTypeName as Record<string, string> | null,
      totalDays: String(row.totalDays),
      usedDays: String(row.usedDays),
      pendingDays: String(row.pendingDays),
    })),
  };
}
