/**
 * Notification channel service.
 *
 * Stores operational notification targets used by worker jobs such as outage
 * monitoring and stock alerts. Secrets remain in env; non-secret recipients
 * and purposes are managed from ERP UI.
 */

import { and, db, desc, eq, isNull, sql } from '@erp/db';
import { notificationChannels } from '@erp/db';
import { rolePermissions, userRoles, users } from '@erp/db/schema/auth';
import { userNotifications } from '@erp/db/schema/notification';
import { permissions } from '@erp/db/schema/auth';
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

// ─── In-app notifications (bell icon) ────────────────────────────────────────

export interface NotifyInput {
  tenantId: string;
  /** Notification kind, e.g. 'leave', 'po', 'opname', 'attendance'. */
  kind: string;
  title: string;
  body?: string;
  link?: string;
  /**
   * Permission code that gates who receives this notification. The
   * service fans out to every user in the tenant that holds the
   * permission via the role mapping.
   */
  permission: string;
  /** Optional explicit user IDs to also include. */
  extraUserIds?: string[];
}

/**
 * Fan-out an in-app notification to every user in the tenant that holds
 * the gating permission. Use for approval flows, mention-style alerts,
 * and audit-significant events.
 */
export async function notifyByPermission(input: NotifyInput): Promise<void> {
  try {
    const rows = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          eq(users.tenantId, input.tenantId),
          eq(users.status, 'active'),
          sql`(${permissions.code} = ${input.permission} OR ${permissions.code} = '*.*')`,
        ),
      );
    const targetIds = new Set<string>(rows.map((r) => r.userId));
    for (const id of input.extraUserIds ?? []) targetIds.add(id);
    if (targetIds.size === 0) return;

    await db.insert(userNotifications).values(
      [...targetIds].map((userId) => ({
        id: generateId(),
        tenantId: input.tenantId,
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        createdBy: 'system',
        updatedBy: 'system',
      })),
    );
  } catch {
    // Notifications are best-effort; never crash the caller.
  }
}

export interface UserNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listUserNotifications(
  tenantId: string,
  userId: string,
  limit = 30,
): Promise<UserNotificationRow[]> {
  const rows = await db
    .select({
      id: userNotifications.id,
      kind: userNotifications.kind,
      title: userNotifications.title,
      body: userNotifications.body,
      link: userNotifications.link,
      readAt: userNotifications.readAt,
      createdAt: userNotifications.createdAt,
    })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.tenantId, tenantId),
        eq(userNotifications.userId, userId),
        isNull(userNotifications.deletedAt),
      ),
    )
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);
  return rows;
}

export async function countUnreadNotifications(
  tenantId: string,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.tenantId, tenantId),
        eq(userNotifications.userId, userId),
        isNull(userNotifications.readAt),
        isNull(userNotifications.deletedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(
  tenantId: string,
  userId: string,
  notificationId: string,
): Promise<void> {
  await db
    .update(userNotifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userNotifications.tenantId, tenantId),
        eq(userNotifications.userId, userId),
        eq(userNotifications.id, notificationId),
      ),
    );
}

export async function markAllNotificationsRead(
  tenantId: string,
  userId: string,
): Promise<void> {
  await db
    .update(userNotifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(userNotifications.tenantId, tenantId),
        eq(userNotifications.userId, userId),
        isNull(userNotifications.readAt),
      ),
    );
}
