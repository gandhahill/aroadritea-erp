import { describe, it, expect } from 'vitest';
import { AppError } from '../src/errors';
import { ok, err, unwrap, map, flatMap, tryCatch, tryCatchSync } from '../src/result';
import type { Result } from '../src/result';

describe('AppError', () => {
  it('factory methods set correct code', () => {
    expect(AppError.notFound().code).toBe('NOT_FOUND');
    expect(AppError.forbidden().code).toBe('FORBIDDEN');
    expect(AppError.unauthenticated().code).toBe('UNAUTHENTICATED');
    expect(AppError.validation().code).toBe('VALIDATION_FAILED');
    expect(AppError.conflict().code).toBe('CONFLICT');
    expect(AppError.businessRule('test').code).toBe('BUSINESS_RULE');
    expect(AppError.external('test').code).toBe('EXTERNAL_DEPENDENCY');
    expect(AppError.internal().code).toBe('INTERNAL');
  });

  it('httpStatus maps correctly', () => {
    expect(AppError.notFound().httpStatus).toBe(404);
    expect(AppError.forbidden().httpStatus).toBe(403);
    expect(AppError.unauthenticated().httpStatus).toBe(401);
    expect(AppError.conflict().httpStatus).toBe(409);
    expect(AppError.internal().httpStatus).toBe(500);
  });

  it('toJSON serializes without cause', () => {
    const e = AppError.notFound('test.key', { id: '123' });
    const json = e.toJSON();
    expect(json).toEqual({ code: 'NOT_FOUND', messageKey: 'test.key', details: { id: '123' } });
  });

  it('toJSON omits details if undefined', () => {
    const json = AppError.internal().toJSON();
    expect(json).not.toHaveProperty('details');
  });
});

describe('Result', () => {
  it('ok creates success result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err creates failure result', () => {
    const r = err(AppError.notFound());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('unwrap returns value on ok', () => {
    expect(unwrap(ok('hello'))).toBe('hello');
  });

  it('unwrap throws on err', () => {
    expect(() => unwrap(err(AppError.internal()))).toThrow();
  });

  it('map transforms success value', () => {
    const r = map(ok(10), (v) => v * 2);
    expect(r.ok && r.value).toBe(20);
  });

  it('map passes through error', () => {
    const r: Result<number> = err(AppError.notFound());
    const mapped = map(r, (v) => v * 2);
    expect(mapped.ok).toBe(false);
  });

  it('flatMap chains results', () => {
    const divide = (a: number, b: number): Result<number> =>
      b === 0 ? err(AppError.businessRule('math.divByZero')) : ok(a / b);

    const r = flatMap(ok(10), (v) => divide(v, 2));
    expect(r.ok && r.value).toBe(5);

    const r2 = flatMap(ok(10), (v) => divide(v, 0));
    expect(r2.ok).toBe(false);
  });

  it('tryCatch catches async errors', async () => {
    const r = await tryCatch(async () => { throw new Error('boom'); });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INTERNAL');
  });

  it('tryCatch returns ok on success', async () => {
    const r = await tryCatch(async () => 42);
    expect(r.ok && r.value).toBe(42);
  });

  it('tryCatchSync catches sync errors', () => {
    const r = tryCatchSync(() => { throw new Error('boom'); });
    expect(r.ok).toBe(false);
  });

  it('tryCatchSync returns ok on success', () => {
    const r = tryCatchSync(() => 'hello');
    expect(r.ok && r.value).toBe('hello');
  });

  it('tryCatch uses custom error mapper', async () => {
    const r = await tryCatch(
      async () => { throw new Error('db down'); },
      () => AppError.external('db.connectionFailed'),
    );
    expect(!r.ok && r.error.code).toBe('EXTERNAL_DEPENDENCY');
  });
});
