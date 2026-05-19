/**
 * HR & Payroll schema — SD §9.6, §21.8
 *
 * Tables:
 * - employees              — employee records (extensible with custom fields)
 * - employment_contracts  — contract history (PKWT / PKWTT, salary, period)
 * - shift_definitions      — shift schedules (pagi: 09:30–17:30, siang: 14:30–22:30)
 * - attendance           — check-in/out records (GPS or QR scan)
 * - leave_types           — master leave types (annual, sick, unpaid, etc.)
 * - leave_balances        — per-employee leave balance per type per year
 * - leave_requests        — leave application + approval workflow
 * - salary_components     — master salary components (SD §21.8 §Payroll Run)
 * - payrolls              — payroll header per period
 * - payroll_lines         — per-employee per component in a payroll run
 * - disciplinary_actions  — SP1 / SP2 / SP3 with attachment
 *
 * Audit columns per SD §8.1.
 * All employee PII ( KTP, NPWP, phone, address ) must be encrypted at rest.
 * Masked in audit log per SD §19.3.
 */

import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol, versionCol } from './common';

// ─── Employees ──────────────────────────────────────────────────────────────────

/**
 * Employee status:
 * - 'active'       → employed
 * - 'probation'    → trial period (≤ 3 months per Indonesian law)
 * - 'on_leave'     → unpaid long-term leave
 * - 'terminated'  → resigned / dismissed
 */
export const employees = pgTable(
  'employees',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    // Core identity (encrypted at rest — UU PDP)
    nik: text('nik').notNull(), // KTP number — encrypted
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'), // encrypted
    address: text('address'), // encrypted

    // Employment
    status: text('status').notNull().default('probation'),
    // 'probation' | 'active' | 'on_leave' | 'terminated'

    position: text('position').notNull(), // e.g. 'Barista', 'Supervisor', 'Director'
    department: text('department'), // e.g. 'Store', 'HQ', 'Kitchen'

    hireDate: timestamp('hire_date', { withTimezone: true }).notNull(),
    probationEndDate: timestamp('probation_end_date', { withTimezone: true }),
    contractType: text('contract_type').notNull(), // 'pkwt' | 'pkwtt'
    workSchedule: text('work_schedule').notNull().default('fulltime'), // 'fulltime' | 'parttime' | 'shift'

    // Tax & social security (encrypted at rest)
    npwp: text('npwp'), // encrypted
    bpjsKesehatan: text('bpjs_kesehatan'), // encrypted
    bpjsTenagakerja: text('bpjs_tenagakerja'), // encrypted

    // Emergency contact
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'), // encrypted

    // Payroll (references employment_contracts)
    currentContractId: text('current_contract_id'), // FK employment_contracts

    ...versionCol,
    ...auditCols,
  },
  (table) => [
    uniqueIndex('employees_tenant_nik_idx').on(table.tenantId, table.nik),
    index('employees_tenant_status_idx').on(table.tenantId, table.status),
    index('employees_tenant_location_idx').on(table.tenantId, table.locationId),
  ],
);

// ─── Employment Contracts ────────────────────────────────────────────────────

/**
 * Contract history per employee (SD §9.6 §employment_contracts).
 * One active contract at a time (is_active = true).
 */
export const employmentContracts = pgTable(
  'employment_contracts',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    employeeId: text('employee_id').notNull(), // FK employees

    contractType: text('contract_type').notNull(), // 'pkwt' | 'pkwtt'
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }), // NULL for PKWTT (permanent)

    isActive: boolean('is_active').notNull().default(true),
    baseSalary: bigint('base_salary', { mode: 'bigint' }).notNull(), // IDR, monthly

    notes: text('notes'),

    ...auditCols,
  },
  (table) => [
    index('employment_contracts_employee_idx').on(table.employeeId),
    index('employment_contracts_active_idx').on(table.isActive),
  ],
);

// ─── Shift Definitions ───────────────────────────────────────────────────────

/**
 * Master shift definitions (SD §21.8.1).
 * Referenced by attendance for SOP check.
 */
