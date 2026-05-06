/**
 * ULID generator — lexicographically sortable, 26-char string.
 * Internal implementation per SD §7.10 / P16 (lean deps).
 *
 * Crockford's Base32 encoding, monotonic within same millisecond.
 */

export type EntityId = string;

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length; // 32
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
let lastRandom: number[] = [];

function encodeTime(now: number, len: number): string {
  let str = '';
  let t = now;
  for (let i = len; i > 0; i--) {
    const mod = t % ENCODING_LEN;
    str = ENCODING[mod] + str;
    t = (t - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  const buffer = new Uint8Array(len);
  crypto.getRandomValues(buffer);
  for (let i = 0; i < len; i++) {
    str += ENCODING[buffer[i]! % ENCODING_LEN];
  }
  return str;
}

function incrementRandom(random: number[]): number[] {
  const result = [...random];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]! < ENCODING_LEN - 1) {
      result[i]!++;
      return result;
    }
    result[i] = 0;
  }
  // overflow — extremely unlikely, just regenerate
  return [];
}

/**
 * Generate a monotonic ULID. Within the same millisecond, the random
 * component is incremented to guarantee sort order.
 */
export function generateId(): EntityId {
  const now = Date.now();

  if (now === lastTime && lastRandom.length > 0) {
    lastRandom = incrementRandom(lastRandom);
    if (lastRandom.length === 0) {
      // overflow fallback — use fresh random
      return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
    }
    return encodeTime(now, TIME_LEN) + lastRandom.map((i) => ENCODING[i]).join('');
  }

  lastTime = now;

  // Generate new random component and store numeric indices
  const buffer = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(buffer);
  lastRandom = Array.from(buffer).map((b) => b % ENCODING_LEN);

  return encodeTime(now, TIME_LEN) + lastRandom.map((i) => ENCODING[i]).join('');
}

/**
 * Validate that a string looks like a ULID (26 uppercase Crockford Base32 chars).
 */
export function isValidId(id: string): boolean {
  if (id.length !== 26) return false;
  for (const ch of id) {
    if (!ENCODING.includes(ch)) return false;
  }
  return true;
}

/**
 * Extract the timestamp (ms since epoch) from a ULID.
 */
export function extractTimestamp(id: EntityId): number {
  if (id.length !== 26) throw new Error('Invalid ULID length');
  const timePart = id.slice(0, TIME_LEN);
  let time = 0;
  for (const ch of timePart) {
    const idx = ENCODING.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid ULID character: ${ch}`);
    time = time * ENCODING_LEN + idx;
  }
  return time;
}
