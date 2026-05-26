import { and, db, eq, inArray, locations } from '@erp/db';
import { can, canGlobally, getAuthorizedLocations } from '@erp/services/iam';

export async function hasPermissionAtLocation(
  userId: string,
  permission: string,
  locationId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !locationId) return false;
  return can(userId, permission, { locationId });
}

export async function requirePermissionAtLocation(
  userId: string,
  permission: string,
  locationId: string | null | undefined,
): Promise<boolean> {
  return hasPermissionAtLocation(userId, permission, locationId);
}

export async function hasGlobalPermission(userId: string, permission: string): Promise<boolean> {
  if (!userId) return false;
  return canGlobally(userId, permission);
}

export async function authorizedLocationIdsForTenant(
  userId: string,
  permission: string,
  tenantId: string,
): Promise<{ global: boolean; locationIds: string[] }> {
  if (!userId) return { global: false, locationIds: [] };

  const granted = await getAuthorizedLocations(userId, permission);
  if (granted.scope === 'global') {
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.tenantId, tenantId), eq(locations.status, 'active')));
    return { global: true, locationIds: rows.map((row) => row.id) };
  }

  if (granted.locationIds.length === 0) return { global: false, locationIds: [] };

  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        inArray(locations.id, granted.locationIds),
      ),
    );

  return { global: false, locationIds: rows.map((row) => row.id) };
}
