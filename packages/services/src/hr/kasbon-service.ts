import { db } from '@erp/db';
import { cashAdvances, employmentContracts } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { generateId } from '@erp/shared/id';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';

export const RequestKasbonInputSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(3),
});

export type RequestKasbonInput = z.infer<typeof RequestKasbonInputSchema>;

export async function requestKasbon(input: RequestKasbonInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = RequestKasbonInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation('common.errors.validationFailed', { issues: parsed.error.issues }));

  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(and(eq(employmentContracts.employeeId, input.employeeId), eq(employmentContracts.isActive, true)));

  if (!contract) return err(AppError.businessRule('hr.kasbon.no_active_contract'));

  // Limit: max 30% of base salary
  const maxLimit = Number(contract.baseSalary) * 0.3;
  if (input.amount > maxLimit) {
    return err(AppError.businessRule('hr.kasbon.exceeds_limit', { limit: maxLimit }));
  }

  const id = generateId();
  await db.insert(cashAdvances).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    employeeId: input.employeeId,
    amount: BigInt(input.amount),
    reason: input.reason,
    status: 'pending',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  return ok({ id });
}

export async function approveKasbon(kasbonId: string, accountIdCash: string, accountIdKasbon: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const [kasbon] = await db
    .select()
    .from(cashAdvances)
    .where(and(eq(cashAdvances.id, kasbonId), eq(cashAdvances.tenantId, ctx.tenantId)));

  if (!kasbon) return err(AppError.notFound('hr.kasbon.not_found'));
  if (kasbon.status !== 'pending') return err(AppError.businessRule('hr.kasbon.not_pending'));

  const permCheck = await requirePermission(ctx.userId, 'hr.payroll.write', { locationId: kasbon.locationId });
  if (!permCheck.ok) return permCheck;

  // Create journal entry: Debit Kasbon Receivable, Credit Cash
  const jeResult = await createJournal(
    {
      postingDate: new Date().toISOString().split('T')[0] as string,
      locationId: kasbon.locationId,
      description: `Kasbon Employee - ${kasbon.employeeId}`,
      referenceType: 'payroll' as any,
      referenceId: kasbonId,
      lines: [
        {
          accountId: accountIdKasbon,
          locationId: kasbon.locationId,
          description: `Kasbon - ${kasbon.reason}`,
          debit: kasbon.amount.toString(),
          credit: '0',
        },
        {
          accountId: accountIdCash,
          locationId: kasbon.locationId,
          description: `Kasbon Payout`,
          debit: '0',
          credit: kasbon.amount.toString(),
        },
      ],
    },
    ctx, { skipPermissionCheck: true }
  );

  if (!jeResult.ok) return jeResult;

  await db
    .update(cashAdvances)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      journalEntryId: jeResult.value.id,
      updatedBy: ctx.userId,
    })
    .where(eq(cashAdvances.id, kasbonId));

  return ok({ id: kasbon.id });
}
