/**
 * HR employees server actions — SD §9.6, §21.8
 *
 * All HR data operations go through these actions.
 * Permission checks via requirePermission in service layer.
 */

'use server';

import { getEmployee, listEmployees } from '@erp/services/hr';
import type { ListEmployeesInput } from '@erp/services/hr';
import type { AuditContext } from '@erp/shared/types';

export async function serverListEmployees(input: ListEmployeesInput, ctx: AuditContext) {
  return listEmployees(input, ctx);
}

export async function serverGetEmployee(employeeId: string, ctx: AuditContext) {
  return getEmployee(employeeId, ctx);
}
