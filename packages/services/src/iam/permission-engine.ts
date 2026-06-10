/**
 * IAM Permission Engine — SD §11.2
 *
 * Checks if a user has a specific permission via their assigned roles.
 * Supports:
 * - Wildcard `*.*` (super admin) and `module.*` (module admin)
 * - Location-scoped roles (user_roles.location_id)
 * - 60-second in-memory cache per user (SD §11.2.2)
 */

import { db } from '@erp/db';
import { permissions, rolePermissions, userRoles } from '@erp/db/schema/auth';
import type { PermissionCode } from '@erp/shared/types';
import { eq } from 'drizzle-orm';

// --- Types ---

export interface PermissionContext {
  locationId?: string;
}

export type AuthorizedLocations =
  | { scope: 'global'; locationIds: null }
  | { scope: 'location'; locationIds: string[] };

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
 * Get all raw permissions for a user (useful for client-side UI filtering).
 * Converts Sets/Maps to Arrays/Objects for Next.js serialization.
 */
export async function getUserPermissions(userId: string) {
  const perms = await loadPermissions(userId);
  const byLocationObj: Record<string, string[]> = {};
  for (const [locId, set] of perms.byLocation.entries()) {
    byLocationObj[locId] = Array.from(set);
  }
  return {
    global: Array.from(perms.global),
    byLocation: byLocationObj,
  };
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
 * Check whether a user has a permission from a global role only.
 * Use this for tenant-wide or global administration actions where a location
 * scoped grant must not be treated as "any location".
 */
export async function canGlobally(userId: string, permission: PermissionCode): Promise<boolean> {
  const perms = await loadPermissions(userId);
  return matchesPermission(perms.global, permission);
}

/**
 * Return the user's authorized location scope for a permission.
 *
 * `scope: global` means the caller may include all tenant locations.
 * `scope: location` returns the concrete location IDs granted by scoped roles.
 */
export async function getAuthorizedLocations(
  userId: string,
  permission: PermissionCode,
): Promise<AuthorizedLocations> {
  const perms = await loadPermissions(userId);

  if (matchesPermission(perms.global, permission)) {
    return { scope: 'global', locationIds: null };
  }

  const locationIds: string[] = [];
  for (const [locationId, locationPerms] of perms.byLocation.entries()) {
    if (matchesPermission(locationPerms, permission)) {
      locationIds.push(locationId);
    }
  }

  return { scope: 'location', locationIds };
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
  permission: PermissionCode,
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

  return false;
}
