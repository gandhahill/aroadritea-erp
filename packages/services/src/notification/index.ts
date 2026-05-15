/**
 * Notification channel service.
 *
 * Stores operational notification targets used by worker jobs such as outage
 * monitoring and stock alerts. Secrets remain in env; non-secret recipients
 * and purposes are managed from ERP UI.
 */

import { db, eq, notificationChannels } from '@erp/db';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { requirePermission } from '../iam';

const ChannelTypeSchema = z.enum(['email', 'whatsapp', 'telegram']);
const PurposeSchema = z.enum(['all', 'outage', 'stock_alert']);

export const CreateNotificationChannelSchema = z.object({
  label: z.string().min(1).max(120),
  channelType: ChannelTypeSchema,
  target: z.string().min(3).max(255),
  purpose: PurposeSchema.default('all'),
  isActive: z.boolean().default(true),
});

export const UpdateNotificationChannelSchema = CreateNotificationChannelSchema.partial();

export type CreateNotificationChannelInput = z.infer<typeof CreateNotificationChannelSchema>;
export type UpdateNotificationChannelInput = z.infer<typeof UpdateNotificationChannelSchema>;

export interface NotificationChannelResult {
  id: string;
  label: string;
  channelType: string;
  target: string;
  purpose: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function toResult(row: typeof notificationChannels.$inferSelect): NotificationChannelResult {
  return {
    id: row.id,
    label: row.label,
    channelType: row.channelType,
    target: row.target,
    purpose: row.purpose,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function canManage(ctx: AuditContext): Promise<Result<void>> {
  return requirePermission(ctx.userId, 'settings.manage', { locationId: ctx.locationId });
}

export async function listNotificationChannels(
  tenantId: string,
): Promise<Result<NotificationChannelResult[]>> {
  const rows = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.tenantId, tenantId))
    .orderBy(notificationChannels.label);

  return ok(rows.map(toResult));
}

export async function createNotificationChannel(
  input: CreateNotificationChannelInput,
  ctx: AuditContext,
): Promise<Result<NotificationChannelResult>> {
  const perm = await canManage(ctx);
  if (!perm.ok) return perm;

  const parsed = CreateNotificationChannelSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('notification.channel.invalidInput', parsed.error.flatten()));
  }

  const id = generateId();
  await db.insert(notificationChannels).values({
    id,
    tenantId: ctx.tenantId,
    ...parsed.data,
    config: {},
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  const rows = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return err(AppError.internal('notification.channel.createReadbackFailed'));
  return ok(toResult(row));
}

export async function updateNotificationChannel(
  id: string,
  input: UpdateNotificationChannelInput,
  ctx: AuditContext,
): Promise<Result<NotificationChannelResult>> {
  const perm = await canManage(ctx);
  if (!perm.ok) return perm;

  const parsed = UpdateNotificationChannelSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('notification.channel.invalidInput', parsed.error.flatten()));
  }

  const rows = await db
    .update(notificationChannels)
    .set({ ...parsed.data, updatedAt: new Date(), updatedBy: ctx.userId })
    .where(eq(notificationChannels.id, id))
    .returning();

  if (!rows[0]) return err(AppError.notFound('notification.channel.notFound', { id }));
  return ok(toResult(rows[0]));
}
