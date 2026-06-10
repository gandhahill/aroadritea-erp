/**
 * Payroll Engine Unit Tests — SD §19.5, §21.8
 *
 * Tests PPh 21 TER progressive calculation + BPJS caps + late penalty.
 * T-0243: employer BPJS portions.
 * T-0244: THR pro-rata + overtime engine.
 * T-0247: PPh21 TER bulanan + PTKP from data.
 */

import { describe, expect, it } from 'vitest';
import {
  type PayrollEmployeeContext,
  type PayrollResult,
  calculateOvertime,
  calculatePayroll,
  calculateTHRProRata,
} from '../src/payroll/payroll-engine.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function payroll(ctx: Partial<PayrollEmployeeContext>): PayrollResult {
  return calculatePayroll({
    employeeId: 'emp-1',
    baseSalary: 5_000_000n,
    isBpjsBase: true,
    isTaxable: true,
    dependentsCount: 0,
    maritalStatus: 'TK',
    additionalEarnings: [],
    lateMinutes: 0,
    lateCount: 0,
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

  it('T-0247: PTKP K/0 (married) reduces taxable income vs TK/0', () => {
    // TK/0 PTKP=54M, K/0 PTKP=58.5M
    const resultTK = payroll({ baseSalary: 5_000_000n, maritalStatus: 'TK', dependentsCount: 0 });
    const resultK = payroll({ baseSalary: 5_000_000n, maritalStatus: 'K', dependentsCount: 0 });
    expect(resultK.pph21Amount).toBeLessThan(resultTK.pph21Amount);
  });

  it('PTKP K/1 reduces taxable income', () => {
    // Same 5M/month, but PTKP = 63M → PKP = 60M-63M = 0 → no tax
    const resultK0 = payroll({ baseSalary: 5_000_000n, maritalStatus: 'TK', dependentsCount: 0 });
    const resultK1 = payroll({ baseSalary: 5_000_000n, maritalStatus: 'K', dependentsCount: 1 });
    expect(resultK1.pph21Amount).toBeLessThan(resultK0.pph21Amount);
    expect(resultK1.pph21Amount).toBe(0n); // K/1 PTKP = 63M > 60M gross
  });

  it('T-0247: PPh21 notes include TER and marital status', () => {
    const result = payroll({ baseSalary: 10_000_000n, maritalStatus: 'K', dependentsCount: 2 });
    const pphLine = result.lines.find((l) => l.componentCode === 'PPh21');
    expect(pphLine?.notes).toContain('TER bulanan');
    expect(pphLine?.notes).toContain('K/2');
  });
});

// ─── BPJS Tests ───────────────────────────────────────────────────────────────

describe('BPJS Kesehatan caps', () => {
  it('1% of salary below ceiling', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsKesEmployee).toBe(50_000n); // 5M × 1%
  });

  it('caps base at Rp 12,000,000 ceiling', () => {
    // 1% x capped base Rp 12,000,000 = Rp 120,000 employee contribution.
    const result = payroll({ baseSalary: 1_200_000_000n });
    expect(result.bpjsKesEmployee).toBe(120_000n);
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

  it('caps base at Rp 10,000,000 ceiling', () => {
    // 2% x capped base Rp 10,000,000 = Rp 200,000 employee contribution.
    const result = payroll({ baseSalary: 500_000_000n });
    expect(result.bpjsTkEmployee).toBe(200_000n);
  });
});

// ─── T-0243: Employer BPJS ────────────────────────────────────────────────────

describe('Employer BPJS portions (T-0243)', () => {
  it('calculates employer BPJS Kes at 4%', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsKesEmployer).toBe(200_000n); // 5M × 4%
  });

  it('calculates employer JKK at 0.24%', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsJkkEmployer).toBe(12_000n); // 5M × 0.24%
  });

  it('calculates employer JKM at 0.3%', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsJkmEmployer).toBe(15_000n); // 5M × 0.3%
  });

  it('calculates employer JHT at 3.7%', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsJhtEmployer).toBe(185_000n); // 5M × 3.7%
  });

  it('calculates employer JP at 2%', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    expect(result.bpjsJpEmployer).toBe(100_000n); // 5M × 2%
  });

  it('employer BPJS NOT deducted from employee net', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    const totalEmployerBpjs =
      result.bpjsKesEmployer +
      result.bpjsJkkEmployer +
      result.bpjsJkmEmployer +
      result.bpjsJhtEmployer +
      result.bpjsJpEmployer;
    expect(totalEmployerBpjs).toBeGreaterThan(0n);
    // Net = earnings - employee deductions only
    const expectedNet =
      5_000_000n - result.pph21Amount - result.bpjsKesEmployee - result.bpjsTkEmployee;
    expect(result.netSalary).toBe(expectedNet);
  });

  it('skips employer BPJS when isBpjsBase = false', () => {
    const result = payroll({ baseSalary: 5_000_000n, isBpjsBase: false });
    expect(result.bpjsKesEmployer).toBe(0n);
    expect(result.bpjsJkkEmployer).toBe(0n);
    expect(result.bpjsJkmEmployer).toBe(0n);
    expect(result.bpjsJhtEmployer).toBe(0n);
    expect(result.bpjsJpEmployer).toBe(0n);
  });
});

