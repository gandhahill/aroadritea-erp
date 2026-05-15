/**
 * Field-level PII encryption helpers.
 *
 * Existing plaintext rows remain readable for migration safety. New writes in
 * production require PII_ENCRYPTION_KEY and are stored with the `enc:v1` prefix.
 */

import { createCipheriv, createDecipheriv, createHash, createHmac } from 'node:crypto';

const PREFIX = 'enc:v1';

function keyMaterial(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

function requireKey(): Buffer {
  const key = keyMaterial();
  if (key) return key;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PII_ENCRYPTION_KEY is required to encrypt personal data in production.');
  }
  return createHash('sha256').update('aroadri-dev-pii-key').digest();
}

function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

function deterministicIv(key: Buffer, field: string, value: string): Buffer {
  return createHmac('sha256', key).update(field).update('\0').update(value).digest().subarray(0, 12);
}

export function encryptPii(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isEncrypted(trimmed)) return trimmed;

  const key = requireKey();
  const iv = deterministicIv(key, field, trimmed);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(field));
  const ciphertext = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function encryptPiiForLookup(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isEncrypted(trimmed)) return trimmed;

  const key = keyMaterial();
  if (!key && process.env.NODE_ENV === 'production') return null;
  const usableKey = key ?? createHash('sha256').update('aroadri-dev-pii-key').digest();
  const iv = deterministicIv(usableKey, field, trimmed);
  const cipher = createCipheriv('aes-256-gcm', usableKey, iv);
  cipher.setAAD(Buffer.from(field));
  const ciphertext = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptPii(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;

  const [, version, ivPart, tagPart, ciphertextPart] = value.split(':');
  if (version !== 'v1' || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error(`Unsupported encrypted PII format for ${field}.`);
  }

  const key = requireKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAAD(Buffer.from(field));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskPii(value: string | null | undefined): string | null {
  const plain = value ?? null;
  if (!plain) return null;
  if (plain.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, plain.length - 4))}${plain.slice(-4)}`;
}
