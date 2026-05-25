/**
 * log-scrub — T-0176.
 *
 * Pure helpers for masking PII before strings hit a logger / toast /
 * error message. Used by services that surface error details (e.g. an
 * upstream Postgres error that quoted a user's full address).
 *
 * Scope (deliberately conservative — false-positives waste eyes,
 * false-negatives leak data):
 *   - Email addresses: `kasir@aroadri.com` → `k***@aroadri.com`
 *   - Indonesian phone numbers: `081234567890` → `081****7890`
 *   - 16-digit National IDs (NIK): `3401234567890123` → `340*********0123`
 *   - 15-digit NPWP: `123456789012345` → `12*********2345`
 *   - JSON keys that obviously hold credentials: `password`,
 *     `passwordHash`, `token`, `secret`, `authorization`, `cookie`.
 *     The whole value is replaced with `***`.
 *
 * Anything else passes through. This is intentionally NOT a generic
 * "redact all numbers" sweep — that would make IDR amounts unreadable.
 */

// Email: keep first char of local + full domain.
const EMAIL_RE = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

// Indonesian phone 10–13 digits starting with 0. Keep first 3 + last 4.
const PHONE_RE = /\b(0\d{2})(\d{3,6})(\d{4})\b/g;

// NIK = exactly 16 digits. Keep first 3 + last 4 (mask 9 middle digits).
const NIK_RE = /\b(\d{3})(\d{9})(\d{4})\b/g;

// NPWP = exactly 15 digits (legacy). Keep first 2 + last 4. Order
// matters: NIK_RE must run BEFORE NPWP_RE because NIK is longer; if
// the NIK regex matched, NPWP_RE won't re-find a 15-digit run inside
// the already-asterisked result.
const NPWP_RE = /\b(\d{2})(\d{9})(\d{4})\b/g;

const SECRET_JSON_KEY_RE =
  /"(password(?:Hash)?|token|secret|authorization|cookie|set-cookie|apiKey|apikey|api_key|smtpPass)"\s*:\s*"[^"\\]*(?:\\.[^"\\]*)*"/gi;

export function scrubPii(value: string): string {
  if (!value) return value;
  return value
    .replace(EMAIL_RE, (_match, first: string, _middle: string, domain: string) => {
      return `${first}***${domain}`;
    })
    .replace(NIK_RE, (_m, head: string, _mid: string, tail: string) => `${head}*********${tail}`)
    .replace(NPWP_RE, (_m, head: string, _mid: string, tail: string) => `${head}*********${tail}`)
    .replace(PHONE_RE, (_m, head: string, _mid: string, tail: string) => `${head}****${tail}`)
    .replace(SECRET_JSON_KEY_RE, (match) => {
      // Replace the value while preserving the key + structure.
      const colonIdx = match.indexOf(':');
      if (colonIdx === -1) return match;
      const key = match.slice(0, colonIdx + 1).trim();
      return `${key} "***"`;
    });
}

/**
 * Walk a JSON-serialisable structure and scrub strings + sensitive keys.
 * Returns a NEW object — the input is never mutated.
 */
export function scrubPiiDeep<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return scrubPii(input) as unknown as T;
  if (Array.isArray(input)) {
    return input.map((item) => scrubPiiDeep(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = '***';
      } else {
        out[k] = scrubPiiDeep(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === 'password' ||
    lower === 'passwordhash' ||
    lower === 'password_hash' ||
    lower === 'token' ||
    lower === 'secret' ||
    lower === 'authorization' ||
    lower === 'cookie' ||
    lower === 'set-cookie' ||
    lower === 'apikey' ||
    lower === 'api_key' ||
    lower === 'smtppass' ||
    lower === 'smtp_pass' ||
    lower === 'creditcard' ||
    lower === 'cardnumber'
  );
}
