/**
/**
 * @erp/services/iam — Identity & Access Management service barrel export.
 */

export {
  can,
  canGlobally,
  getAuthorizedLocations,
  invalidatePermissionCache,
  getUserPermissions,
  type AuthorizedLocations,
  type PermissionContext,
} from './permission-engine';
export { requirePermission } from './require-permission';
export { changeMyPassword, adminResetPassword } from './change-password';
