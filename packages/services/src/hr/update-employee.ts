/**
 * hr.updateEmployee — SD §9.6, §21.8
 *
 * Updates an employee record with optimistic locking.
 * Permission: hr.employee.write
 */

import { db } from '@erp/db';
import { employees, employmentContracts } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { encryptPii, encryptPiiForLookup } from '../security/pii';
import { type UpdateEmployeeInput, UpdateEmployeeInputSchema } from './schemas';

export async function updateEmployee(
  input: UpdateEmployeeInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdateEmployeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.employee.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { employeeId, version, ...data } = parsed.data;

  return tryCatch(
    async () => {
      const [existing] = await db
        .select({
          id: employees.id,
          locationId: employees.locationId,
          version: employees.version,
          currentContractId: employees.currentContractId,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.tenantId, ctx.tenantId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw AppError.notFound('hr.employee.notFound');
      }

      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
        locationId: existing.locationId,
      });
      if (!permCheck.ok) throw permCheck.error;

      if (data.locationId !== undefined && data.locationId !== existing.locationId) {
        const targetPermCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
          locationId: data.locationId,
        });
        if (!targetPermCheck.ok) throw targetPermCheck.error;
      }

      if (existing.version !== version) {
        throw AppError.conflict('hr.employee.versionMismatch', {
          expected: existing.version,
          actual: version,
        });
      }

      const setCols: Record<string, unknown> = {
        updatedBy: ctx.userId,
        updatedAt: new Date(),
        version: version + 1,
      };

      // NIK (KTP) is PII — encrypt at rest, matching createEmployee. Storing it
      // plaintext here violated UU PDP / CLAUDE.md §5.5.
      if (data.nik !== undefined) setCols.nik = encryptPii(data.nik, 'employees.nik');
      if (data.name !== undefined) setCols.name = data.name;
      if (data.email !== undefined) {
        const encryptedEmail = encryptPiiForLookup(data.email, 'employees.email');
        if (encryptedEmail) {
          const existingEmail = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
              and(
                eq(employees.tenantId, ctx.tenantId),
                eq(employees.email, encryptedEmail),
                isNull(employees.deletedAt),
              ),
            )
            .limit(1);
          if (existingEmail[0] && existingEmail[0].id !== employeeId) {
            throw AppError.validation('hr.employee.emailInUse', { email: data.email });
          }
        }
        setCols.email = encryptedEmail;
      }
      if (data.phone !== undefined) setCols.phone = encryptPii(data.phone, 'employees.phone');
      if (data.address !== undefined)
        setCols.address = encryptPii(data.address, 'employees.address');
      if (data.position !== undefined) setCols.position = data.position;
      if (data.department !== undefined) setCols.department = data.department;
      if (data.locationId !== undefined) setCols.locationId = data.locationId;
      if (data.status !== undefined) setCols.status = data.status;
      if (data.contractType !== undefined) setCols.contractType = data.contractType;
      if (data.workSchedule !== undefined) setCols.workSchedule = data.workSchedule;
      if (data.npwp !== undefined) setCols.npwp = encryptPii(data.npwp, 'employees.npwp');
      if (data.bpjsKesehatan !== undefined)
        setCols.bpjsKesehatan = encryptPii(data.bpjsKesehatan, 'employees.bpjsKesehatan');
      if (data.bpjsTenagakerja !== undefined)
        setCols.bpjsTenagakerja = encryptPii(data.bpjsTenagakerja, 'employees.bpjsTenagakerja');
      if (data.bankName !== undefined) setCols.bankName = data.bankName;
      if (data.bankAccountNumber !== undefined)
        setCols.bankAccountNumber = encryptPii(
          data.bankAccountNumber,
          'employees.bankAccountNumber',
        );
      if (data.bankAccountHolder !== undefined)
        setCols.bankAccountHolder = encryptPii(
          data.bankAccountHolder,
          'employees.bankAccountHolder',
        );
      if (data.vehiclePlateNumber !== undefined)
        setCols.vehiclePlateNumber = data.vehiclePlateNumber;
      if (data.emergencyContactName !== undefined)
        setCols.emergencyContactName = data.emergencyContactName;
      if (data.emergencyContactPhone !== undefined)
        setCols.emergencyContactPhone = encryptPii(
          data.emergencyContactPhone,
          'employees.emergencyContactPhone',
        );

      if (data.baseSalary !== undefined || data.contractType !== undefined) {
        if (existing.currentContractId) {
          const contractSetCols: Record<string, unknown> = {
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          };
          if (data.baseSalary !== undefined) contractSetCols.baseSalary = BigInt(data.baseSalary);
          if (data.contractType !== undefined) contractSetCols.contractType = data.contractType;

          await db
            .update(employmentContracts)
            .set(contractSetCols)
            .where(
              and(
                eq(employmentContracts.id, existing.currentContractId),
                eq(employmentContracts.tenantId, ctx.tenantId),
              ),
            );
        } else if (data.baseSalary !== undefined) {
          const contractId = generateId();
          await db.insert(employmentContracts).values({
            id: contractId,
            tenantId: ctx.tenantId,
            locationId: existing.locationId,
            employeeId: existing.id,
            contractType: data.contractType ?? 'pkwt',
            startDate: new Date(),
            isActive: true,
            baseSalary: BigInt(data.baseSalary),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
          setCols.currentContractId = contractId;
        }
      }

      const [updated] = await db
        .update(employees)
        .set(setCols)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.tenantId, ctx.tenantId),
            eq(employees.version, version),
          ),
        )
        .returning({ id: employees.id });

      if (!updated) {
        throw AppError.conflict('hr.employee.versionMismatch');
      }

      // SD §15 — log only non-PII field changes. The encrypted columns
      // (phone/address/npwp/etc.) are intentionally excluded so the
      // audit trail can be read by managers without holding the PII key.
      const safeAfter: Record<string, unknown> = {};
      for (const key of [
        'nik',
        'name',
        'email',
        'position',
        'department',
        'locationId',
        'status',
        'contractType',
        'baseSalary',
        'workSchedule',
        'emergencyContactName',
      ] as const) {
        const v = data[key as keyof typeof data];
        if (v !== undefined) safeAfter[key] = v;
      }
      const piiKeysTouched = [
        'phone',
        'address',
        'npwp',
        'bpjsKesehatan',
        'bpjsTenagakerja',
        'emergencyContactPhone',
      ].filter((k) => data[k as keyof typeof data] !== undefined);
      if (piiKeysTouched.length > 0) safeAfter['_pii_fields_updated'] = piiKeysTouched;

      await auditRecord({
        action: 'update',
        entityType: 'employee',
        entityId: updated.id,
        before: null,
        after: safeAfter,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.updateFailed', e);
    },
  );
}

