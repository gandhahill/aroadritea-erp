/**
 * requirePermission — convenience wrapper around iam.can().
 * Returns Result<void, AppError> for use in service functions.
 * SD §11.2.2
 */

import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { can, type PermissionContext } from './permission-engine';

/**
 * Check permission and return a Result.
 * Use at the top of service functions to gate access.
 *
 * @example
 * ```ts
 * const check = await requirePermission(userId, 'accounting.journal.post', { locationId });
 * if (!check.ok) return check;
 * // ... proceed with business logic
 * ```
 */
export async function requirePermission(
  userId: string,
  permission: string,
  context?: PermissionContext,
): Promise<Result<void>> {
  const allowed = await can(userId, permission, context);
  if (!allowed) {
    return err(AppError.forbidden('common.errors.forbidden', { permission }));
  }
  return ok(undefined);
}
