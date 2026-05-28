/**
 * Password hashing — using bcryptjs to avoid native build issues on Linux (Node 26).
 * Separated for testability and reuse in seed scripts.
 */

import * as bcrypt from 'bcryptjs';

import { argon2Verify } from 'hash-wasm';

/**
 * Hash a password with bcrypt.
 * Cost is 12 as required by SD §11.1 to stay within constraints while maintaining security.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash.
 * Supports legacy argon2id hashes via hash-wasm to ensure backwards compatibility.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    if (hash.startsWith('$argon2')) {
      return await argon2Verify({ password, hash });
    }
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
