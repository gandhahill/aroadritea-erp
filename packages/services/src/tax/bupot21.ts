/**
 * Coretax e-Bupot 21 (PPh 21) bulk-import XML export — DJP Coretax (2025+).
 *
 * Produces the official `<Bp21Bulk>` structure (per DJP BP21 template):
 *   <Bp21Bulk><TIN/><ListOfBp21><Bp21>…</Bp21></ListOfBp21></Bp21Bulk>
 *
 * Source data: approved/paid payroll runs for the period. Each employee's
 * PPh 21 line (`comp-pph21`) carries the gross (baseAmount) and the effective
 * TER rate (percentageApplied). Coretax recomputes tax = Gross × Deemed% × Rate%,
 * so we emit Deemed=100 and Rate = percentageApplied × 100 (matches the withheld amount).
 *
 * The withholder TIN is read from company settings (`company.npwp`).
 */

import { db } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import { employees, payrollLines, payrolls } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray } from 'drizzle-orm';
import { requirePermission } from '../iam';

const PPH21_COMPONENT_ID = 'comp-pph21';
/** Pegawai Tetap — bulanan (DJP tax object code). */
const TAX_OBJECT_CODE_PERMANENT = '21-100-01';

function digitsOnly(value: string | null | undefined, fallback: string): string {
  const d = (value ?? '').replace(/\D/g, '');
  return d.length > 0 ? d : fallback;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export PPh 21 withholdings for a tax period as a Coretax BP21 bulk XML string.
 * @param period 'YYYY-MM'
 */
export async function exportBupot21Xml(period: string, ctx: AuditContext): Promise<Result<string>> {
  return tryCatch(
    async () => {
      const perm = await requirePermission(ctx.userId, 'tax.export');
      if (!perm.ok) throw perm.error;

      if (!/^\d{4}-\d{2}$/.test(period)) {
        throw AppError.validation('tax.bupot21.invalidPeriod', { period });
      }
      const taxYear = Number(period.slice(0, 4));
      const taxMonth = Number(period.slice(5, 7));

      // Withholder TIN from company settings.
      const [npwpRow] = await db
        .select({ value: cmsSettings.value })
        .from(cmsSettings)
        .where(and(eq(cmsSettings.tenantId, ctx.tenantId), eq(cmsSettings.key, 'company.npwp')))
        .limit(1);
      const tin = digitsOnly(npwpRow?.value ? String(npwpRow.value) : '', '0000000000000000');

      // Approved/paid payroll runs for the period.
      const runs = await db
        .select({ id: payrolls.id, periodEnd: payrolls.periodEnd })
        .from(payrolls)
        .where(
          and(
            eq(payrolls.tenantId, ctx.tenantId),
            eq(payrolls.periodCode, period),
            inArray(payrolls.status, ['approved', 'paid']),
          ),
        );
      if (runs.length === 0) {
        throw AppError.businessRule('tax.bupot21.noPayroll', { period });
      }
      const runIds = runs.map((r) => r.id);
      const withholdingDate = (runs[0]?.periodEnd ?? new Date(taxYear, taxMonth, 0))
        .toISOString()
        .slice(0, 10);

      // PPh 21 deduction lines.
      const lines = await db
        .select({
          employeeId: payrollLines.employeeId,
          amount: payrollLines.amount,
          baseAmount: payrollLines.baseAmount,
          percentageApplied: payrollLines.percentageApplied,
        })
        .from(payrollLines)
        .where(
          and(
            eq(payrollLines.tenantId, ctx.tenantId),
            inArray(payrollLines.payrollId, runIds),
            eq(payrollLines.salaryComponentId, PPH21_COMPONENT_ID),
          ),
        );
      if (lines.length === 0) {
        throw AppError.businessRule('tax.bupot21.noWithholding', { period });
      }

      const empIds = [...new Set(lines.map((l) => l.employeeId))];
      const emps = await db
        .select({
          id: employees.id,
          npwp: employees.npwp,
          maritalStatus: employees.maritalStatus,
          dependentsCount: employees.dependentsCount,
        })
        .from(employees)
        .where(inArray(employees.id, empIds));
      const empMap = new Map(emps.map((e) => [e.id, e]));

      const bp21Rows = lines
        .map((l) => {
          const emp = empMap.get(l.employeeId);
          const counterpartTin = digitsOnly(emp?.npwp ?? '', '0000000000000000');
          const marital = emp?.maritalStatus === 'K' ? 'K' : 'TK';
          const deps = Math.max(0, Math.min(3, emp?.dependentsCount ?? 0));
          const status = `${marital}/${deps}`;
          const gross = (l.baseAmount ?? 0n).toString();
          const rate =
            l.percentageApplied != null ? (Number(l.percentageApplied) * 100).toFixed(4) : '0';
          return [
            '\t\t<Bp21>',
            `\t\t\t<TaxPeriodMonth>${taxMonth}</TaxPeriodMonth>`,
            `\t\t\t<TaxPeriodYear>${taxYear}</TaxPeriodYear>`,
            `\t\t\t<CounterpartTin>${counterpartTin}</CounterpartTin>`,
            '\t\t\t<IDPlaceOfBusinessActivityOfIncomeRecipient>000000</IDPlaceOfBusinessActivityOfIncomeRecipient>',
            `\t\t\t<StatusTaxExemption>${status}</StatusTaxExemption>`,
            '\t\t\t<TaxCertificate>N/A</TaxCertificate>',
            `\t\t\t<TaxObjectCode>${TAX_OBJECT_CODE_PERMANENT}</TaxObjectCode>`,
            `\t\t\t<Gross>${gross}</Gross>`,
            '\t\t\t<Deemed>100</Deemed>',
            `\t\t\t<Rate>${rate}</Rate>`,
            '\t\t\t<Document>N/A</Document>',
            `\t\t\t<DocumentNumber>${xmlEscape(period)}</DocumentNumber>`,
            `\t\t\t<DocumentDate>${withholdingDate}</DocumentDate>`,
            '\t\t\t<IDPlaceOfBusinessActivity>000000</IDPlaceOfBusinessActivity>',
            `\t\t\t<WithholdingDate>${withholdingDate}</WithholdingDate>`,
            '\t\t</Bp21>',
          ].join('\n');
        })
        .join('\n');

      return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<Bp21Bulk xsi:noNamespaceSchemaLocation="schema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
        `\t<TIN>${tin}</TIN>`,
        '\t<ListOfBp21>',
        bp21Rows,
        '\t</ListOfBp21>',
        '</Bp21Bulk>',
      ].join('\n');
    },
    (e) => (e instanceof AppError ? e : AppError.internal('tax.bupot21.exportFailed', e)),
  );
}
