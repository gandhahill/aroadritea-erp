/**
 * Salary components seed data — SD §21.8 §Payroll Run, §9.6 §salary_components
 *
 * Components defined per payroll engine requirements:
 * - `kind`: 'earning' | 'deduction'
 * - `is_taxable`: included in PPh 21 TER calculation
 * - `is_bpjs_base`: included in BPJS Kesehatan + TK base salary (up to PTKP ceiling)
 * - `fixedAmount` vs `percentage`: one must be set, the other null
 *
 * BPJS 2024 ceilings (subject to law updates):
 * - BPJS Kesehatan: max Rp 12,000,000/month (12% of earnings, 1% employee)
 * - BPJS TK: max Rp 10,000,000/month (5.24% of earnings, 2% employee)
 */

export const SALARY_COMPONENTS_SEED = [
  // ── Earnings ────────────────────────────────────────────────
  {
    id: 'comp-salary-base',
    code: 'SALARY_BASE',
    name: { id: 'Gaji Pokok', en: 'Base Salary', zh: '基本工资' },
    kind: 'earning',
    fixedAmount: null,
    percentage: null,
    isTaxable: true,
    isBpjsBase: true,
    isActive: true,
  },
  {
    id: 'comp-tunjangan-thr',
    code: 'TUNJANGAN_THR',
    name: { id: 'Tunjangan Hari Raya', en: 'Holiday Allowance', zh: '过节费' },
    kind: 'earning',
    fixedAmount: null,
    percentage: '1', // 1 month salary (formula: base × 1)
    isTaxable: true,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-lembur',
    code: 'LEMBUR',
    name: { id: 'Lembur', en: 'Overtime', zh: '加班费' },
    kind: 'earning',
    fixedAmount: null,
    percentage: null, // calculated per hour: (base / 173) × 1.5
    isTaxable: true,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bonus',
    code: 'BONUS',
    name: { id: 'Bonus', en: 'Bonus', zh: '奖金' },
    kind: 'earning',
    fixedAmount: null,
    percentage: null,
    isTaxable: true,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-tunjangan-transport',
    code: 'TUNJANGAN_TRANSPORT',
    name: { id: 'Tunjangan Transport', en: 'Transport Allowance', zh: '交通补贴' },
    kind: 'earning',
    fixedAmount: null,
    percentage: null,
    isTaxable: true,
    isBpjsBase: false,
    isActive: true,
  },

  // ── Deductions ────────────────────────────────────────────────
  {
    id: 'comp-potongan-telat',
    code: 'POTONGAN_TELAT',
    name: { id: 'Potongan Terlambat', en: 'Late Penalty', zh: '迟到扣款' },
    kind: 'deduction',
    fixedAmount: '50000', // Rp 50,000 per late (SD §21.8 SOP attendance)
    percentage: null,
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-potongan-absen',
    code: 'POTONGAN_ABSEN',
    name: { id: 'Potongan Tidak Kabari', en: 'No-Notice Absence Penalty', zh: '无故缺勤扣款' },
    kind: 'deduction',
    fixedAmount: '100000', // Rp 100,000 (SD §21.8 SOP attendance)
    percentage: null,
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bpjs-kes',
    code: 'BPJS_KES',
    name: { id: 'BPJS Kesehatan', en: 'BPJS Kesehatan', zh: 'BPJS健康保险' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.01', // 1% of base (employee portion), capped at ceiling
    isTaxable: false,
    isBpjsBase: true,
    isActive: true,
  },
  {
    id: 'comp-bpjs-tk',
    code: 'BPJS_TK',
    name: { id: 'BPJS Ketenagakerjaan', en: 'BPJS Tenaga Kerja', zh: 'BPJS工伤保险' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.02', // 2% of base (employee portion), capped at ceiling
    isTaxable: false,
    isBpjsBase: true,
    isActive: true,
  },
  {
    id: 'comp-pph21',
    code: 'PPh21',
    name: { id: 'PPh Pasal 21', en: 'Income Tax PPh 21', zh: '个人所得税' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: null, // calculated by payroll engine (progressive TER)
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-pinjaman',
    code: 'PINJAMAN',
    name: { id: 'Potongan Pinjaman', en: 'Loan Repayment', zh: '贷款还款' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: null,
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  // T-0243: Employer BPJS components (beban perusahaan)
  {
    id: 'comp-bpjs-kes-er',
    code: 'BPJS_KES_ER',
    name: { id: 'BPJS Kes Pemberi Kerja', en: 'BPJS Kes Employer', zh: 'BPJS健康雇主' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.04', // 4%
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bpjs-jkk-er',
    code: 'BPJS_JKK_ER',
    name: { id: 'BPJS JKK Pemberi Kerja', en: 'BPJS JKK Employer', zh: 'BPJS工伤雇主' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.0024', // 0.24%
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bpjs-jkm-er',
    code: 'BPJS_JKM_ER',
    name: { id: 'BPJS JKM Pemberi Kerja', en: 'BPJS JKM Employer', zh: 'BPJS死亡雇主' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.003', // 0.3%
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bpjs-jht-er',
    code: 'BPJS_JHT_ER',
    name: { id: 'BPJS JHT Pemberi Kerja', en: 'BPJS JHT Employer', zh: 'BPJS养老雇主' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.037', // 3.7%
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
  {
    id: 'comp-bpjs-jp-er',
    code: 'BPJS_JP_ER',
    name: { id: 'BPJS JP Pemberi Kerja', en: 'BPJS JP Employer', zh: 'BPJS退休雇主' },
    kind: 'deduction',
    fixedAmount: null,
    percentage: '0.02', // 2%
    isTaxable: false,
    isBpjsBase: false,
    isActive: true,
  },
];
