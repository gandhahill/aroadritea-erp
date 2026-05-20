/**
 * HR employees server actions — SD §9.6, §21.8
 *
 * All HR data operations go through these actions.
 * Permission checks via requirePermission in service layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { type LocationOption, getActiveLocationOptions } from '@/lib/location-options';
import { and, db, eq } from '@erp/db';
import { roles } from '@erp/db/schema/auth';
import { createEmployee, deactivateEmployee, updateEmployee } from '@erp/services/hr';
import { getEmployee, listEmployees } from '@erp/services/hr';
import type {
  CreateEmployeeInput,
  ListEmployeesInput,
  UpdateEmployeeInput,
} from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface RoleOption {
  code: string;
  label: string;
}

export type EmployeeLocationOption = LocationOption;

export async function fetchAssignableRoles(): Promise<RoleOption[]> {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const rows = await db
    .select({ code: roles.code, name: roles.name })
    .from(roles)
    .where(eq(roles.tenantId, ctx.tenantId))
    .orderBy(roles.code);
  return rows.map((row) => {
    const nameField = row.name as Record<string, string> | null;
    const label = nameField?.id ?? nameField?.en ?? row.code;
    return { code: row.code, label };
  });
}

export async function fetchEmployeeLocationOptions(): Promise<EmployeeLocationOption[]> {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  return getActiveLocationOptions({ tenantId: ctx.tenantId, locale });
}

export interface CreateEmployeeState {
  ok?: boolean;
  error?: string;
  employeeId?: string;
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : undefined;
}

function isoDate(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(`${value}T00:00:00.000+07:00`).toISOString() : undefined;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function serverListEmployees(input: ListEmployeesInput) {
  // ctx must come from the server-side session — previously it was a
  // typed parameter, which let a malicious client query any tenant.
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false as const, error: { messageKey: 'Unauthenticated' } };
  return listEmployees(input, ctx);
}

export async function serverGetEmployee(employeeId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false as const, error: { messageKey: 'Unauthenticated' } };
  return getEmployee(employeeId, ctx);
}

export async function createEmployeeAction(
  _prev: CreateEmployeeState | null,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const hireDate = isoDate(formData, 'hireDate');
  if (!hireDate) return { error: 'Tanggal mulai kerja wajib diisi' };

  const input: CreateEmployeeInput = {
    nik: text(formData, 'nik'),
    name: text(formData, 'name'),
    email: text(formData, 'email'),
    locationId: optionalText(formData, 'locationId'),
    phone: optionalText(formData, 'phone'),
    address: optionalText(formData, 'address'),
    position: text(formData, 'position'),
    department: optionalText(formData, 'department'),
    hireDate,
    probationEndDate: isoDate(formData, 'probationEndDate'),
    contractType: text(formData, 'contractType') === 'pkwtt' ? 'pkwtt' : 'pkwt',
    workSchedule:
      text(formData, 'workSchedule') === 'parttime'
        ? 'parttime'
        : text(formData, 'workSchedule') === 'shift'
          ? 'shift'
          : 'fulltime',
    npwp: optionalText(formData, 'npwp'),
    bpjsKesehatan: optionalText(formData, 'bpjsKesehatan'),
    bpjsTenagakerja: optionalText(formData, 'bpjsTenagakerja'),
    emergencyContactName: optionalText(formData, 'emergencyContactName'),
    emergencyContactPhone: optionalText(formData, 'emergencyContactPhone'),
    password: optionalText(formData, 'password'),
    roleCode: optionalText(formData, 'roleCode'),
    loginScope: text(formData, 'loginScope') === 'global' ? 'global' : 'same_location',
  };

  const result = await createEmployee(input, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/hr/employees');
  return { ok: true, employeeId: result.value.id };
}

export async function updateEmployeeAction(
  _prev: CreateEmployeeState | null,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const employeeId = text(formData, 'employeeId');
  const version = Number.parseInt(text(formData, 'version') || '1', 10);

  const input: UpdateEmployeeInput = {
    employeeId,
    version,
    name: optionalText(formData, 'name'),
    email: optionalText(formData, 'email'),
    locationId: optionalText(formData, 'locationId'),
    phone: optionalText(formData, 'phone'),
    address: optionalText(formData, 'address'),
    position: optionalText(formData, 'position'),
    department: optionalText(formData, 'department'),
    status: optionalText(formData, 'status') as UpdateEmployeeInput['status'],
    contractType: optionalText(formData, 'contractType') as UpdateEmployeeInput['contractType'],
    workSchedule: optionalText(formData, 'workSchedule') as UpdateEmployeeInput['workSchedule'],
    npwp: optionalText(formData, 'npwp'),
    bpjsKesehatan: optionalText(formData, 'bpjsKesehatan'),
    bpjsTenagakerja: optionalText(formData, 'bpjsTenagakerja'),
    emergencyContactName: optionalText(formData, 'emergencyContactName'),
    emergencyContactPhone: optionalText(formData, 'emergencyContactPhone'),
  };

  const result = await updateEmployee(input, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/hr/employees');
  revalidatePath(`/hr/employees/${employeeId}`);
  return { ok: true, employeeId: result.value.id };
}

export async function deactivateEmployeeAction(formData: FormData): Promise<CreateEmployeeState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const employeeId = text(formData, 'employeeId');
  const result = await deactivateEmployee(employeeId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/hr/employees');
  return { ok: true, employeeId: result.value.id };
}
