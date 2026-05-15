/**
 * HR employees server actions — SD §9.6, §21.8
 *
 * All HR data operations go through these actions.
 * Permission checks via requirePermission in service layer.
 */

'use server';

import { getSession } from '@/lib/auth';
import { createEmployee } from '@erp/services/hr';
import { getEmployee, listEmployees } from '@erp/services/hr';
import type { CreateEmployeeInput, ListEmployeesInput } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

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

export async function serverListEmployees(input: ListEmployeesInput, ctx: AuditContext) {
  return listEmployees(input, ctx);
}

export async function serverGetEmployee(employeeId: string, ctx: AuditContext) {
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
  };

  const result = await createEmployee(input, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/hr/employees');
  return { ok: true, employeeId: result.value.id };
}
