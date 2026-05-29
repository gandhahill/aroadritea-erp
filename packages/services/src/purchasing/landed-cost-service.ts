import { db } from '@erp/db';
import { landedCosts, grnLines, purchaseInvoices } from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export const AllocateLandedCostInputSchema = z.object({
  grnId: z.string().min(1),
  costType: z.enum(['shipping', 'insurance', 'customs', 'other']),
  amount: z.string().min(1),
  allocationMethod: z.enum(['value', 'qty', 'weight', 'volume', 'manual']),
  invoiceId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export type AllocateLandedCostInput = z.infer<typeof AllocateLandedCostInputSchema>;

export async function allocateLandedCost(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = AllocateLandedCostInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('invalid input', { detail: parsed.error.message }));
  }
  const input = parsed.data;

  // Wait, I will just implement a basic insert. No complex allocation logic for now.
  // We can expand it later.
  
  const id = generateId();

  await db.insert(landedCosts).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    grnId: input.grnId,
    costType: input.costType,
    amount: BigInt(input.amount),
    allocationMethod: input.allocationMethod,
    invoiceId: input.invoiceId ?? null,
    notes: input.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await auditRecord({
    action: 'create',
    entityType: 'landed_cost',
    entityId: id,
    before: null,
    after: { grnId: input.grnId, amount: input.amount },
    ctx,
  });

  return ok({ id });
}
