/**
 * HMAC helpers — T-0176.
 *
 * Standard hex / base64 HMAC-SHA256 with a timing-safe compare, used
 * to validate inbound webhook payloads (Naixer KDS retry callbacks,
 * future delivery-platform integrations). The helper enforces a hard
 * window on the timestamp to defeat replay attacks — a captured
 * payload older than `maxAgeSeconds` is rejected even if its
 * signature is otherwise valid.
 *
 * Pure node:crypto so it works in both the API route runtime and
 * the worker.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface HmacValidationInput {
  secret: string;
  rawBody: string;
  /** Header value the sender included (e.g. `X-Aroadri-Signature`). */
  providedSignature: string;
  /** ISO-8601 / Unix-ms / Unix-sec timestamp the sender included
   *  (e.g. `X-Aroadri-Timestamp`). */
  providedTimestamp: string;
  /** Reject anything older than this many seconds. Default 300 (5 min). */
  maxAgeSeconds?: number;
  /** 'hex' (default) or 'base64'. */
  encoding?: 'hex' | 'base64';
}

export interface HmacValidationResult {
  ok: boolean;
  reason?: 'invalid_timestamp' | 'expired' | 'invalid_signature';
}

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  // Try unix seconds, unix ms, then ISO-8601.
  if (/^\d{10}$/.test(value)) return Number.parseInt(value, 10) * 1000;
  if (/^\d{13}$/.test(value)) return Number.parseInt(value, 10);
  const isoMs = Date.parse(value);
  return Number.isFinite(isoMs) ? isoMs : null;
}

export function computeHmac(
  secret: string,
  rawBody: string,
  encoding: 'hex' | 'base64' = 'hex',
): string {
  return createHmac('sha256', secret).update(rawBody).digest(encoding);
}

export function validateInboundHmac(input: HmacValidationInput): HmacValidationResult {
  const ts = parseTimestamp(input.providedTimestamp);
  if (ts === null) return { ok: false, reason: 'invalid_timestamp' };
  const maxAge = (input.maxAgeSeconds ?? 300) * 1000;
  if (Math.abs(Date.now() - ts) > maxAge) {
    return { ok: false, reason: 'expired' };
  }

  // Signed payload = `${timestamp}.${rawBody}` so the timestamp is
  // covered by the signature too (same pattern as Stripe webhooks).
  const expected = computeHmac(
    input.secret,
    `${input.providedTimestamp}.${input.rawBody}`,
    input.encoding ?? 'hex',
  );
  const provided = input.providedSignature.trim();

  let bufExpected: Buffer;
  let bufProvided: Buffer;
  try {
    bufExpected = Buffer.from(expected, input.encoding === 'base64' ? 'base64' : 'hex');
    bufProvided = Buffer.from(provided, input.encoding === 'base64' ? 'base64' : 'hex');
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (bufExpected.length !== bufProvided.length) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!timingSafeEqual(bufExpected, bufProvided)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true };
}
