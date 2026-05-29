import { db } from '@erp/db';
import { notifications, userNotificationPreferences } from '@erp/db/schema/notifications';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from './require-permission';
import { generateId } from '@erp/shared/id';

export const CreateNotificationInputSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'warning', 'alert', 'success']),
  eventCode: z.string().optional(),
  referenceId: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;

export async function createNotification(input: CreateNotificationInput, ctx: AuditContext): Promise<Result<{ id: string }>> {
  const parsed = CreateNotificationInputSchema.safeParse(input);
  if (!parsed.success) return err(AppError.validation(parsed.error.message));

  // Check preferences
  if (input.eventCode) {
    const [prefs] = await db
      .select()
      .from(userNotificationPreferences)
      .where(and(eq(userNotificationPreferences.userId, input.userId), eq(userNotificationPreferences.tenantId, ctx.tenantId)));
      
    if (prefs && prefs.eventPreferences) {
      // If the user explicitly disabled this event type, don't create it
      if (prefs.eventPreferences[input.eventCode] === false) {
        return ok({ id: 'skipped' });
      }
    }
  }

  const id = generateId();
  await db.insert(notifications).values({
    id,
    tenantId: ctx.tenantId,
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    eventCode: input.eventCode,
    referenceId: input.referenceId,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  return ok({ id });
}

export async function markNotificationRead(notificationId: string, ctx: AuditContext): Promise<Result<{ id: string }>> {
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(and(eq(notifications.id, notificationId), eq(notifications.tenantId, ctx.tenantId), eq(notifications.userId, ctx.userId)));

  return ok({ id: notificationId });
}
