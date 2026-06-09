import { describe, expect, it } from 'vitest';
import { safeInternalRedirectPath } from '../src/security/safe-redirect';

describe('safeInternalRedirectPath', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeInternalRedirectPath('/dashboard?tab=ops#today')).toBe('/dashboard?tab=ops#today');
  });

  it('rejects external and protocol-relative URLs', () => {
    expect(safeInternalRedirectPath('https://evil.example/phish')).toBe('/dashboard');
    expect(safeInternalRedirectPath('//evil.example/phish')).toBe('/dashboard');
  });

  it('rejects non-path values and supports a custom fallback', () => {
    expect(safeInternalRedirectPath('dashboard', '/login')).toBe('/login');
    expect(safeInternalRedirectPath('', '/login')).toBe('/login');
  });
});