/**
 * Soft-deactivate an employee (set status to 'terminated').
 * Permission: hr.employee.write
 */
export async function deactivateEmployee(
  employeeId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  return tryCatch(
    async () => {
      const [existing] = await db
        .select({
          id: employees.id,
          locationId: employees.locationId,
          status: employees.status,
          version: employees.version,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.tenantId, ctx.tenantId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) throw AppError.notFound('hr.employee.notFound');

      const permCheck = await requirePermission(ctx.userId, 'hr.employee.write', {
        locationId: existing.locationId,
      });
      if (!permCheck.ok) throw permCheck.error;

      const [updated] = await db
        .update(employees)
        .set({
          status: 'terminated',
          updatedBy: ctx.userId,
          updatedAt: new Date(),
          version: existing.version + 1,
        })
        .where(
          and(
            eq(employees.id, employeeId),
            eq(employees.tenantId, ctx.tenantId),
            eq(employees.version, existing.version),
          ),
        )
        .returning({ id: employees.id });

      if (!updated) throw AppError.conflict('hr.employee.versionMismatch');

      await auditRecord({
        action: 'deactivate',
        entityType: 'employee',
        entityId: updated.id,
        before: { status: existing.status },
        after: { status: 'terminated' },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: updated.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.employee.deactivateFailed', e);
    },
  );
}
