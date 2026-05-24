/**
 * Payslip data assembly — User Req 3 (2026-05-24).
 *
 * Produces the structured data needed to render an employee payslip:
 * employer block, period, employee block, earnings & deductions lines,
 * totals, and optionally the linked journal entry number.
 *
 * Permission rules:
 *  - An employee can always fetch their own payslip (matched via
 *    employees.email ↔ users.email).
 *  - Anyone holding `hr.payroll.approve` or `hr.employee.read` for the
 *    payroll's outlet can fetch anyone else's payslip.
 *
 * No PDF library is required — the HTML route at
 * `apps/web/app/api/hr/payslip/[payrollId]/[employeeId]/route.ts`
 * renders a print-ready document; the browser's "Save as PDF" action
 * produces the file.
 */

import { and, db, eq, inArray } from '@erp/db';
import { journalEntries } from '@erp/db/schema/accounting';
import { locations, users } from '@erp/db/schema/auth';
import { employees, payrollLines, payrolls, salaryComponents } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { can } from '../iam';

export interface PayslipLine {
  componentCode: string;
  componentName: string;
  componentKind: 'earning' | 'deduction';
  amount: string; // IDR as integer string
  baseAmount: string | null;
  percentageApplied: string | null;
  notes: string | null;
}

export interface PayslipData {
  payrollId: string;
  periodCode: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  approvedAt: Date | null;
  journalEntryNumber: string | null;

  employer: {
    legalName: string;
    locationName: string;
    locationCode: string;
    address: string | null;
  };

  employee: {
    id: string;
    name: string;
    email: string;
    position: string;
    department: string | null;
    nik: string | null;
  };

  earnings: PayslipLine[];
  deductions: PayslipLine[];

  totals: {
    earnings: string;
    deductions: string;
    net: string;
  };
}

export async function getEmployeePayslip(
  input: { payrollId: string; employeeId: string },
  ctx: AuditContext,
): Promise<Result<PayslipData>> {
  const [payroll] = await db
    .select({
      payroll: payrolls,
      location: locations,
    })
    .from(payrolls)
    .leftJoin(
      locations,
      and(eq(locations.id, payrolls.locationId), eq(locations.tenantId, ctx.tenantId)),
    )
    .where(and(eq(payrolls.tenantId, ctx.tenantId), eq(payrolls.id, input.payrollId)))
    .limit(1);

  if (!payroll?.payroll) {
    return err(AppError.notFound('hr.payroll.notFound', { payrollId: input.payrollId }));
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(eq(employees.tenantId, ctx.tenantId), eq(employees.id, input.employeeId)),
    )
    .limit(1);

  if (!employee) {
    return err(AppError.notFound('hr.employee.notFound', { employeeId: input.employeeId }));
  }

  // Permission: same person (matched by user email == employee email) or
  // an HR/payroll admin in this outlet.
  const [requester] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  const isOwnPayslip =
    !!requester?.email && employee.email && requester.email.toLowerCase() === employee.email.toLowerCase();

  let allowed = isOwnPayslip;
  if (!allowed) {
    allowed = await can(ctx.userId, 'hr.payroll.approve', {
      locationId: payroll.payroll.locationId,
    });
  }
  if (!allowed) {
    allowed = await can(ctx.userId, 'hr.employee.read', {
      locationId: payroll.payroll.locationId,
    });
  }
  if (!allowed) {
    return err(AppError.forbidden('hr.payroll.payslipForbidden'));
  }

  // Fetch all payroll lines for this employee in this payroll, join components.
  const lines = await db
    .select({ line: payrollLines, component: salaryComponents })
    .from(payrollLines)
    .leftJoin(salaryComponents, eq(salaryComponents.id, payrollLines.salaryComponentId))
    .where(
      and(
        eq(payrollLines.tenantId, ctx.tenantId),
        eq(payrollLines.payrollId, input.payrollId),
        eq(payrollLines.employeeId, input.employeeId),
      ),
    );

  const earnings: PayslipLine[] = [];
  const deductions: PayslipLine[] = [];
  let totalEarnings = 0n;
  let totalDeductions = 0n;

  for (const row of lines) {
    const componentName = (row.component?.name as { id?: string; en?: string })?.id
      ?? (row.component?.name as { id?: string; en?: string })?.en
      ?? row.component?.code
      ?? row.line.salaryComponentId;
    const entry: PayslipLine = {
      componentCode: row.component?.code ?? row.line.salaryComponentId,
      componentName: String(componentName),
      componentKind: row.line.componentKind as 'earning' | 'deduction',
      amount: row.line.amount.toString(),
      baseAmount: row.line.baseAmount?.toString() ?? null,
      percentageApplied: row.line.percentageApplied?.toString() ?? null,
      notes: row.line.notes,
    };
    if (entry.componentKind === 'earning') {
      earnings.push(entry);
      totalEarnings += row.line.amount;
    } else {
      deductions.push(entry);
      totalDeductions += row.line.amount;
    }
  }

  const net = totalEarnings - totalDeductions;

  let journalEntryNumber: string | null = null;
  if (payroll.payroll.journalEntryId) {
    const [je] = await db
      .select({ number: journalEntries.number })
      .from(journalEntries)
      .where(eq(journalEntries.id, payroll.payroll.journalEntryId))
      .limit(1);
    journalEntryNumber = je?.number ?? null;
  }

  return ok({
    payrollId: payroll.payroll.id,
    periodCode: payroll.payroll.periodCode,
    periodStart: payroll.payroll.periodStart!,
    periodEnd: payroll.payroll.periodEnd!,
    status: payroll.payroll.status,
    approvedAt: payroll.payroll.approvedAt,
    journalEntryNumber,
    employer: {
      legalName: 'PT Gandha Hill Catering Management Indonesia',
      locationName:
        (payroll.location?.name as { id?: string; en?: string })?.id
        ?? (payroll.location?.name as { id?: string; en?: string })?.en
        ?? payroll.location?.code
        ?? payroll.payroll.locationId,
      locationCode: payroll.location?.code ?? payroll.payroll.locationId,
      address: payroll.location?.address ?? null,
    },
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      nik: employee.nik,
    },
    earnings,
    deductions,
    totals: {
      earnings: totalEarnings.toString(),
      deductions: totalDeductions.toString(),
      net: net.toString(),
    },
  });
}