// ─── Late Penalty Tests ───────────────────────────────────────────────────────

describe('Late penalty (SOP §21.8)', () => {
  it('no penalty for 0 late events', () => {
    const result = payroll({ lateMinutes: 0, lateCount: 0 });
    expect(result.latePenalty).toBe(0n);
  });

  it('no penalty for up to 3 free lates', () => {
    const result = payroll({ lateMinutes: 120, lateCount: 3 });
    expect(result.latePenalty).toBe(0n);
  });

  it('penalty kicks in after 3 free lates', () => {
    // 4 late events -> 1 penalty x Rp 50,000
    const result = payroll({ lateMinutes: 80, lateCount: 4 });
    expect(result.latePenalty).toBe(50_000n);
  });

  it('multiple penalties for excessive lates', () => {
    // 10 late events -> 7 charged events x Rp 50,000
    const result = payroll({ lateMinutes: 250, lateCount: 10 });
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

  it('T-0243: lines include employer BPJS components', () => {
    const result = payroll({ baseSalary: 5_000_000n });
    const codes = result.lines.map((l) => l.componentCode);
    expect(codes).toContain('BPJS_KES_ER');
    expect(codes).toContain('BPJS_JKK_ER');
    expect(codes).toContain('BPJS_JKM_ER');
    expect(codes).toContain('BPJS_JHT_ER');
    expect(codes).toContain('BPJS_JP_ER');
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

// ─── T-0244: THR Pro-Rata Tests ────────────────────────────────────────────────

describe('THR Pro-Rata (T-0244)', () => {
  it('full THR for ≥ 12 months of service', () => {
    const thr = calculateTHRProRata(5_000_000n, 12);
    expect(thr).toBe(5_000_000n);
  });

  it('full THR for 24 months of service', () => {
    const thr = calculateTHRProRata(5_000_000n, 24);
    expect(thr).toBe(5_000_000n);
  });

  it('pro-rata THR for 6 months of service', () => {
    // 6/12 × 5M = 2.5M
    const thr = calculateTHRProRata(5_000_000n, 6);
    expect(thr).toBe(2_500_000n);
  });

  it('pro-rata THR for 3 months of service', () => {
    // 3/12 × 5M = 1.25M
    const thr = calculateTHRProRata(5_000_000n, 3);
    expect(thr).toBe(1_250_000n);
  });

  it('no THR for < 1 month of service', () => {
    const thr = calculateTHRProRata(5_000_000n, 0);
    expect(thr).toBe(0n);
  });
});

// ─── T-0244: Overtime Tests ─────────────────────────────────────────────────

describe('Overtime Calculation (T-0244)', () => {
  it('first hour at 1.5× rate', () => {
    // hourlyRate = 5M / 173 = 28,901 (rounded)
    // 1h × 1.5 = 28901 × 1.5 = 43,351 (approx)
    const ot = calculateOvertime(5_000_000n, 1);
    const hourlyRate = 5_000_000n / 173n; // 28,901
    const expected = (hourlyRate * 150n) / 100n; // 43,351
    expect(ot).toBe(expected);
  });

  it('subsequent hours at 2× rate', () => {
    // 3 hours: 1st at 1.5×, 2nd+3rd at 2×
    const ot = calculateOvertime(5_000_000n, 3);
    const hourlyRate = 5_000_000n / 173n;
    const firstHour = (hourlyRate * 150n) / 100n;
    const remainingHours = (hourlyRate * BigInt(Math.round(2 * 200))) / 100n;
    expect(ot).toBe(firstHour + remainingHours);
  });

  it('zero overtime for 0 hours', () => {
    expect(calculateOvertime(5_000_000n, 0)).toBe(0n);
  });

  it('zero overtime for negative hours', () => {
    expect(calculateOvertime(5_000_000n, -1)).toBe(0n);
  });
});
