import { describe, expect, it } from 'vitest';
import { scrubPii, scrubPiiDeep } from './log-scrub';

describe('scrubPii', () => {
  it('masks the local part of an email', () => {
    expect(scrubPii('kasir@aroadri.com')).toBe('k***@aroadri.com');
    expect(scrubPii('Email: lintang@example.co.id failed')).toBe(
      'Email: l***@example.co.id failed',
    );
  });

  it('masks the middle of an Indonesian phone number', () => {
    expect(scrubPii('Telp: 081234567890')).toBe('Telp: 081****7890');
  });

  it('masks 16-digit NIK', () => {
    expect(scrubPii('NIK 3401234567890123 invalid')).toBe('NIK 340*********0123 invalid');
  });

  it('replaces password value inside a JSON-looking string', () => {
    const input = 'Caused by: {"password":"r4hasi4","email":"x@aroadri.com"}';
    const out = scrubPii(input);
    expect(out).toContain('"password": "***"');
    expect(out).toContain('@aroadri.com');
    expect(out).not.toContain('r4hasi4');
  });

  it('passes plain rupiah amounts unchanged', () => {
    expect(scrubPii('Total Rp 33.000 dibayar')).toBe('Total Rp 33.000 dibayar');
  });
});

describe('scrubPiiDeep', () => {
  it('walks nested objects and replaces sensitive keys + masks strings', () => {
    const input = {
      user: { email: 'lintang@aroadri.com', phone: '081234567890' },
      password: 'super-secret',
      session: { token: 'abc.def.ghi', userAgent: 'Chrome' },
      list: ['plain', { secret: 'x', note: 'NIK 3401234567890123' }],
    };
    const out = scrubPiiDeep(input);
    expect(out.user.email).toBe('l***@aroadri.com');
    expect(out.user.phone).toBe('081****7890');
    expect(out.password).toBe('***');
    expect(out.session.token).toBe('***');
    expect(out.session.userAgent).toBe('Chrome');
    expect(out.list[0]).toBe('plain');
    expect((out.list[1] as { secret: string; note: string }).secret).toBe('***');
    expect((out.list[1] as { secret: string; note: string }).note).toBe(
      'NIK 340*********0123',
    );
  });
});
