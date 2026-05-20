/**
 * Payroll Engine — PPh 21 TER + Line Builder
 * SD §19.5, §21.8 §Payroll Run
 *
 * Pure computation layer (no DB, no side effects).
 * Receives employee payroll context → returns earnings/deductions/net.
 *
 * PPh 21 TER (Tarif Efektif Rata-rata):
 * - Annual gross → PKP → progressive tax → monthly TER
 * - TER = annual PPh21 / annual gross (applied as monthly rate)
 *
 * PTKP 2024 (UU HPP No.7/2021):
 * - K/0 (single): Rp 54,000,000
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
  /** Additional taxable earnings this period (bonus, THR, lembur) */
  additionalEarnings: PayrollEarning[];
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
  latePenalty: bigint;
  absentPenalty: bigint;
  netSalary: bigint;
  lines: PayrollLine[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** PTKP 2024 (UU HPP No.7/2021) */
const PTKP: Record<0 | 1 | 2 | 3, bigint> = {
  0: 54_000_000n,
  1: 58_500_000n,
  2: 63_000_000n,
  3: 67_500_000n,
};

/** BPJS Kesehatan 2024: employee 1%, employer 4% (capped at Rp 12,000,000/month) */
const BPJS_KES_EMPLOYEE_RATE = 0.01;
const BPJS_KES_CEILING = 12_000_000n;

/** BPJS TK 2024: employee 2%, employer 3.7% (capped at Rp 10,000,000/month) */
const BPJS_TK_EMPLOYEE_RATE = 0.02;
const BPJS_TK_CEILING = 10_000_000n;

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
  const totalTaxable = taxableEarnings.reduce((a, b) => a + b, 0n);

  // 3. PPh 21 TER calculation (SD §19.5)
  let pph21Amount = 0n;
  if (ctx.isTaxable) {
    // Annualize: gross monthly × 12
    const annualGross = grossMonthly * 12n;
    const ptkpValue = PTKP[ctx.dependentsCount];
    const pkp = annualGross > ptkpValue ? annualGross - ptkpValue : 0n;
    const annualTax = calcAnnualPPh21(pkp);
    // Monthly TER = annual tax / 12 (rounded to nearest IDR)
    pph21Amount = (annualTax + 6n) / 12n; // round up

    lines.push({
      componentCode: 'PPh21',
      componentKind: 'deduction',
      amount: pph21Amount,
      baseAmount: grossMonthly,
      percentageApplied:
        grossMonthly > 0 ? Number((pph21Amount * 100n) / grossMonthly) / 100 : null,
      notes: 'PPh 21 TER monthly (progressive)',
    });
  }

  // 4. BPJS Kesehatan (employee portion: 1%, capped at ceiling)
  let bpjsKesEmployee = 0n;
  let bpjsTkEmp = 0n;
  if (ctx.isBpjsBase) {
    const bpjsKesRaw = (bpjsKesBase * BigInt(Math.round(BPJS_KES_EMPLOYEE_RATE * 100))) / 100n;
    bpjsKesEmployee = bpjsKesRaw > BPJS_KES_CEILING ? BPJS_KES_CEILING : bpjsKesRaw;
    lines.push({
      componentCode: 'BPJS_KES',
      componentKind: 'deduction',
      amount: bpjsKesEmployee,
      baseAmount: bpjsKesBase,
      percentageApplied: BPJS_KES_EMPLOYEE_RATE,
      notes: `BPJS Kesehatan employee 1% (cap: ${BPJS_KES_CEILING.toLocaleString('id-ID')})`,
    });

    // 5. BPJS TK (employee portion: 2%, capped at ceiling)
    const bpjsTkRaw = (bpjsTkBase * BigInt(Math.round(BPJS_TK_EMPLOYEE_RATE * 100))) / 100n;
    bpjsTkEmp = bpjsTkRaw > BPJS_TK_CEILING ? BPJS_TK_CEILING : bpjsTkRaw;
    lines.push({
      componentCode: 'BPJS_TK',
      componentKind: 'deduction',
      amount: bpjsTkEmp,
      baseAmount: bpjsTkBase,
      percentageApplied: BPJS_TK_EMPLOYEE_RATE,
      notes: `BPJS TK employee 2% (cap: ${BPJS_TK_CEILING.toLocaleString('id-ID')})`,
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

  const totalDeductions = pph21Amount + bpjsKesEmployee + bpjsTkEmp + latePenalty + absentPenalty;
  const netSalary = grossMonthly - totalDeductions;

  return {
    employeeId: ctx.employeeId,
    grossEarnings,
    totalEarnings: grossMonthly,
    totalDeductions,
    pph21Amount,
    bpjsKesEmployee,
    bpjsTkEmployee: bpjsTkEmp,
    latePenalty,
    absentPenalty,
    netSalary,
    lines,
  };
}
