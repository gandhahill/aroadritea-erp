/**
 * IAM Permission Engine — SD §11.2
 *
 * Checks if a user has a specific permission via their assigned roles.
 * Supports:
 * - Wildcard `*.*` (super admin) and `module.*` (module admin)
 * - Location-scoped roles (user_roles.location_id)
 * - 60-second in-memory cache per user (SD §11.2.2)
 */

import { eq } from 'drizzle-orm';
import { db } from '@erp/db';
import {
  userRoles,
  rolePermissions,
  permissions,
} from '@erp/db/schema/auth';

// --- Types ---

export interface PermissionContext {
  locationId?: string;
}

interface CachedPermissions {
  /** All permission codes the user has globally */
  global: Set<string>;
  /** Permission codes scoped to specific locations: locationId -> Set<code> */
  byLocation: Map<string, Set<string>>;
  /** Timestamp when cache was populated */
  cachedAt: number;
}

// --- Cache (60s TTL per SD §11.2.2) ---

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedPermissions>();

/**
 * Invalidate the permission cache for a specific user or all users.
 */
export function invalidatePermissionCache(userId?: string): void {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

// --- Core logic ---

/**
 * Load permissions for a user from DB and cache them.
 */
async function loadPermissions(userId: string): Promise<CachedPermissions> {
  // Check cache first
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Query: user_roles → role_permissions → permissions
  const rows = await db
    .select({
      permissionCode: permissions.code,
      locationId: userRoles.locationId,
    })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  const global = new Set<string>();
  const byLocation = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.locationId === null) {
      // Global role — permission applies everywhere
      global.add(row.permissionCode);
    } else {
      // Location-scoped role
      let locationPerms = byLocation.get(row.locationId);
      if (!locationPerms) {
        locationPerms = new Set<string>();
        byLocation.set(row.locationId, locationPerms);
      }
      locationPerms.add(row.permissionCode);
    }
  }

  const entry: CachedPermissions = { global, byLocation, cachedAt: Date.now() };
  cache.set(userId, entry);
  return entry;
}

/**
 * Check if a permission code matches against a user's granted permissions.
 * Supports wildcards: `*.*` matches everything, `module.*` matches all in module.
 */
function matchesPermission(grantedCodes: Set<string>, requiredPermission: string): boolean {
  // Direct match
  if (grantedCodes.has(requiredPermission)) return true;

  // Super admin wildcard
  if (grantedCodes.has('*.*')) return true;

  // Module wildcard: e.g., 'accounting.*' matches 'accounting.journal.create'
  const dotIndex = requiredPermission.indexOf('.');
  if (dotIndex > 0) {
    const module = requiredPermission.substring(0, dotIndex);
    if (grantedCodes.has(`${module}.*`)) return true;
  }

  return false;
}

/**
 * Check if user has a specific permission.
 * SD §11.2.2: Reads user_roles → role_permissions → permissions with 60s cache.
 *
 * @param userId - The user's ID
 * @param permission - Permission code (e.g., 'accounting.journal.post')
 * @param context - Optional context with locationId for location-scoped checks
 * @returns true if user has the permission
 *
 * @example
 * ```ts
 * if (!await can(userId, 'accounting.journal.post', { locationId })) {
 *   return err(AppError.forbidden('errors.permission'));
 * }
 * ```
 */
export async function can(
  userId: string,
  permission: string,
  context?: PermissionContext,
): Promise<boolean> {
  const perms = await loadPermissions(userId);

  // Check global permissions first (always apply)
  if (matchesPermission(perms.global, permission)) return true;

  // If a location context is provided, also check location-scoped permissions
  if (context?.locationId) {
    const locationPerms = perms.byLocation.get(context.locationId);
    if (locationPerms && matchesPermission(locationPerms, permission)) return true;
  }

  // If no location context, check if ANY location-scoped role grants this
  // (user has the permission somewhere, just not globally)
  if (!context?.locationId) {
    for (const locationPerms of perms.byLocation.values()) {
      if (matchesPermission(locationPerms, permission)) return true;
    }
  }

  return false;
}
