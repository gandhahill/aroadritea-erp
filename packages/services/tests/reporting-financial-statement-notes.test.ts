import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockPermissionResult = true;

vi.mock('../src/iam', () => ({
  requirePermission: vi.fn(async () => {
    if (mockPermissionResult) return { ok: true, value: undefined };
    return { ok: false, error: { code: 'FORBIDDEN', messageKey: 'common.errors.forbidden' } };
  }),
}));

import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../src/iam';
import { financialStatementNotes } from '../src/reporting/financial-statement-notes';

const requirePermissionMock = vi.mocked(requirePermission);

function makeCtx(): AuditContext {
  return { userId: 'user-001', tenantId: 'default', locationId: 'loc-mli' };
}

describe('financialStatementNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionResult = true;
  });

  it('returns the complete SAK EP statement checklist and compliance warnings', async () => {
    const result = await financialStatementNotes(
      {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        reportingDate: '2026-12-31',
        locationId: 'loc-mli',
        firstSakEpFinancialStatements: true,
        previousFramework: 'SAK ETAP',
      },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.framework).toBe('SAK_EP');
    expect(result.value.requiredStatements.map((item) => item.code)).toEqual([
      'statement_of_financial_position',
      'profit_or_loss_and_comprehensive_income',
      'statement_of_changes_in_equity',
      'statement_of_cash_flows',
      'notes_to_financial_statements',
    ]);
    expect(result.value.sections.some((section) => section.code === 'basis_of_preparation')).toBe(
      true,
    );
    expect(result.value.sections.some((section) => section.code === 'vat_and_income_tax')).toBe(
      true,
    );
    expect(
      result.value.complianceWarnings.some(
        (warning) => warning.code === 'explicit_compliance_statement',
      ),
    ).toBe(true);
  });

  it('uses consolidated permission when location is omitted', async () => {
    const result = await financialStatementNotes(
      {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        reportingDate: '2026-12-31',
      },
      makeCtx(),
    );

    expect(result.ok).toBe(true);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      'user-001',
      'reporting.consolidated',
      undefined,
    );
  });

  it('rejects without permission', async () => {
    mockPermissionResult = false;

    const result = await financialStatementNotes(
      {
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        reportingDate: '2026-12-31',
        locationId: 'loc-mli',
      },
      makeCtx(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});
