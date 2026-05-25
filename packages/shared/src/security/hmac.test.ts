import { describe, expect, it } from 'vitest';
import { computeHmac, validateInboundHmac } from './hmac';

describe('validateInboundHmac', () => {
  const SECRET = 'shared-test-secret';

  it('accepts a freshly signed payload', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '{"order":"T01-2026-05-25-0001","status":"ready"}';
    const sig = computeHmac(SECRET, `${ts}.${body}`);
    const result = validateInboundHmac({
      secret: SECRET,
      rawBody: body,
      providedSignature: sig,
      providedTimestamp: ts,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = computeHmac(SECRET, `${ts}.original`);
    const result = validateInboundHmac({
      secret: SECRET,
      rawBody: 'tampered',
      providedSignature: sig,
      providedTimestamp: ts,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_signature');
  });

  it('rejects an expired timestamp (older than maxAge)', () => {
    const ts = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000)); // 10 min old
    const body = 'x';
    const sig = computeHmac(SECRET, `${ts}.${body}`);
    const result = validateInboundHmac({
      secret: SECRET,
      rawBody: body,
      providedSignature: sig,
      providedTimestamp: ts,
      maxAgeSeconds: 300,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects a malformed timestamp', () => {
    const result = validateInboundHmac({
      secret: SECRET,
      rawBody: 'x',
      providedSignature: 'whatever',
      providedTimestamp: 'not-a-date',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_timestamp');
  });

  it('supports base64 signatures', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = 'payload';
    const sig = computeHmac(SECRET, `${ts}.${body}`, 'base64');
    const result = validateInboundHmac({
      secret: SECRET,
      rawBody: body,
      providedSignature: sig,
      providedTimestamp: ts,
      encoding: 'base64',
    });
    expect(result.ok).toBe(true);
  });
});
