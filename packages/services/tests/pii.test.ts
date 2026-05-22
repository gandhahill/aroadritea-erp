import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptPii, encryptPii, encryptPiiForLookup, maskPii } from '../src/security/pii';

describe('PII encryption helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts field-level values deterministically for lookup', () => {
    vi.stubEnv('PII_ENCRYPTION_KEY', 'test-secret-key');

    const first = encryptPii('3271010101010001', 'employees.nik');
    const second = encryptPiiForLookup('3271010101010001', 'employees.nik');

    expect(first).toMatch(/^enc:v1:/);
    expect(second).toBe(first);
    expect(decryptPii(first, 'employees.nik')).toBe('3271010101010001');
  });

  it('keeps legacy plaintext readable during migration', () => {
    expect(decryptPii('08123456789', 'employees.phone')).toBe('08123456789');
  });

  it('masks personal data without exposing the full value', () => {
    expect(maskPii('08123456789')).toBe('*******6789');
    expect(maskPii('123')).toBe('****');
    expect(maskPii(null)).toBeNull();
  });

  it('fails closed for new production encryption when no key is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PII_ENCRYPTION_KEY', '');

    expect(() => encryptPii('secret', 'employees.nik')).toThrow(/PII_ENCRYPTION_KEY/);
    expect(encryptPiiForLookup('secret', 'employees.nik')).toBeNull();
  });
});
