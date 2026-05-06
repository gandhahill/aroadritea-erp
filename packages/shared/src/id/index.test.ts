import { describe, expect, it } from 'vitest';
import { extractTimestamp, generateId, isValidId } from './index';

describe('id (ULID)', () => {
  it('generates a 26-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(26);
  });

  it('generates valid Crockford Base32 characters', () => {
    const id = generateId();
    expect(isValidId(id)).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(1000);
  });

  it('generates monotonically sortable IDs within same millisecond', () => {
    // Generate several in rapid succession (same ms likely)
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(generateId());
    }
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('extractTimestamp returns a reasonable timestamp', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();
    const ts = extractTimestamp(id);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('isValidId rejects invalid strings', () => {
    expect(isValidId('')).toBe(false);
    expect(isValidId('too-short')).toBe(false);
    expect(isValidId('ABCDEFGHJKMNPQRSTVWXYZ0123')).toBe(true); // valid chars, 26 len
    expect(isValidId('ABCDEFGHJKMNPQRSTVWXYZOooo')).toBe(false); // 'O' not in Crockford, and lowercase
  });
});