export const shiftDefinitions = pgTable(
  'shift_definitions',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    name: text('name').notNull(), // e.g. 'Shift Pagi', 'Shift Siang'
    code: text('code').notNull(), // e.g. 'PAGI', 'SIANG'

    startTime: text('start_time').notNull(), // 'HH:MM' in WIB, e.g. '09:30'
    endTime: text('end_time').notNull(), // 'HH:MM' in WIB, e.g. '17:30'

    breakStart: text('break_start'), // 'HH:MM'
    breakEnd: text('break_end'), // 'HH:MM'

    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (table) => [
    uniqueIndex('shift_definitions_tenant_code_idx').on(table.tenantId, table.code),
    index('shift_definitions_tenant_active_idx').on(table.isActive),
  ],
);

// ─── Recruitment (Job Openings + Applicants) ─────────────────────────────────

/**
 * Job openings (lowongan). Created by HR, broadcast on the public site
 * (future) or shared via WhatsApp / IG link. Status drives whether the
 * opening is still accepting applications.
 */
export const jobOpenings = pgTable(
  'job_openings',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    title: text('title').notNull(),
    department: text('department'),
    summary: text('summary'),
    requirements: text('requirements'),
    benefits: text('benefits'),
    /** 'draft' | 'open' | 'closed' */
    status: text('status').notNull().default('draft'),
    headcount: integer('headcount').notNull().default(1),
    openDate: date('open_date'),
    closeDate: date('close_date'),

    ...auditCols,
  },
  (table) => [index('job_openings_tenant_status_idx').on(table.tenantId, table.status)],
);

/**
 * Applicants for job openings. Tracks the simple recruitment pipeline
 * applied → screen → interview → offer → hired (or rejected/withdrawn).
 * `hiredEmployeeId` links to the created employee record when the
 * applicant is hired.
 */
export const jobApplicants = pgTable(
  'job_applicants',
  {
    ...pk,
    ...tenantCol,

    openingId: text('opening_id').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'), // PII encrypted at-rest
    /** 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn' */
    stage: text('stage').notNull().default('applied'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    resumeUrl: text('resume_url'),
    notes: text('notes'),

    /** Set when stage transitions to 'hired'; FK employees.id */
    hiredEmployeeId: text('hired_employee_id'),

    ...auditCols,
  },
  (table) => [
    index('job_applicants_opening_idx').on(table.openingId),
    index('job_applicants_tenant_stage_idx').on(table.tenantId, table.stage),
  ],
);

// ─── Shift Assignments (Roster) ───────────────────────────────────────────────

/**
 * Weekly shift roster — replaces the WhatsApp announcement that managers
 * currently send each week. One row per (employee, date, shift).
 * `kind = 'off'` rows record planned days off without a shift definition.
 */
export const shiftAssignments = pgTable(
  'shift_assignments',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    employeeId: text('employee_id').notNull(),
    workDate: date('work_date').notNull(),
    /** 'shift' = working an actual shift, 'off' = planned day off */
    kind: text('kind').notNull().default('shift'),
    /** FK shift_definitions; nullable when kind = 'off' */
    shiftDefinitionId: text('shift_definition_id'),
    notes: text('notes'),

    ...auditCols,
  },
  (table) => [
    index('shift_assignments_employee_date_idx').on(table.employeeId, table.workDate),
    index('shift_assignments_tenant_loc_date_idx').on(
      table.tenantId,
      table.locationId,
      table.workDate,
    ),
    uniqueIndex('shift_assignments_unique_per_employee_date_shift_idx').on(
      table.employeeId,
      table.workDate,
      table.shiftDefinitionId,
    ),
  ],
);

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * Check-in/out records (SD §21.8 §Attendance).
 * GPS location stored as JSON: { lat, lng, accuracy_m, source }
 * Late deduction calculated in payroll service.
 */
