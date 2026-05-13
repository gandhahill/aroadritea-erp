/**
 * Result<T, E> — functional error handling pattern.
 * SD §7.6: All service functions return Result, never throw.
 *
 * Usage:
 *   const result = await accounting.postJournal(id);
 *   if (!result.ok) return handleError(result.error);
 *   const journal = result.value;
 */

import { AppError } from '../errors';

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// --- Combinators ---

/** Unwrap a Result, throwing if error (only for top-level handlers). */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

/** Map over the success value. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

/** FlatMap (chain) — for sequential Result operations. */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) return fn(result.value);
  return result;
}

/** Wrap an async function that may throw into a Result. */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  mapError?: (e: unknown) => AppError,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(mapError ? mapError(e) : AppError.internal('common.errors.serverError', e));
  }
}

/** Wrap a sync function that may throw into a Result. */
export function tryCatchSync<T>(fn: () => T, mapError?: (e: unknown) => AppError): Result<T> {
  try {
    return ok(fn());
  } catch (e) {
    return err(mapError ? mapError(e) : AppError.internal('common.errors.serverError', e));
  }
}
