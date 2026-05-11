/**
 * HR Check-In Server Action — calls attendance.checkIn service.
 */

'use server';

import { checkIn } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';
import type { CheckInInput } from '@erp/services';

export async function serverCheckIn(input: CheckInInput, ctx: AuditContext) {
  return checkIn(input, ctx);
}
