/**
 * Password hashing — argon2id as required by SD §11.1.
 * Separated for testability and reuse in seed scripts.
 */

import * as argon2 from 'argon2';

/**
 * Hash a password with argon2id.
 * Cost is moderate to stay within 2 GB RAM constraint.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,  // ~19 MB (moderate for 2 GB server)
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verify a password against an argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
