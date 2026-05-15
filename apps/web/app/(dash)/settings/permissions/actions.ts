'use server';

import { getSession } from '@/lib/auth';
import {
  and,
  asc,
  auditLog,
  db,
  eq,
  inArray,
  isNull,
  permissions,
  rolePermissions,
  roles,
  userRoles,
} from '@erp/db';
import { invalidatePermissionCache, requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface PermissionMatrixRole {
  id: string;
  code: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
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
    .select({ id: roles.id, code: roles.code, name: roles.name, description: roles.description })
    .from(roles)
    .where(and(eq(roles.tenantId, ctx.tenantId), isNull(roles.deletedAt)))
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
      description: role.description as Record<string, string> | null,
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
  revalidatePath('/settings/permissions');
  return { ok: true };
}

function normalizeLocaleString(input: {
  id?: string;
  en?: string;
  zh?: string;
}): Record<string, string> {
  const id = String(input.id ?? '').trim();
  const en = String(input.en ?? '').trim() || id;
  const zh = String(input.zh ?? '').trim() || id;
  return { id, en, zh };
}

function normalizeRoleCode(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
}

async function requireManageContext() {
  const ctx = await getContext();
  if (!ctx) return null;
  const permission = await requirePermission(ctx.userId, 'iam.manage_permissions');
  if (!permission.ok) return null;
  return ctx;
}

export async function createRoleAction(input: {
  code: string;
  name: Record<string, string>;
  description?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManageContext();
  if (!ctx) return { ok: false, error: 'Forbidden' };

  const code = normalizeRoleCode(input.code);
  const name = normalizeLocaleString(input.name);
  const description = input.description ? normalizeLocaleString(input.description) : null;

  if (!/^[a-z0-9_.-]{2,40}$/.test(code)) {
    return { ok: false, error: 'Role code must be 2-40 characters.' };
  }
  if (!name.id) return { ok: false, error: 'Role name is required.' };

  const id = generateId();
  const values = {
    id,
    tenantId: ctx.tenantId,
    code,
    name,
    description,
    createdBy: ctx.userId || null,
    updatedBy: ctx.userId || null,
  };

  try {
    await db.insert(roles).values(values);
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'role',
      entityId: id,
      before: null,
      after: values as never,
    });
    invalidatePermissionCache();
    revalidatePath('/settings/permissions');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to create role' };
  }
}

export async function updateRoleAction(input: {
  id: string;
  name: Record<string, string>;
  description?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManageContext();
  if (!ctx) return { ok: false, error: 'Forbidden' };

  const name = normalizeLocaleString(input.name);
  const description = input.description ? normalizeLocaleString(input.description) : null;
  if (!name.id) return { ok: false, error: 'Role name is required.' };

  const [before] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.id, input.id), isNull(roles.deletedAt)))
    .limit(1);
  if (!before) return { ok: false, error: 'Role not found' };

  const values = {
    name,
    description,
    updatedAt: new Date(),
    updatedBy: ctx.userId || null,
  };
  await db
    .update(roles)
    .set(values)
    .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.id, input.id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'role',
    entityId: input.id,
    before: before as never,
    after: values as never,
  });
  invalidatePermissionCache();
  revalidatePath('/settings/permissions');
  return { ok: true };
}

export async function deleteRoleAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireManageContext();
  if (!ctx) return { ok: false, error: 'Forbidden' };

  const [role] = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.id, id), isNull(roles.deletedAt)))
    .limit(1);
  if (!role) return { ok: false, error: 'Role not found' };
  if (role.code === 'director') return { ok: false, error: 'Director role cannot be deleted.' };

  const [assigned] = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, id))
    .limit(1);
  if (assigned) {
    return { ok: false, error: 'Role is still assigned to a user. Remove assignments first.' };
  }

  const deletedAt = new Date();
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  await db
    .update(roles)
    .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId || null })
    .where(and(eq(roles.tenantId, ctx.tenantId), eq(roles.id, id)));
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'delete',
    entityType: 'role',
    entityId: id,
    before: role as never,
    after: { deletedAt: deletedAt.toISOString() } as never,
  });
  invalidatePermissionCache();
  revalidatePath('/settings/permissions');
  return { ok: true };
}