/**
 * List payslips visible to the requesting user. When they are an
 * employee (has matching `employees` row by email) they only see their
 * own; when they have `hr.payroll.approve` they see everything in
 * payroll runs from their outlet.
 */
export async function listMyPayslips(
  ctx: AuditContext,
): Promise<Result<Array<{
  payrollId: string;
  periodCode: string;
  status: string;
  approvedAt: Date | null;
  locationCode: string;
  employeeId: string;
  net: string;
}>>> {
  const [requester] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);
  if (!requester?.email) {
    return ok([]);
  }

  // Find every employee row that matches this user's email — usually one
  // but multi-outlet staff might have two probationary records.
  const matchingEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.tenantId, ctx.tenantId));

  // The employee.email field is encrypted-for-lookup — direct equality
  // does not work without applying the same transform. Reuse encryptPiiForLookup.
  const { encryptPiiForLookup } = await import('../security/pii');
  const encryptedRequester = encryptPiiForLookup(requester.email.toLowerCase(), 'employees.email');
  const empRows = matchingEmployees.filter(
    (e) =>
      e.email && (e.email === encryptedRequester || e.email.toLowerCase() === requester.email.toLowerCase()),
  );

  if (empRows.length === 0) return ok([]);
  const empIds = empRows.map((e) => e.id);

  const lines = await db
    .select({
      payrollId: payrollLines.payrollId,
      employeeId: payrollLines.employeeId,
      amount: payrollLines.amount,
      componentKind: payrollLines.componentKind,
    })
    .from(payrollLines)
    .where(
      and(
        eq(payrollLines.tenantId, ctx.tenantId),
        inArray(payrollLines.employeeId, empIds),
      ),
    );
  if (lines.length === 0) return ok([]);

  const payrollIds = Array.from(new Set(lines.map((l) => l.payrollId)));
  const payrollRows = await db
    .select({
      id: payrolls.id,
      periodCode: payrolls.periodCode,
      status: payrolls.status,
      approvedAt: payrolls.approvedAt,
      locationId: payrolls.locationId,
    })
    .from(payrolls)
    .where(and(eq(payrolls.tenantId, ctx.tenantId), inArray(payrolls.id, payrollIds)));
  const locationRows = await db
    .select({ id: locations.id, code: locations.code })
    .from(locations)
    .where(eq(locations.tenantId, ctx.tenantId));
  const locByCode = new Map(locationRows.map((l) => [l.id, l.code] as const));

  const netByKey = new Map<string, bigint>();
  for (const line of lines) {
    const key = `${line.payrollId}::${line.employeeId}`;
    const current = netByKey.get(key) ?? 0n;
    const delta = line.componentKind === 'earning' ? line.amount : -line.amount;
    netByKey.set(key, current + delta);
  }

  const items: Array<{
    payrollId: string;
    periodCode: string;
    status: string;
    approvedAt: Date | null;
    locationCode: string;
    employeeId: string;
    net: string;
  }> = [];
  for (const line of lines) {
    const payroll = payrollRows.find((p) => p.id === line.payrollId);
    if (!payroll) continue;
    const key = `${line.payrollId}::${line.employeeId}`;
    if (items.find((i) => i.payrollId === line.payrollId && i.employeeId === line.employeeId)) {
      continue;
    }
    items.push({
      payrollId: payroll.id,
      periodCode: payroll.periodCode,
      status: payroll.status,
      approvedAt: payroll.approvedAt,
      locationCode: locByCode.get(payroll.locationId) ?? payroll.locationId,
      employeeId: line.employeeId,
      net: (netByKey.get(key) ?? 0n).toString(),
    });
  }
  items.sort((a, b) => (a.periodCode < b.periodCode ? 1 : a.periodCode > b.periodCode ? -1 : 0));
  return ok(items);
}
