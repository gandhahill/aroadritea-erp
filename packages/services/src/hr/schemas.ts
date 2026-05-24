/**
 * HR service schemas — SD §9.6, §21.8
 *
 * Permission: hr.employee.read (per SD §11)
 */

import { z } from 'zod';

const LocaleStringSchema = z.object({
  id: z.string().min(1),
  en: z.string().min(1),
  zh: z.string().min(1),
});

// ─── List Employees ─────────────────────────────────────────────────────────

export const ListEmployeesInputSchema = z.object({
  status: z.enum(['probation', 'active', 'on_leave', 'terminated']).optional(),
  department: z.string().optional(),
  locationId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListEmployeesInput = z.infer<typeof ListEmployeesInputSchema>;

// ─── Create Employee ────────────────────────────────────────────────────────

export const CreateEmployeeInputSchema = z.object({
  locationId: z.string().min(1).optional(),
  // NIK (KTP number) is OPTIONAL by business decision (2026-05-24): many
  // outlets onboard staff before their KTP is in hand. When provided it
  // must still be 6-32 chars; an empty string is normalised to undefined
  // and persisted as NULL (see create-employee.ts).
  nik: z
    .string()
    .max(32)
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
  name: z.string().min(1).max(128),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1).max(64),
  department: z.string().optional(),
  hireDate: z.string().datetime(), // ISO date string
  probationEndDate: z.string().datetime().optional(),
  contractType: z.enum(['pkwt', 'pkwtt']),
  workSchedule: z.enum(['fulltime', 'parttime', 'shift']).optional().default('fulltime'),
  npwp: z.string().optional(),
  bpjsKesehatan: z.string().optional(),
  bpjsTenagakerja: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  /**
   * Optional ERP login provisioning. If `password` + `roleCode` are given,
   * a corresponding row is added to `users` and `user_roles` with the
   * specified role, so the new employee can sign in immediately.
   */
  password: z.string().min(8).max(72).optional(),
  requirePasswordChange: z.boolean().optional().default(false),
  roleCode: z.string().min(1).optional(),
  loginScope: z.enum(['same_location', 'global']).optional().default('same_location'),
});

export type CreateEmployeeInput = z.input<typeof CreateEmployeeInputSchema>;

// ─── Update Employee ───────────────────────────────────────────────────────

export const UpdateEmployeeInputSchema = z.object({
  employeeId: z.string().min(1),
  locationId: z.string().min(1).optional(),
  name: z.string().min(1).max(128).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1).max(64).optional(),
  department: z.string().optional(),
  status: z.enum(['probation', 'active', 'on_leave', 'terminated']).optional(),
  contractType: z.enum(['pkwt', 'pkwtt']).optional(),
  workSchedule: z.enum(['fulltime', 'parttime', 'shift']).optional(),
  npwp: z.string().optional(),
  bpjsKesehatan: z.string().optional(),
  bpjsTenagakerja: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  version: z.number().int().min(1),
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInputSchema>;
