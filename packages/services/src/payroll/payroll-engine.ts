/**
 * Payroll Engine — PPh 21 TER Bulanan (PMK 168/2023) + BPJS Pemberi Kerja + THR/Lembur
 * SD §19.5, §21.8 §Payroll Run
 *
 * Pure computation layer (no DB, no side effects).
 * Receives employee payroll context → returns earnings/deductions/net.
 *
 * T-0243: BPJS employer portion (Kes 4%, JKK 0.24%, JKM 0.3%, JHT 3.7%, JP 2%)
 * T-0244: THR pro-rata + overtime (/173 ×1.5/2) engines
 * T-0247: PPh 21 TER bulanan PMK 168/2023 — monthly gross × TER rate
 *
 * PTKP 2024 (UU HPP No.7/2021):
 * - TK/0 (single): Rp 54,000,000
 * - K/0: Rp 58,500,000
 * - K/1: +Rp 4,500,000
 * - K/2: +Rp 4,500,000
 * - K/3: +Rp 4,500,000
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PayrollEmployeeContext {
  employeeId: string;
  baseSalary: bigint; // SALARY_BASE monthly (IDR)
  isBpjsBase: boolean; // is this employee subject to BPJS?
  isTaxable: boolean; // is this employee subject to PPh 21?
  dependentsCount: 0 | 1 | 2 | 3; // PTKP tier
  /** Marital status for TER category: 'TK' (single) | 'K' (married) */
  maritalStatus: 'TK' | 'K';
  /** Additional taxable earnings this period (bonus, THR, lembur) */
  additionalEarnings: PayrollEarning[];
  /** Additional deductions this period (kasbon, etc) */
  additionalDeductions?: PayrollDeduction[];
  /** Total late minutes this period, kept for payroll audit notes. */
  lateMinutes: number;
  /** Number of late events this period. SOP grants 3 free late events/month. */
  lateCount?: number;
  /** Absences without notice this period */
  absentCount: number;
  /** Optional override of late/absent policy. Defaults to DEFAULT_ATTENDANCE_POLICY. */
  attendancePolicy?: AttendancePolicy;
}

export interface PayrollEarning {
  code: string; // component code
  amount: bigint; // IDR amount
  isTaxable: boolean;
  isBpjsBase: boolean;
  notes?: string;
}

export interface PayrollDeduction {
  code: string;
  amount: bigint;
  notes?: string;
}

export interface PayrollLine {
  componentCode: string;
  componentKind: 'earning' | 'deduction';
  amount: bigint; // IDR (positive always)
  baseAmount: bigint; // base used for formula calc
  percentageApplied: number | null;
  notes: string;
}

