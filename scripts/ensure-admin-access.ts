/**
 * Ensure the bootstrap admin has global director access.
 *
 * This is intentionally DB-driven: the admin gets the director role, and
 * director gets the `*.*` permission through role_permissions. No role checks
 * are hardcoded in application code.
 */

import { and, db, eq, permissions, rolePermissions, roles, userRoles, users } from '@erp/db';
import { generateId } from '@erp/shared/id';

const tenantId = process.env.TENANT_ID ?? 'default';
const adminEmail =
  process.env.ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@aroadritea.com';

async function ensureAdminAccess() {
  const wildcardPermissionId = await ensureWildcardPermission();
  const directorRoleId = await ensureDirectorRole();

  await db
    .insert(rolePermissions)
    .values({
      roleId: directorRoleId,
      permissionId: wildcardPermissionId,
    })
    .onConflictDoNothing();

  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, adminEmail)))
    .limit(1);

  if (!admin) {
    throw new Error(
      `Admin user ${adminEmail} not found. Run db:seed with SEED_ADMIN_PASSWORD first, or create the user before this script.`,
    );
  }

  await db
    .insert(userRoles)
    .values({
      userId: admin.id,
      roleId: directorRoleId,
      locationId: null,
    })
    .onConflictDoUpdate({
      target: [userRoles.userId, userRoles.roleId],
      set: { locationId: null },
    });

  console.info(`Admin ${admin.email} now has global director access with *.* permission.`);
}

async function ensureWildcardPermission() {
  const [existing] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.code, '*.*'))
    .limit(1);

  if (existing) return existing.id;

  const id = generateId();
  await db.insert(permissions).values({
    id,
    code: '*.*',
    module: 'system',
    description: {
      id: 'Akses penuh untuk administrator bootstrap',
      en: 'Full access for bootstrap administrator',
      zh: '引导管理员完全访问权限',
    },
  });
  return id;
}

async function ensureDirectorRole() {
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.code, 'director')))
    .limit(1);

  if (existing) return existing.id;

  const id = generateId();
  await db.insert(roles).values({
    id,
    tenantId,
    code: 'director',
    name: { id: 'Direktur', en: 'Director', zh: '总监' },
    description: {
      id: 'Role administrator global',
      en: 'Global administrator role',
      zh: '全局管理员角色',
    },
  });
  return id;
}

ensureAdminAccess().catch((error) => {
  console.error('Failed to ensure admin access:', error);
  process.exit(1);
});
