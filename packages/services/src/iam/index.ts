/**
 * @erp/services/iam — Identity & Access Management service barrel export.
 */

export { can, invalidatePermissionCache, type PermissionContext } from './permission-engine';
export { requirePermission } from './require-permission';