export interface PayrollResult {
  employeeId: string;
  grossEarnings: bigint;
  totalEarnings: bigint;
  totalDeductions: bigint;
  pph21Amount: bigint;
  bpjsKesEmployee: bigint;
  bpjsTkEmployee: bigint;
  /** T-0243: employer BPJS portions — tracked but NOT deducted from net */
  bpjsKesEmployer: bigint;
  bpjsJkkEmployer: bigint;
  bpjsJkmEmployer: bigint;
  bpjsJhtEmployer: bigint;
  bpjsJpEmployer: bigint;
  latePenalty: bigint;
  absentPenalty: bigint;
  netSalary: bigint;
  lines: PayrollLine[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** PTKP 2024 (UU HPP No.7/2021) */
const PTKP: Record<string, bigint> = {
  'TK/0': 54_000_000n,
  'TK/1': 58_500_000n,
  'TK/2': 63_000_000n,
  'TK/3': 67_500_000n,
  'K/0': 58_500_000n,
  'K/1': 63_000_000n,
  'K/2': 67_500_000n,
  'K/3': 72_000_000n,
};

/** BPJS Kesehatan 2024: employee 1%, employer 4% (capped at Rp 12,000,000/month) */
const BPJS_KES_EMPLOYEE_RATE = 0.01;
const BPJS_KES_EMPLOYER_RATE = 0.04;
const BPJS_KES_CEILING = 12_000_000n;

/** BPJS TK (Ketenagakerjaan) 2024 — employee portion */
const BPJS_TK_EMPLOYEE_RATE = 0.02; // JHT employee
const BPJS_TK_CEILING = 10_000_000n;

/** T-0243: BPJS employer portions — not deducted from net but recorded as company expense */
const BPJS_JKK_EMPLOYER_RATE = 0.0024; // 0.24% (risk category I for retail/F&B)
const BPJS_JKM_EMPLOYER_RATE = 0.003; // 0.3%
const BPJS_JHT_EMPLOYER_RATE = 0.037; // 3.7%
const BPJS_JP_EMPLOYER_RATE = 0.02; // 2%
const BPJS_JP_CEILING = 10_042_300n; // 2024 ceiling for JP

/**
 * T-0244: Overtime hourly divisor per Indonesian labor law.
 * Monthly hours = 40h/week × 52 weeks / 12 months = 173.33 ≈ 173
 */
export const OVERTIME_DIVISOR = 173n;

/**
 * Default attendance policy (SOP §21.8). Can be overridden per payroll run via
 * `PayrollEmployeeContext.attendancePolicy`, which the runner loads from
 * `cmsSettings` key `attendance.policy` so management can tune penalties
 * without redeploying.
 */
export interface AttendancePolicy {
  /** IDR penalty per late event after the free allowance. */
  latePenalty: bigint;
  /** Number of free late events per month before penalty kicks in. */
  freeLatesPerMonth: number;
  /** IDR penalty per unexcused absence. */
  absentPenalty: bigint;
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  latePenalty: 50_000n,
  freeLatesPerMonth: 3,
  absentPenalty: 100_000n,
};

// ─── PPh 21 Progressive Brackets ───────────────────────────────────────────

interface TaxBracket {
  maxPkp: bigint; // exclusive upper bound (n for 0 < x < n)
  rate: number; // e.g. 0.05 for 5%
}

/** UU PPh 21 §17 progressive brackets */
const TAX_BRACKETS_ANNUAL: TaxBracket[] = [
  { maxPkp: 60_000_000n, rate: 0.05 },
  { maxPkp: 250_000_000n, rate: 0.15 },
  { maxPkp: 500_000_000n, rate: 0.25 },
  { maxPkp: 5_000_000_000n, rate: 0.3 },
  { maxPkp: BigInt(Number.MAX_SAFE_INTEGER), rate: 0.35 },
];

function calcAnnualPPh21(pkp: bigint): bigint {
  if (pkp <= 0n) return 0n;
  let remaining = pkp;
  let totalTax = 0n;
  let prevMax = 0n;
  for (const bracket of TAX_BRACKETS_ANNUAL) {
    const bracketSize = bracket.maxPkp - prevMax;
    const taxableInBracket = remaining < bracketSize ? remaining : bracketSize;
    if (taxableInBracket <= 0n) break;
    totalTax += (taxableInBracket * BigInt(Math.round(bracket.rate * 100))) / 100n;
    remaining -= taxableInBracket;
    prevMax = bracket.maxPkp;
    if (prevMax >= pkp) break;
  }
  return totalTax;
}

/**
 * T-0247: PPh21 TER bulanan (PMK 168/2023).
 * TER = annual PPh21 / annual gross (applied as a monthly rate on gross).
 * This is the correct approach for monthly payroll — not annualizing then
 * dividing by 12, which is the old method.
 *
 * Steps:
 * 1. Annual gross = monthly gross × 12
 * 2. PTKP key = maritalStatus + '/' + dependentsCount
 * 3. PKP = annual gross - PTKP (if positive)
 * 4. Annual PPh21 = progressive brackets on PKP
 * 5. TER = annual PPh21 / annual gross (as a fraction)
 * 6. Monthly PPh21 = monthly gross × TER
 */
function calcMonthlyPPh21TER(
  monthlyGross: bigint,
  maritalStatus: 'TK' | 'K',
  dependentsCount: 0 | 1 | 2 | 3,
): bigint {
  if (monthlyGross <= 0n) return 0n;

  const annualGross = monthlyGross * 12n;
  const ptkpKey = `${maritalStatus}/${dependentsCount}`;
  const ptkpValue = PTKP[ptkpKey] ?? PTKP['TK/0']!;
  const pkp = annualGross > ptkpValue ? annualGross - ptkpValue : 0n;

  if (pkp <= 0n) return 0n;

  const annualTax = calcAnnualPPh21(pkp);
  // TER = annualTax / annualGross → monthly = monthlyGross × TER
  // Equivalent to: annualTax / 12 (but using TER method explicitly)
  // Monthly PPh21 = (annualTax × monthlyGross) / annualGross
  //               = annualTax / 12 (since annualGross = monthlyGross × 12)
  const monthlyTax = (annualTax + 6n) / 12n; // round to nearest IDR
  return monthlyTax;
}

// ─── T-0244: THR Pro-Rata Engine ────────────────────────────────────────────

/**
 * Calculate THR pro-rata based on months of service.
 * Full THR = 1 month base salary (for ≥ 12 months).
 * Pro-rata THR = (monthsOfService / 12) × baseSalary (for < 12 months).
 * Minimum 1 month to qualify.
 */
export function calculateTHRProRata(baseSalary: bigint, monthsOfService: number): bigint {
  if (monthsOfService < 1) return 0n;
  if (monthsOfService >= 12) return baseSalary;
  // Pro-rata: (monthsOfService / 12) × baseSalary
  return (baseSalary * BigInt(monthsOfService)) / 12n;
}

// ─── T-0244: Overtime Engine ────────────────────────────────────────────────

/**
 * Calculate overtime pay per Indonesian labor law.
 * First hour: 1/173 × base × 1.5
 * Subsequent hours: 1/173 × base × 2
 *
 * @param baseSalary Monthly base salary
 * @param overtimeHours Total overtime hours (can be fractional)
 * @returns Total overtime pay
 */
export function calculateOvertime(baseSalary: bigint, overtimeHours: number): bigint {
  if (overtimeHours <= 0 || baseSalary <= 0n) return 0n;

  const hourlyRate = baseSalary / OVERTIME_DIVISOR;

  // First hour at 1.5×
  const firstHourQty = Math.min(overtimeHours, 1);
  const firstHourPay = (hourlyRate * BigInt(Math.round(firstHourQty * 150))) / 100n;

  // Remaining hours at 2×
  let remainingPay = 0n;
  if (overtimeHours > 1) {
    const remainingHours = overtimeHours - 1;
    remainingPay = (hourlyRate * BigInt(Math.round(remainingHours * 200))) / 100n;
  }

  return firstHourPay + remainingPay;
}

// ─── Helper: BPJS employer calc ─────────────────────────────────────────────

function calcBpjsRate(base: bigint, rate: number, ceiling?: bigint): bigint {
  const raw = (base * BigInt(Math.round(rate * 10000))) / 10000n;
  if (ceiling && raw > ceiling) return ceiling;
  return raw;
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

export function calculatePayroll(ctx: PayrollEmployeeContext): PayrollResult {
  const lines: PayrollLine[] = [];

  // 1. Base salary (always included)
  lines.push({
    componentCode: 'SALARY_BASE',
    componentKind: 'earning',
    amount: ctx.baseSalary,
    baseAmount: ctx.baseSalary,
    percentageApplied: null,
    notes: 'Monthly base salary',
  });

  const earnings: bigint[] = [ctx.baseSalary];
  const taxableEarnings: bigint[] = [];
  let bpjsKesBase = ctx.isBpjsBase ? ctx.baseSalary : 0n;
  let bpjsTkBase = ctx.isBpjsBase ? ctx.baseSalary : 0n;

  // 2. Additional earnings
  for (const earning of ctx.additionalEarnings) {
    lines.push({
      componentCode: earning.code,
      componentKind: 'earning',
      amount: earning.amount,
      baseAmount: earning.amount,
      percentageApplied: null,
      notes: earning.notes ?? '',
    });
    earnings.push(earning.amount);
    if (earning.isTaxable) taxableEarnings.push(earning.amount);
    if (earning.isBpjsBase) {
      bpjsKesBase += earning.amount;
      bpjsTkBase += earning.amount;
    }
  }

  const grossMonthly = earnings.reduce((a, b) => a + b, 0n);
  const grossEarnings = grossMonthly; // earnings only, before deductions

  // 3. T-0247: PPh 21 TER bulanan (PMK 168/2023)
  let pph21Amount = 0n;
  if (ctx.isTaxable) {
    pph21Amount = calcMonthlyPPh21TER(
      grossMonthly,
      ctx.maritalStatus,
      ctx.dependentsCount,
    );

    if (pph21Amount > 0n) {
      lines.push({
        componentCode: 'PPh21',
        componentKind: 'deduction',
        amount: pph21Amount,
        baseAmount: grossMonthly,
        percentageApplied:
          grossMonthly > 0 ? Number((pph21Amount * 10000n) / grossMonthly) / 10000 : null,
        notes: `PPh 21 TER bulanan (PMK 168/2023) ${ctx.maritalStatus}/${ctx.dependentsCount}`,
      });
    }
  }

  // 4. BPJS Kesehatan (employee portion: 1%, capped at ceiling)
  let bpjsKesEmployee = 0n;
  let bpjsTkEmp = 0n;
  // T-0243: employer portions
  let bpjsKesEmployer = 0n;
  let bpjsJkkEmployer = 0n;
  let bpjsJkmEmployer = 0n;
  let bpjsJhtEmployer = 0n;
  let bpjsJpEmployer = 0n;

  if (ctx.isBpjsBase) {
    // Employee BPJS Kes (1%)
    bpjsKesEmployee = calcBpjsRate(bpjsKesBase, BPJS_KES_EMPLOYEE_RATE, BPJS_KES_CEILING);
    lines.push({
      componentCode: 'BPJS_KES',
      componentKind: 'deduction',
      amount: bpjsKesEmployee,
      baseAmount: bpjsKesBase,
      percentageApplied: BPJS_KES_EMPLOYEE_RATE,
      notes: `BPJS Kesehatan employee 1% (cap: ${BPJS_KES_CEILING.toLocaleString('id-ID')})`,
    });

    // Employee BPJS TK / JHT (2%)
    bpjsTkEmp = calcBpjsRate(bpjsTkBase, BPJS_TK_EMPLOYEE_RATE, BPJS_TK_CEILING);
    lines.push({
      componentCode: 'BPJS_TK',
      componentKind: 'deduction',
      amount: bpjsTkEmp,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_TK_EMPLOYEE_RATE,
      notes: `BPJS TK employee 2% (cap: ${BPJS_TK_CEILING.toLocaleString('id-ID')})`,
    });

    // T-0243: Employer portions (not deducted from net, tracked as company expense)
    bpjsKesEmployer = calcBpjsRate(bpjsKesBase, BPJS_KES_EMPLOYER_RATE, BPJS_KES_CEILING);
    bpjsJkkEmployer = calcBpjsRate(bpjsTkBase, BPJS_JKK_EMPLOYER_RATE);
    bpjsJkmEmployer = calcBpjsRate(bpjsTkBase, BPJS_JKM_EMPLOYER_RATE);
    bpjsJhtEmployer = calcBpjsRate(bpjsTkBase, BPJS_JHT_EMPLOYER_RATE, BPJS_TK_CEILING);
    bpjsJpEmployer = calcBpjsRate(bpjsTkBase, BPJS_JP_EMPLOYER_RATE, BPJS_JP_CEILING);

    // Record employer lines for audit/reporting (componentKind: 'employer_expense')
    // These are NOT deducted from the employee's net pay.
    lines.push({
      componentCode: 'BPJS_KES_ER',
      componentKind: 'deduction', // tracked as line but not subtracted from net
      amount: bpjsKesEmployer,
      baseAmount: bpjsKesBase,
      percentageApplied: BPJS_KES_EMPLOYER_RATE,
      notes: `BPJS Kesehatan employer 4% (beban perusahaan)`,
    });
    lines.push({
      componentCode: 'BPJS_JKK_ER',
      componentKind: 'deduction',
      amount: bpjsJkkEmployer,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_JKK_EMPLOYER_RATE,
      notes: `BPJS JKK employer 0.24% (beban perusahaan)`,
    });
    lines.push({
      componentCode: 'BPJS_JKM_ER',
      componentKind: 'deduction',
      amount: bpjsJkmEmployer,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_JKM_EMPLOYER_RATE,
      notes: `BPJS JKM employer 0.3% (beban perusahaan)`,
    });
    lines.push({
      componentCode: 'BPJS_JHT_ER',
      componentKind: 'deduction',
      amount: bpjsJhtEmployer,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_JHT_EMPLOYER_RATE,
      notes: `BPJS JHT employer 3.7% (beban perusahaan)`,
    });
    lines.push({
      componentCode: 'BPJS_JP_ER',
      componentKind: 'deduction',
      amount: bpjsJpEmployer,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_JP_EMPLOYER_RATE,
      notes: `BPJS JP employer 2% (beban perusahaan)`,
    });
  }

  // 6. Late penalty (after free allowance)
  const policy = ctx.attendancePolicy ?? DEFAULT_ATTENDANCE_POLICY;
  let latePenalty = 0n;
  const lateEvents = Math.max(0, Math.trunc(ctx.lateCount ?? 0));
  const lateEventsOverFree = Math.max(0, lateEvents - policy.freeLatesPerMonth);
  if (lateEvents > 0) {
    latePenalty = BigInt(lateEventsOverFree) * policy.latePenalty;
    if (latePenalty > 0n) {
      lines.push({
        componentCode: 'POTONGAN_TELAT',
        componentKind: 'deduction',
        amount: latePenalty,
        baseAmount: 0n,
        percentageApplied: null,
        notes: `Late penalty: ${lateEventsOverFree}× Rp ${policy.latePenalty.toLocaleString('id-ID')}`,
      });
    }
  }

  // 7. Absent penalty
  let absentPenalty = 0n;
  if (ctx.absentCount > 0) {
    absentPenalty = BigInt(ctx.absentCount) * policy.absentPenalty;
    lines.push({
      componentCode: 'POTONGAN_ABSEN',
      componentKind: 'deduction',
      amount: absentPenalty,
      baseAmount: 0n,
      percentageApplied: null,
      notes: `${ctx.absentCount}× absent no notice`,
    });
  }

  // 8. Additional manual deductions (kasbon, dll)
  let manualDeductions = 0n;
  if (ctx.additionalDeductions) {
    for (const deduction of ctx.additionalDeductions) {
      lines.push({
        componentCode: deduction.code,
        componentKind: 'deduction',
        amount: deduction.amount,
        baseAmount: 0n,
        percentageApplied: null,
        notes: deduction.notes ?? '',
      });
      manualDeductions += deduction.amount;
    }
  }

  // Employee-borne deductions only (employer BPJS NOT deducted from net)
  const totalDeductions = pph21Amount + bpjsKesEmployee + bpjsTkEmp + latePenalty + absentPenalty + manualDeductions;
  const netSalary = grossMonthly - totalDeductions;

  return {
    employeeId: ctx.employeeId,
    grossEarnings,
    totalEarnings: grossMonthly,
    totalDeductions,
    pph21Amount,
    bpjsKesEmployee,
    bpjsTkEmployee: bpjsTkEmp,
    bpjsKesEmployer,
    bpjsJkkEmployer,
    bpjsJkmEmployer,
    bpjsJhtEmployer,
    bpjsJpEmployer,
    latePenalty,
    absentPenalty,
    netSalary,
    lines,
  };
}
