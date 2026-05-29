import { db } from '@erp/db';
import { reservations } from '@erp/db/schema/reservations';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';
import { auditRecord } from '../audit';

const CreateReservationSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  email: z.string().email().optional(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  partySize: z.number().int().min(1),
  type: z.enum(['table', 'event']).default('table'),
  specialRequests: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export async function createReservation(
  input: CreateReservationInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateReservationSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('reservations.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  // No specific permission required if public API, but if via ERP:
  if (ctx.userId) {
    const perm = await requirePermission(ctx.userId, 'crm.manage', { locationId: ctx.locationId });
    if (!perm.ok) return perm;
  }

  const id = generateId();
  await db.insert(reservations).values({
    id,
    tenantId: ctx.tenantId,
    locationId: ctx.locationId,
    customerId: data.customerId ?? null,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    email: data.email ?? null,
    reservationDate: data.reservationDate,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    partySize: data.partySize,
    type: data.type,
    status: 'pending',
    specialRequests: data.specialRequests ?? null,
    createdBy: ctx.userId ?? 'system',
    updatedBy: ctx.userId ?? 'system',
  });

  await auditRecord({
    action: 'create',
    entityType: 'reservation',
    entityId: id,
    before: null,
    after: { ...data, status: 'pending' },
    ctx,
  });

  return ok({ id });
}

export async function updateReservationStatus(
  input: { id: string; status: 'confirmed' | 'cancelled' | 'completed' },
  ctx: AuditContext,
): Promise<Result<void>> {
  if (!ctx.userId) return err(AppError.unauthenticated('auth.required'));
  
  const perm = await requirePermission(ctx.userId, 'crm.manage', { locationId: ctx.locationId });
  if (!perm.ok) return perm;

  const [existing] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, input.id), eq(reservations.tenantId, ctx.tenantId)))
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('reservations.notFound'));
  }

  await db
    .update(reservations)
    .set({ status: input.status, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(eq(reservations.id, input.id));

  await auditRecord({
    action: 'update',
    entityType: 'reservation',
    entityId: input.id,
    before: { status: existing.status },
    after: { status: input.status },
    ctx,
  });

  return ok(undefined);
}

export async function listReservations(
  input: { limit?: number; offset?: number },
  ctx: AuditContext,
): Promise<Result<any[]>> {
  if (!ctx.userId) return err(AppError.unauthenticated('auth.required'));

  const perm = await requirePermission(ctx.userId, 'crm.view', { locationId: ctx.locationId });
  if (!perm.ok) return perm;

  const rows = await db
    .select()
    .from(reservations)
    .where(eq(reservations.tenantId, ctx.tenantId))
    .orderBy(desc(reservations.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);

  return ok(rows);
}
