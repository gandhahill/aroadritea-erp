/**
 * IAM MCP tools — SD §16.4, §11.2.2
 *
 * Tools:
 * - iam.whoami      → user info
 * - iam.list_locations → locations accessible to the user
 */

import { db } from '@erp/db';
import { locations, roles, userRoles, users } from '@erp/db/schema/auth';
import { isActive } from '@erp/db/schema/common';
import { type PermissionContext, can } from '@erp/services/iam';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess } from '../helpers';

// --- Schemas ---

export const WhoamiSchema = z.object({});

export const ListLocationsSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['store', 'office', 'warehouse']).optional(),
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
