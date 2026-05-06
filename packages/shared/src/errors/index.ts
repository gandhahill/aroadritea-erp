export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'EXTERNAL_DEPENDENCY'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly messageKey: string,
    public readonly details?: unknown,
    public readonly cause?: unknown,
  ) {
    super(messageKey);
  }
}
