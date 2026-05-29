import { type Result, ok } from '@erp/shared/result';

/**
 * Generates ESC/POS command bytes to kick the cash drawer.
 * This array of bytes should be sent to the receipt printer via Web Serial or USB API.
 * 
 * ESC p m t1 t2
 * m: 0 (drawer 1) or 1 (drawer 2)
 * t1: pulse on time (t1 * 2ms)
 * t2: pulse off time (t2 * 2ms)
 */
export function getKickDrawerCommand(pin: 0 | 1 = 0, t1: number = 25, t2: number = 250): Result<Uint8Array> {
  // ESC (27), p (112), pin (0 or 1), t1, t2
  const cmd = new Uint8Array([27, 112, pin, t1, t2]);
  return ok(cmd);
}

/**
 * Basic ESC/POS command to cut paper
 */
export function getCutPaperCommand(): Result<Uint8Array> {
  // GS (29), V (86), 1 (cut)
  const cmd = new Uint8Array([29, 86, 1]);
  return ok(cmd);
}
