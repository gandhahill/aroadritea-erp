/**
 * Bank Transfer File Generator — T-0246
 * SD §21.8 §Payroll Run
 *
 * Generates CSV/TXT files for bulk payroll bank transfers.
 * Each bank has its own format; this provides a generic CSV format
 * plus BCA-specific format as an example.
 *
 * Bank account fields (bankName, bankAccountNumber, bankAccountHolder)
 * are encrypted at rest per UU PDP — this service decrypts for export.
 */

import { db } from '@erp/db';
import {
  employees,
  payrollLines,
  payrolls,
  salaryComponents,
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { decryptPii } from '../security/pii';

export const GenerateBankTransferInputSchema = z.object({
  payrollId: z.string().min(1),
  format: z.enum(['generic_csv', 'bca', 'mandiri', 'bni']).default('generic_csv'),
});

export type GenerateBankTransferInput = z.infer<typeof GenerateBankTransferInputSchema>;

export interface BankTransferRow {
  employeeId: string;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  netAmount: bigint;
  periodCode: string;
}

export interface BankTransferResult {
  payrollId: string;
  periodCode: string;
  format: string;
  totalRows: number;
  totalAmount: bigint;
  rows: BankTransferRow[];
  csvContent: string;
  skippedEmployees: string[]; // employees without bank details
}

export async function generateBankTransferFile(
  input: GenerateBankTransferInput,
  ctx: AuditContext,
): Promise<Result<BankTransferResult>> {
  const parsed = GenerateBankTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.bankTransfer.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  try {
    const [payroll] = await db
      .select()
      .from(payrolls)
      .where(and(eq(payrolls.id, data.payrollId), eq(payrolls.tenantId, ctx.tenantId)))
      .limit(1);

    if (!payroll) {
      return err(AppError.notFound('hr.bankTransfer.payrollNotFound', { payrollId: data.payrollId }));
    }

    const permCheck = await requirePermission(ctx.userId, 'hr.payroll.read', {
      locationId: payroll.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (payroll.status !== 'approved' && payroll.status !== 'paid') {
      return err(AppError.conflict('hr.bankTransfer.payrollNotApproved', { status: payroll.status }));
    }

    // Fetch payroll lines to get net per employee
    const lines = await db
      .select({
        employeeId: payrollLines.employeeId,
        amount: payrollLines.amount,
        componentKind: payrollLines.componentKind,
        componentCode: salaryComponents.code,
      })
      .from(payrollLines)
      .innerJoin(salaryComponents, eq(payrollLines.salaryComponentId, salaryComponents.id))
      .where(eq(payrollLines.payrollId, data.payrollId));

    // Calculate net per employee
    const netByEmployee = new Map<string, bigint>();
    for (const line of lines) {
      const current = netByEmployee.get(line.employeeId) ?? 0n;
      // Skip employer BPJS lines (they don't affect employee net)
      if (line.componentCode?.endsWith('_ER')) continue;
      if (line.componentKind === 'earning') {
        netByEmployee.set(line.employeeId, current + line.amount);
      } else if (line.componentKind === 'deduction') {
        netByEmployee.set(line.employeeId, current - line.amount);
      }
    }

    // Fetch employee bank details
    const employeeIds = [...netByEmployee.keys()];
    const empRows = await db
      .select({
        id: employees.id,
        name: employees.name,
        bankName: employees.bankName,
        bankAccountNumber: employees.bankAccountNumber,
        bankAccountHolder: employees.bankAccountHolder,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, ctx.tenantId),
          eq(employees.locationId, payroll.locationId),
          isNull(employees.deletedAt),
        ),
      );

    const empMap = new Map(empRows.map((e) => [e.id, e]));

    const rows: BankTransferRow[] = [];
    const skippedEmployees: string[] = [];
    let totalAmount = 0n;

    for (const employeeId of employeeIds) {
      const emp = empMap.get(employeeId);
      if (!emp) continue;

      const netAmount = netByEmployee.get(employeeId) ?? 0n;
      if (netAmount <= 0n) continue;

      // Decrypt bank account fields
      const accountNumber = emp.bankAccountNumber
        ? decryptPii(emp.bankAccountNumber, 'employees.bankAccountNumber')
        : '';
      const accountHolder = emp.bankAccountHolder
        ? decryptPii(emp.bankAccountHolder, 'employees.bankAccountHolder')
        : '';

      if (!emp.bankName || !accountNumber) {
        skippedEmployees.push(emp.name);
        continue;
      }

      rows.push({
        employeeId,
        employeeName: emp.name,
        bankName: emp.bankName,
        accountNumber,
        accountHolder: accountHolder || emp.name,
        netAmount,
        periodCode: payroll.periodCode,
      });
      totalAmount += netAmount;
    }

    // Generate CSV content
    const csvContent = generateCsvContent(rows, data.format, payroll.periodCode);

    await auditRecord({
      action: 'generate_bank_transfer',
      entityType: 'payroll',
      entityId: data.payrollId,
      before: null,
      after: {
        format: data.format,
        totalRows: rows.length,
        totalAmount: totalAmount.toString(),
        skippedEmployees,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({
      payrollId: data.payrollId,
      periodCode: payroll.periodCode,
      format: data.format,
      totalRows: rows.length,
      totalAmount,
      rows,
      csvContent,
      skippedEmployees,
    });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.bankTransfer.failed', e));
  }
}

function generateCsvContent(
  rows: BankTransferRow[],
  format: string,
  periodCode: string,
): string {
  if (format === 'bca') {
    // BCA batch format: AccountNo,AccountHolder,Amount,Remark
    const header = 'AccountNo,AccountHolder,Amount,Remark';
    const dataRows = rows.map(
      (r) => `${r.accountNumber},${r.accountHolder},${r.netAmount},Gaji ${periodCode}`,
    );
    return [header, ...dataRows].join('\n');
  }

  if (format === 'mandiri') {
    // Mandiri format: BankCode,AccountNo,AccountHolder,Amount,Remark
    const header = 'BankCode,AccountNo,AccountHolder,Amount,Remark';
    const dataRows = rows.map(
      (r) => `008,${r.accountNumber},${r.accountHolder},${r.netAmount},Gaji ${periodCode}`,
    );
    return [header, ...dataRows].join('\n');
  }

  if (format === 'bni') {
    // BNI format: SeqNo,AccountNo,AccountHolder,Amount,Remark
    const header = 'SeqNo,AccountNo,AccountHolder,Amount,Remark';
    const dataRows = rows.map(
      (r, i) => `${i + 1},${r.accountNumber},${r.accountHolder},${r.netAmount},Gaji ${periodCode}`,
    );
    return [header, ...dataRows].join('\n');
  }

  // Generic CSV
  const header = 'EmployeeId,EmployeeName,BankName,AccountNumber,AccountHolder,NetAmount,PeriodCode';
  const dataRows = rows.map(
    (r) => `${r.employeeId},${r.employeeName},${r.bankName},${r.accountNumber},${r.accountHolder},${r.netAmount},${r.periodCode}`,
  );
  return [header, ...dataRows].join('\n');
}
