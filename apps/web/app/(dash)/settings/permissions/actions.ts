'use server';

import { getSession } from '@/lib/auth';
import { and, asc, db, eq, inArray, permissions, rolePermissions, roles } from '@erp/db';
import { invalidatePermissionCache, requirePermission } from '@erp/services/iam';

export interface PermissionMatrixRole {
  id: string;
  code: string;
  name: Record<string, string>;
}

export interface PermissionMatrixPermission {
  id: string;
  code: string;
  module: string;
  description: Record<string, string> | null;
}

export interface PermissionMatrix {
  roles: PermissionMatrixRole[];
  permissions: PermissionMatrixPermission[];
  grants: Record<string, string[]>;
  canManage: boolean;
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export async function fetchPermissionMatrix(): Promise<PermissionMatrix> {
  const ctx = await getContext();
  if (!ctx) return { roles: [], permissions: [], grants: {}, canManage: false };

  const permission = await requirePermission(ctx.userId, 'iam.manage_permissions');
  if (!permission.ok) return { roles: [], permissions: [], grants: {}, canManage: false };

  const roleRows = await db
    .select({ id: roles.id, code: roles.code, name: roles.name })
    .from(roles)
    .where(eq(roles.tenantId, ctx.tenantId))
    .orderBy(asc(roles.code));

  const permissionRows = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      module: permissions.module,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(asc(permissions.module), asc(permissions.code));

  const grants: Record<string, string[]> = {};
  if (roleRows.length > 0) {
    const grantRows = await db
      .select({ roleId: rolePermissions.roleId, permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          roleRows.map((role) => role.id),
        ),
      );

    for (const grant of grantRows) {
      const roleGrants = grants[grant.roleId] ?? [];
      roleGrants.push(grant.permissionId);
      grants[grant.roleId] = roleGrants;
    }
  }

  return {
    roles: roleRows.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name as Record<string, string>,
    })),
    permissions: permissionRows.map((permissionRow) => ({
      id: permissionRow.id,
      code: permissionRow.code,
      module: permissionRow.module,
      description: permissionRow.description as Record<string, string> | null,
    })),
    grants,
    canManage: true,
  };
}

export async function setRolePermission(input: {
  roleId: string;
  permissionId: string;
  granted: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const permission = await requirePermission(ctx.userId, 'iam.manage_permissions');
  if (!permission.ok) return { ok: false, error: 'Forbidden' };

  const [role] = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.id, input.roleId)))
    .limit(1);
  const [permissionRow] = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions)
    .where(eq(permissions.id, input.permissionId))
    .limit(1);

  if (!role || !permissionRow) return { ok: false, error: 'Role or permission not found' };
  if (!input.granted && permissionRow.code === '*.*' && role.code === 'director') {
    return { ok: false, error: 'Director wildcard access cannot be removed from this UI' };
  }

  if (input.granted) {
    await db
      .insert(rolePermissions)
      .values({ roleId: input.roleId, permissionId: input.permissionId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, input.roleId),
          eq(rolePermissions.permissionId, input.permissionId),
        ),
      );
  }

  invalidatePermissionCache();
  return { ok: true };
}
