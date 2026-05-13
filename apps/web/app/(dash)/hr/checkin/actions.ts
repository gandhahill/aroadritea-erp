/**
 * HR Check-In Server Action — calls attendance.checkIn service.
 */

'use server';

import { checkIn } from '@erp/services/hr';
import type { CheckInInput } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';

export async function serverCheckIn(input: CheckInInput, ctx: AuditContext) {
  return checkIn(input, ctx);
}
