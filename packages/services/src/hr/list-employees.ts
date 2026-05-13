/**
 * hr.listEmployees — SD §9.6, §21.8
 *
 * Paginated employee list with optional filters.
 * Permission: hr.employee.read
 */

import { db } from '@erp/db';
import { employees, employmentContracts } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { type ListEmployeesInput, ListEmployeesInputSchema } from './schemas';

export interface EmployeeListItem {
  id: string;
  nik: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  position: string;
  department: string | null;
  hireDate: Date;
  contractType: string;
  currentContractId: string | null;
  currentBaseSalary: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── List employees ─────────────────────────────────────────────────────────

export async function listEmployees(
  input: ListEmployeesInput,
  ctx: AuditContext,
): Promise<Result<{ items: EmployeeListItem[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.employee.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = ListEmployeesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      const conditions = [eq(employees.tenantId, ctx.tenantId)];

      if (data.status) {
        conditions.push(eq(employees.status, data.status));
      }
      if (data.department) {
        conditions.push(eq(employees.department, data.department));
      }
      if (data.locationId) {
        conditions.push(eq(employees.locationId, data.locationId));
      }
      if (data.search) {
        conditions.push(
          sql`(${employees.name} ILIKE ${'%' + data.search + '%'} OR ${employees.nik} ILIKE ${'%' + data.search + '%'} OR ${employees.email} ILIKE ${'%' + data.search + '%'})`,
        );
      }

      const whereClause = and(...conditions);

      // Count
      const countRows = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(employees)
        .where(whereClause);

      const total = countRows[0]?.count ?? 0;

      // Fetch employees with current contract base salary
      const rows = await db
        .select({
          id: employees.id,
          nik: employees.nik,
          name: employees.name,
          email: employees.email,
          phone: employees.phone,
          status: employees.status,
          position: employees.position,
          department: employees.department,
          hireDate: employees.hireDate,
          contractType: employees.contractType,
          currentContractId: employees.currentContractId,
          locationId: employees.locationId,
          createdAt: employees.createdAt,
          updatedAt: employees.updatedAt,
        })
        .from(employees)
        .where(whereClause)
        .orderBy(employees.name)
        .limit(data.limit)
        .offset(data.offset);

      // Batch-fetch current contract salaries
      const contractIds = rows
        .map((r) => r.currentContractId)
        .filter((id): id is string => id !== null);

      let contractSalaries: Map<string, string> = new Map();
      if (contractIds.length > 0) {
        const contractRows = await db
          .select({ id: employmentContracts.id, baseSalary: employmentContracts.baseSalary })
          .from(employmentContracts)
          .where(
            and(
              sql`${employmentContracts.id} = ANY(${contractIds})`,
              eq(employmentContracts.isActive, true),
            ),
          );
        contractSalaries = new Map(contractRows.map((r) => [r.id, String(r.baseSalary)]));
      }

      const items: EmployeeListItem[] = rows.map((r) => ({
        id: r.id,
        nik: r.nik,
        name: r.name,
        email: r.email,
        phone: r.phone,
        status: r.status,
        position: r.position,
        department: r.department,
        hireDate: r.hireDate!,
        contractType: r.contractType,
        currentContractId: r.currentContractId,
        currentBaseSalary: r.currentContractId
          ? (contractSalaries.get(r.currentContractId) ?? null)
          : null,
        locationId: r.locationId,
        createdAt: r.createdAt!,
        updatedAt: r.updatedAt!,
      }));

      return { items, total };
    },
    (e) => AppError.internal('hr.employee.listFailed', e),
  );
}
