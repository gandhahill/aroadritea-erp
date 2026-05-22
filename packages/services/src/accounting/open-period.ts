import { db } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { type OpenPeriodInput, OpenPeriodInputSchema } from './schemas';

export interface OpenPeriodResult {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
}

/**
 * Open a new accounting period.
 *
 * @param input - { periodCode, startDate, endDate }
 * @param ctx - Audit context
 */
export async function openPeriod(
  input: OpenPeriodInput,
  ctx: AuditContext,
): Promise<Result<OpenPeriodResult>> {
  // 1. Validate input
  const parsed = OpenPeriodInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.period.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { periodCode, startDate, endDate } = parsed.data;

  // 2. Permission check
  // We use accounting.period.close as a proxy for managing periods for now
  const permCheck = await requirePermission(ctx.userId, 'accounting.period.close');
  if (!permCheck.ok) return permCheck;

  // 3. Ensure end date is after start date
  if (endDate < startDate) {
    return err(
      AppError.validation('accounting.period.invalidDates', {
        message: 'End date must be after or equal to start date',
      }),
    );
  }

  return tryCatch(
    async () => {
      // 4. Check for existing period
      const existing = await db
        .select({ id: accountingPeriods.id })
        .from(accountingPeriods)
        .where(
          and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
        )
        .limit(1);

      if (existing.length > 0) {
        throw AppError.conflict('accounting.period.alreadyExists', { periodCode });
      }

      // 5. Create period
      const periodId = generateId();
      const now = new Date();

      await db.insert(accountingPeriods).values({
        id: periodId,
        tenantId: ctx.tenantId,
        code: periodCode,
        startDate: startDate,
        endDate: endDate,
        status: 'open',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // 6. Write audit log
      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'open_period',
        entityType: 'accounting_period',
        entityId: periodId,
        before: null,
        after: {
          code: periodCode,
          startDate,
          endDate,
          status: 'open',
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      return {
        id: periodId,
        code: periodCode,
        startDate,
        endDate,
        status: 'open',
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.period.openFailed', e);
    },
  );
}
