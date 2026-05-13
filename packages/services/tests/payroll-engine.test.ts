/**
 * Payroll Engine Unit Tests — SD §19.5, §21.8
 *
 * Tests PPh 21 TER progressive calculation + BPJS caps + late penalty.
 */

import { describe, expect, it } from 'vitest';
import {
  type PayrollEmployeeContext,
  type PayrollResult,
  calculatePayroll,
} from '../src/payroll/payroll-engine.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function payroll(ctx: Partial<PayrollEmployeeContext>): PayrollResult {
  return calculatePayroll({
    employeeId: 'emp-1',
    baseSalary: 5_000_000n,
    isBpjsBase: true,
    isTaxable: true,
    dependentsCount: 0,
    additionalEarnings: [],
    lateMinutes: 0,
    absentCount: 0,
    ...ctx,
  });
}

// ─── PPh 21 TER Tests ────────────────────────────────────────────────────────

describe('PPh 21 TER progressive calculation', () => {
  it('zero tax when gross below PTKP (Rp 54M/year)', () => {
    // Rp 4M/month × 12 = Rp 48M/year < PTKP Rp 54M → no tax
    const result = payroll({ baseSalary: 4_000_000n });
    expect(result.pph21Amount).toBe(0n);
  });

  it('5% bracket for PKP 0–60M', () => {
    // Rp 5M/month × 12 = Rp 60M → PKP = 60M-54M = 6M
    // 6M × 5% = 300,000/year → 25,000/month
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.pph21Amount).toBe(25_000n);
  });

  it('15% bracket for PKP 60M–250M', () => {
    // Rp 15M/month × 12 = Rp 180M → PKP = 180M-54M = 126M
    // Tax: 60M × 5% = 3M; 66M × 15% = 9.9M; Total = 12.9M/year → 1,075,000/month
    const result = payroll({ baseSalary: 15_000_000n });
    expect(result.pph21Amount).toBe(1_075_000n);
  });

  it('25% bracket for PKP 250M–500M', () => {
    // Rp 30M/month × 12 = Rp 360M → PKP = 360M-54M = 306M
    // 60M×5% = 3M; 190M×15% = 28.5M; 56M×25% = 14M; Total = 45.5M/year → 3,791,667/month
    const result = payroll({ baseSalary: 30_000_000n });
    expect(result.pph21Amount).toBe(3_791_667n);
  });

  it('PTKP K/1 reduces taxable income', () => {
    // Same 5M/month, but PTKP = 58.5M → PKP = 60M-58.5M = 1.5M
    // 1.5M × 5% = 75,000/year → 6,250/month
    const resultK0 = payroll({ baseSalary: 5_000_000n, dependentsCount: 0 });
    const resultK1 = payroll({ baseSalary: 5_000_000n, dependentsCount: 1 });
    expect(resultK1.pph21Amount).toBeLessThan(resultK0.pph21Amount);
    expect(resultK1.pph21Amount).toBe(6_250n);
  });
});

// ─── BPJS Tests ───────────────────────────────────────────────────────────────

describe('BPJS Kesehatan caps', () => {
  it('1% of salary below ceiling', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsKesEmployee).toBe(50_000n); // 5M × 1%
  });

  it('caps at Rp 12,000,000 ceiling', () => {
    // 1% × 1.2B = 12M exactly → at cap (base must be ≥ 1,200,000,000)
    const result = payroll({ baseSalary: 1_200_000_000n });
    expect(result.bpjsKesEmployee).toBe(12_000_000n);
  });

  it('skips when isBpjsBase = false', () => {
    const result = payroll({ baseSalary: 5_000_000n, isBpjsBase: false });
    expect(result.bpjsKesEmployee).toBe(0n);
  });
});

describe('BPJS TK caps', () => {
  it('2% of salary below ceiling', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsTkEmployee).toBe(100_000n); // 5M × 2%
  });

  it('caps at Rp 10,000,000 ceiling', () => {
    // 2% × 500M = 10M exactly → at cap (base must be ≥ 500,000,000)
    const result = payroll({ baseSalary: 500_000_000n });
    expect(result.bpjsTkEmployee).toBe(10_000_000n);
  });
});

// ─── Late Penalty Tests ───────────────────────────────────────────────────────

describe('Late penalty (SOP §21.8)', () => {
  it('no penalty for 0 late minutes', () => {
    const result = payroll({ lateMinutes: 0 });
    expect(result.latePenalty).toBe(0n);
  });

  it('no penalty for up to 3 free lates', () => {
    const result = payroll({ lateMinutes: 120 }); // 2 hours = 2 "late events"
    expect(result.latePenalty).toBe(0n);
  });

  it('penalty kicks in after 3 free lates', () => {
    // 4 hours of lateness → 1 penalty × Rp 50,000
    const result = payroll({ lateMinutes: 240 });
    expect(result.latePenalty).toBe(50_000n);
  });

  it('multiple penalties for excessive lates', () => {
    // 10 hours late → 7 penalized hours × 50,000
    const result = payroll({ lateMinutes: 600 });
    expect(result.latePenalty).toBe(350_000n);
  });
});

// ─── Absent Penalty ───────────────────────────────────────────────────────────

describe('Absent penalty', () => {
  it('no penalty when absentCount = 0', () => {
    const result = payroll({ absentCount: 0 });
    const absentLine = result.lines.find((l) => l.componentCode === 'POTONGAN_ABSEN');
    expect(absentLine).toBeUndefined();
  });

  it('Rp 100,000 per absent day', () => {
    const result = payroll({ absentCount: 2 });
    expect(result.absentPenalty).toBe(200_000n);
    const absentLine = result.lines.find((l) => l.componentCode === 'POTONGAN_ABSEN');
    expect(absentLine?.amount).toBe(200_000n);
  });
});

// ─── Net Salary ──────────────────────────────────────────────────────────────

describe('Net salary calculation', () => {
  it('net = earnings - all deductions', () => {
    const result = payroll({
      baseSalary: 5_000_000n,
      isTaxable: true,
      dependentsCount: 0,
    });
    // 5M - (25K pph21 + 50K bpjs_kes + 100K bpjs_tk) = 4,825,000
    const expectedNet =
      5_000_000n - result.pph21Amount - result.bpjsKesEmployee - result.bpjsTkEmployee;
    expect(result.netSalary).toBe(expectedNet);
  });

  it('lines include SALARY_BASE, PPh21, BPJS_KES, BPJS_TK', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    const codes = result.lines.map((l) => l.componentCode);
    expect(codes).toContain('SALARY_BASE');
    expect(codes).toContain('PPh21');
    expect(codes).toContain('BPJS_KES');
    expect(codes).toContain('BPJS_TK');
  });
});

// ─── Additional Earnings ─────────────────────────────────────────────────────

describe('Additional earnings (THR, bonus, lembur)', () => {
  it('adds earning component and recalculates PPh21', () => {
    const result = payroll({
      baseSalary: 5_000_000n,
      additionalEarnings: [
        { code: 'TUNJANGAN_THR', amount: 5_000_000n, isTaxable: true, isBpjsBase: false },
      ],
    });
    // THR adds to gross → higher PPh21
    expect(result.totalEarnings).toBe(10_000_000n);
    expect(result.grossEarnings).toBe(10_000_000n);
    expect(result.pph21Amount).toBeGreaterThan(0n);
  });
});
