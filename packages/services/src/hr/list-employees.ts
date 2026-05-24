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
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { can, requirePermission } from '../iam';
import { decryptPii, encryptPiiForLookup } from '../security/pii';
import { type ListEmployeesInput, ListEmployeesInputSchema } from './schemas';

export interface EmployeeListItem {
  id: string;
  nik: string | null;
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
  const parsed = ListEmployeesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;
  const globalProbe = { locationId: '__global_hr_employee_read__' };
  const hasGlobalRead = await can(ctx.userId, 'hr.employee.read', globalProbe);
  const effectiveLocationId = data.locationId ?? (hasGlobalRead ? undefined : ctx.locationId);

  if (data.locationId) {
    const permCheck = await requirePermission(ctx.userId, 'hr.employee.read', {
      locationId: data.locationId,
    });
    if (!permCheck.ok) return permCheck;
  } else if (!hasGlobalRead) {
    const permCheck = await requirePermission(ctx.userId, 'hr.employee.read', {
      locationId: ctx.locationId,
    });
    if (!permCheck.ok) return permCheck;
  }

  return tryCatch(
    async () => {
      const conditions = [eq(employees.tenantId, ctx.tenantId)];

      if (data.status) {
        conditions.push(eq(employees.status, data.status));
      }
      if (data.department) {
        conditions.push(eq(employees.department, data.department));
      }
      if (effectiveLocationId) {
        conditions.push(eq(employees.locationId, effectiveLocationId));
      }
      if (data.search) {
        const q = `%${data.search}%`;
        const encryptedNik = encryptPiiForLookup(data.search, 'employees.nik');
        const encryptedPhone = encryptPiiForLookup(data.search, 'employees.phone');
        conditions.push(
          or(
            ilike(employees.name, q),
            ilike(employees.email, q),
            ilike(employees.nik, q),
            ilike(employees.phone, q),
            encryptedNik ? eq(employees.nik, encryptedNik) : undefined,
            encryptedPhone ? eq(employees.phone, encryptedPhone) : undefined,
          )!,
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
              eq(employmentContracts.tenantId, ctx.tenantId),
              inArray(employmentContracts.id, contractIds),
              eq(employmentContracts.isActive, true),
            ),
          );
        contractSalaries = new Map(contractRows.map((r) => [r.id, String(r.baseSalary)]));
      }

      const items: EmployeeListItem[] = rows.map((r) => ({
        id: r.id,
        nik: decryptPii(r.nik, 'employees.nik') ?? r.nik,
        name: r.name,
        email: r.email,
        phone: decryptPii(r.phone, 'employees.phone'),
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
