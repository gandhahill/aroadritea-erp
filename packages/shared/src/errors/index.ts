/**
 * AppError — structured error type for all service-layer errors.
 * SD §7.7: UI translates `code + messageKey` via i18n.
 *
 * Usage:
 *   return err(AppError.notFound('accounting.journal.notFound', { id }));
 *   return err(AppError.businessRule('accounting.journal.notBalanced'));
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'EXTERNAL_DEPENDENCY'
  | 'INTERNAL';

/** HTTP status code mapping for API responses. */
const HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  EXTERNAL_DEPENDENCY: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly messageKey: string,
    public readonly details?: unknown,
    public readonly cause?: unknown,
  ) {
    super(messageKey);
    this.name = 'AppError';
  }

  /** HTTP status for API serialization. */
  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }

  /** Serialize for JSON API response. */
  toJSON() {
    return {
      code: this.code,
      messageKey: this.messageKey,
      ...(this.details !== undefined && { details: this.details }),
    };
  }

  // --- Factory methods (prefer these over `new AppError(...)`) ---

  static unauthenticated(messageKey = 'common.errors.unauthenticated', details?: unknown) {
    return new AppError('UNAUTHENTICATED', messageKey, details);
  }

  static forbidden(messageKey = 'common.errors.forbidden', details?: unknown) {
    return new AppError('FORBIDDEN', messageKey, details);
  }

  static notFound(messageKey = 'common.errors.notFound', details?: unknown) {
    return new AppError('NOT_FOUND', messageKey, details);
  }

  static validation(messageKey = 'common.errors.validationFailed', details?: unknown) {
    return new AppError('VALIDATION_FAILED', messageKey, details);
  }

  static conflict(messageKey = 'common.errors.conflict', details?: unknown) {
    return new AppError('CONFLICT', messageKey, details);
  }

  static businessRule(messageKey: string, details?: unknown) {
    return new AppError('BUSINESS_RULE', messageKey, details);
  }

  static external(messageKey: string, cause?: unknown) {
    return new AppError('EXTERNAL_DEPENDENCY', messageKey, undefined, cause);
  }

  static internal(messageKey = 'common.errors.serverError', cause?: unknown) {
    return new AppError('INTERNAL', messageKey, undefined, cause);
  }
}