export const attendance = pgTable(
  'attendance',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    employeeId: text('employee_id').notNull(), // FK employees
    shiftDefinitionId: text('shift_definition_id'), // FK shift_definitions

    checkInAt: timestamp('check_in_at', { withTimezone: true }).notNull(),
    checkInMethod: text('check_in_method').notNull(), // 'gps' | 'qr_scan'
    checkInGps: jsonb('check_in_gps'), // { lat, lng, accuracy_m }
    checkInLocationId: text('check_in_location_id'), // location verified

    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    checkOutGps: jsonb('check_out_gps'),

    // SOP late rules (SD §21.8 §Attendance SOP)
    isLate: boolean('is_late').notNull().default(false),
    lateMinutes: integer('late_minutes').notNull().default(0),
    // Supervisor can waive the late status (excuse) so it does not count
    // toward payroll penalties — e.g. schedule changed at the last minute.
    lateForgiven: boolean('late_forgiven').notNull().default(false),
    lateForgivenBy: text('late_forgiven_by'),
    lateForgivenReason: text('late_forgiven_reason'),
    lateForgivenAt: timestamp('late_forgiven_at', { withTimezone: true }),

    // Shift actual worked (auto-calculated from check-in/out minus break)
    workedMinutes: integer('worked_minutes'),
    shiftDefinitionCode: text('shift_definition_code'), // snapshot

    ...auditCols,
  },
  (table) => [
    index('attendance_employee_date_idx').on(table.employeeId, table.checkInAt),
    index('attendance_tenant_date_idx').on(table.tenantId, table.checkInAt),
  ],
);

// ─── Leave Types ─────────────────────────────────────────────────────────────

/**
 * Master leave type definitions.
 * Quota rules: annual leave minimum 12 days per Indonesian law (UU Ketenagakerjaan).
 */
export const leaveTypes = pgTable(
  'leave_types',
  {
    ...pk,
    ...tenantCol,

    code: text('code').notNull(), // 'annual' | 'sick' | 'unpaid' | 'marriage' | 'maternity' | 'bereavement'
    name: jsonb('name').notNull(), // LocaleString
    annualQuotaDays: integer('annual_quota_days').notNull().default(0),
    isPaid: boolean('is_paid').notNull().default(true), // paid vs unpaid leave
    requiresApproval: boolean('requires_approval').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (table) => [uniqueIndex('leave_types_tenant_code_idx').on(table.tenantId, table.code)],
);

// ─── Leave Balances ───────────────────────────────────────────────────────────

/**
 * Per-employee annual leave balance.
 * Reset or carried over at year boundary (handled by payroll/HR service).
 */
export const leaveBalances = pgTable(
  'leave_balances',
  {
    ...pk,
    ...tenantCol,

    employeeId: text('employee_id').notNull(), // FK employees
    leaveTypeId: text('leave_type_id').notNull(), // FK leave_types
    year: integer('year').notNull(), // e.g. 2026

    totalDays: numeric('total_days', { precision: 5, scale: 1 }).notNull(),
    usedDays: numeric('used_days', { precision: 5, scale: 1 }).notNull().default('0'),
    pendingDays: numeric('pending_days', { precision: 5, scale: 1 }).notNull().default('0'),

    ...auditCols,
  },
  (table) => [
    uniqueIndex('leave_balances_employee_type_year_idx').on(
      table.employeeId,
      table.leaveTypeId,
      table.year,
    ),
  ],
);

// ─── Leave Requests ───────────────────────────────────────────────────────────

export const leaveRequests = pgTable(
  'leave_requests',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    employeeId: text('employee_id').notNull(), // FK employees
    leaveTypeId: text('leave_type_id').notNull(), // FK leave_types

    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    totalDays: numeric('total_days', { precision: 5, scale: 1 }).notNull(),

    reason: text('reason'),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'cancelled'

    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),

    ...auditCols,
  },
  (table) => [
    index('leave_requests_employee_idx').on(table.employeeId),
    index('leave_requests_status_idx').on(table.status),
  ],
);

// ─── Salary Components ────────────────────────────────────────────────────────

/**
 * Master salary component definitions (SD §21.8 §Payroll Run, §9.6 §salary_components).
 *
 * `kind`: 'earning' | 'deduction'
 * `is_taxable`: included in PPh 21 calculation
 * `is_bpjs_base`: included in BPJS Kesehatan + TK base salary
 * `posting_account_id`: Drizzle relation to accounts table (for auto-JE)
 */
