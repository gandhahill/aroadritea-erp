/**
 * @erp/db — Database package barrel export.
 */

// Client
export { db } from './client';
export type { Database } from './client';

// Schema — IAM
export {
  locations,
  permissions,
  rolePermissions,
  roles,
  sessions,
  tenants,
  userRoles,
  users,
} from './schema/auth';

// Schema — Common helpers
export {
  auditCols,
  isActive,
  isActiveFlag,
  locationCol,
  pk,
  tenantCol,
  versionCol,
} from './schema/common';
