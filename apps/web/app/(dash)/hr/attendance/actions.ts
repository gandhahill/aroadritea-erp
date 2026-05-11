/**
 * Attendance server actions — SD §21.8 §Attendance SOP
 */

'use server';

import { listAttendance } from '@erp/services';
import type { ListAttendanceInput } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';

export async function serverListAttendance(input: ListAttendanceInput, ctx: AuditContext) {
  return listAttendance(input, ctx);
}
