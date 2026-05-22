/**
 * IAM MCP tools — SD §16.4, §11.2.2
 *
 * Tools:
 * - iam.whoami      → user info
 * - iam.list_locations → locations accessible to the user
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { locations, roles, userRoles, users } from '@erp/db/schema/auth';
import { isActive } from '@erp/db/schema/common';
import { type PermissionContext, can } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess, requireConfirmation } from '../helpers';

// --- Schemas ---

export const WhoamiSchema = z.object({});

export const ListLocationsSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['store', 'office', 'warehouse']).optional(),
});

const LocaleNameSchema = z.object({
  id: z.string().min(1).max(160),
  en: z.string().min(1).max(160),
  zh: z.string().min(1).max(160),
});

export const UpsertLocationSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: LocaleNameSchema,
  type: z.enum(['store', 'office', 'warehouse']),
  timezone: z.string().min(1).max(64).optional().default('Asia/Jakarta'),
  currency: z.string().min(3).max(3).optional().default('IDR'),
  address: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const DeleteLocationSchema = z.object({
  id: z.string().min(1),
  /** Must equal `id` (the location being deleted). Safety guard. */
  confirm: z.string().min(1),
});

// --- Helpers ---

async function checkPermission(
  ctx: McpContext,
  permission: string,
  locationId?: string,
): Promise<boolean> {
  const context: PermissionContext = locationId ? { locationId } : {};
  return can(ctx.userId, permission, context);
}

async function canManageLocations(ctx: McpContext): Promise<boolean> {
  return (
    (await checkPermission(ctx, 'settings.manage')) ||
    (await checkPermission(ctx, 'iam.manage_locations'))
  );
}

// --- Tool definitions (for registration) ---

export const iamTools = [
  {
    name: 'iam.whoami',
    description: 'Get the current authenticated user info: id, email, display name, locale, roles.',
    schema: WhoamiSchema,
    handler: whoamiHandler,
  },
  {
    name: 'iam.list_locations',
    description:
      'List locations (branches/offices) accessible to the current user. Returns all active locations the user has any role on.',
    schema: ListLocationsSchema,
    handler: listLocationsHandler,
  },
  {
    name: 'iam.upsert_location',
    description:
      'Create or update an ERP location through the same settings/location permission boundary as the UI.',
    schema: UpsertLocationSchema,
    handler: upsertLocationHandler,
  },
  {
    name: 'iam.delete_location',
    description: 'Soft-delete a location by marking it inactive and recording an audit trail.',
    schema: DeleteLocationSchema,
    handler: deleteLocationHandler,
  },
] as const;

// --- Handlers ---

async function whoamiHandler(
  _input: z.infer<typeof WhoamiSchema>,
  ctx: McpContext,
): Promise<{ content: unknown[]; isError: boolean }> {
  // Any authenticated user can see their own info
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      locale: users.locale,
      status: users.status,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  if (!user) {
    return mcpError('NOT_FOUND', 'User not found');
  }

  // Get roles
  const roleRows = await db
    .select({ roleCode: roles.code, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, ctx.userId));

  const roles_ = roleRows.map((r) => ({
    code: r.roleCode,
    name: r.roleName as { id: string; en: string; zh: string },
  }));

  return mcpSuccess({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    status: user.status,
    tenantId: user.tenantId,
    roles: roles_,
  });
}

async function listLocationsHandler(
  input: z.infer<typeof ListLocationsSchema>,
  ctx: McpContext,
): Promise<{ content: unknown[]; isError: boolean }> {
  // Any authenticated user can list locations (filtered by their access)
  const userLocationIds = await db
    .select({ locationId: userRoles.locationId })
    .from(userRoles)
    .where(eq(userRoles.userId, ctx.userId));

  // Global roles (null locationId) → can see all locations
  const hasGlobalAccess = userLocationIds.some((r) => r.locationId === null);

  const query = db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      timezone: locations.timezone,
      currency: locations.currency,
      address: locations.address,
      status: locations.status,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), isActive));

  const results = await query;

  let filtered = results;
  if (!hasGlobalAccess) {
    const allowedIds = userLocationIds.map((r) => r.locationId).filter(Boolean) as string[];
    filtered = filtered.filter((loc) => allowedIds.includes(loc.id));
  }

  if (input.query) {
    const q = input.query.toLowerCase();
    filtered = filtered.filter(
      (loc) =>
        loc.code.toLowerCase().includes(q) ||
        (loc.name as { id?: string }).id?.toLowerCase().includes(q),
    );
  }

  if (input.type) {
    filtered = filtered.filter((loc) => loc.type === input.type);
  }

  return mcpSuccess(filtered);
}

async function upsertLocationHandler(
  input: z.infer<typeof UpsertLocationSchema>,
  ctx: McpContext,
): Promise<{ content: unknown[]; isError: boolean }> {
  const permitted = await canManageLocations(ctx);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: settings.manage');

  const now = new Date();
  const values = {
    code: input.code.trim().toUpperCase(),
    name: input.name,
    type: input.type,
    timezone: input.timezone,
    currency: input.currency.toUpperCase(),
    address: input.address?.trim() || null,
    status: input.status,
    updatedAt: now,
    updatedBy: ctx.userId || null,
  };

  if (input.id) {
    const [before] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, input.id)))
      .limit(1);
    if (!before) return mcpError('NOT_FOUND', `Location ${input.id} not found`);

    await db
      .update(locations)
      .set(values)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, input.id)));
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'location',
      entityId: input.id,
      before: before as never,
      after: values as never,
    });
    return mcpSuccess({ id: input.id });
  }

  const id = generateId();
  await db.insert(locations).values({
    id,
    tenantId: ctx.tenantId,
    ...values,
    createdBy: ctx.userId || null,
  });
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'location',
    entityId: id,
    before: null,
    after: values as never,
  });
  return mcpSuccess({ id });
}

async function deleteLocationHandler(
  input: z.infer<typeof DeleteLocationSchema>,
  ctx: McpContext,
): Promise<{ content: unknown[]; isError: boolean }> {
  const permitted = await canManageLocations(ctx);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: settings.manage');

  const guard = requireConfirmation(input.id, input.confirm);
  if ('error' in guard) return guard.error;

  const [before] = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, ctx.tenantId),
        eq(locations.id, input.id),
        isNull(locations.deletedAt),
      ),
    )
    .limit(1);
  if (!before) return mcpError('NOT_FOUND', `Location ${input.id} not found`);

  const deletedAt = new Date();
  await db
    .update(locations)
    .set({
      status: 'inactive',
      deletedAt,
      updatedAt: deletedAt,
      updatedBy: ctx.userId || null,
    })
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, input.id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'location',
    entityId: input.id,
    before: before as never,
    after: { deletedAt: deletedAt.toISOString(), status: 'inactive' } as never,
  });
  return mcpSuccess({ id: input.id });
}