export const salaryComponents = pgTable(
  'salary_components',
  {
    ...pk,
    ...tenantCol,

    code: text('code').notNull(), // 'SALARY_BASE', 'TUNJANGAN_THR', 'LEMBUR', 'BPJS_KES', 'BPJS_TK', 'PPh21', 'POTONGAN_TELAT'
    name: jsonb('name').notNull(), // LocaleString

    kind: text('kind').notNull(), // 'earning' | 'deduction'

    /** For fixed components: amount in IDR/month. NULL = percentage-based (formula). */
    fixedAmount: bigint('fixed_amount', { mode: 'bigint' }),

    /** Percentage of base salary. Used for THR, lembur, etc. */
    percentage: numeric('percentage', { precision: 5, scale: 4 }),

    isTaxable: boolean('is_taxable').notNull().default(false),
    isBpjsBase: boolean('is_bpjs_base').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (table) => [uniqueIndex('salary_components_tenant_code_idx').on(table.tenantId, table.code)],
);

// ─── Payrolls ────────────────────────────────────────────────────────────────

/**
 * Payroll run header per period per location (SD §9.6 §payrolls).
 * After approval: generates JE Salaries Expense + deductions.
 */
export const payrolls = pgTable(
  'payrolls',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    periodCode: text('period_code').notNull(), // 'YYYY-MM', e.g. '2026-05'
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

    status: text('status').notNull().default('draft'), // 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled'

    totalEmployees: integer('total_employees').notNull(),
    totalEarnings: bigint('total_earnings', { mode: 'bigint' }).notNull(),
    totalDeductions: bigint('total_deductions', { mode: 'bigint' }).notNull(),
    totalNet: bigint('total_net', { mode: 'bigint' }).notNull(),

    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    /** Journal entry ID after approval (links to journal_entries) */
    journalEntryId: text('journal_entry_id'),

    ...auditCols,
  },
  (table) => [
    uniqueIndex('payrolls_tenant_period_location_idx').on(
      table.tenantId,
      table.periodCode,
      table.locationId,
    ),
    index('payrolls_status_idx').on(table.status),
  ],
);

// ─── Payroll Lines ───────────────────────────────────────────────────────────

/**
 * Per-employee per component in a payroll run (SD §9.6 §payroll_lines).
 * One row per component per employee per payroll period.
 */
export const payrollLines = pgTable(
  'payrolls_lines',
  {
    ...pk,
    ...tenantCol,

    payrollId: text('payroll_id').notNull(), // FK payrolls
    employeeId: text('employee_id').notNull(), // FK employees
    salaryComponentId: text('salary_component_id').notNull(), // FK salary_components

    amount: bigint('amount', { mode: 'bigint' }).notNull(), // IDR

    /** For earning components: base used for calculation */
    baseAmount: bigint('base_amount', { mode: 'bigint' }),
    percentageApplied: numeric('percentage_applied', { precision: 5, scale: 4 }),

    /** Component kind at time of calculation (snapshot) */
    componentKind: text('component_kind').notNull(), // 'earning' | 'deduction'

    notes: text('notes'),

    ...auditCols,
  },
  (table) => [
    index('payroll_lines_payroll_idx').on(table.payrollId),
    index('payroll_lines_employee_idx').on(table.employeeId),
  ],
);

// ─── Disciplinary Actions ─────────────────────────────────────────────────────

/**
 * Warning letters SP1 / SP2 / SP3 (SD §21.8 §Cuti & Surat Peringatan).
 * Attachment stored as file reference (path in storage, not in DB).
 */
export const disciplinaryActions = pgTable(
  'disciplinary_actions',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    employeeId: text('employee_id').notNull(), // FK employees

    level: text('level').notNull(), // 'SP1' | 'SP2' | 'SP3'
    reason: text('reason').notNull(),
    incidentDate: timestamp('incident_date', { withTimezone: true }).notNull(),

    /** File path in object storage (S3-compatible) */
    attachmentUrl: text('attachment_url'),

    status: text('status').notNull().default('issued'), // 'issued' | 'acknowledged' | 'escalated'

    issuedBy: text('issued_by').notNull(), // FK users (supervisor / HR)
    acknowledgedBy: text('acknowledged_by'), // employee acknowledgement
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

    ...auditCols,
  },
  (table) => [
    index('disciplinary_employee_idx').on(table.employeeId),
    index('disciplinary_level_idx').on(table.level),
  ],
);
