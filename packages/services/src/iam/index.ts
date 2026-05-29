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
export * from './user-management';
export * from './mcp-token-service';
export * from './audit-log-service';
export * from './notification-service';
