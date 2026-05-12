'use server';

import { listDisciplinaryActions, createDisciplinaryAction, acknowledgeDisciplinaryAction } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';

export async function listDisciplinaryActionsAction(input: {
  employeeId?: string;
  level?: 'SP1' | 'SP2' | 'SP3';
  status?: 'issued' | 'acknowledged' | 'escalated';
}) {
  const ctx: AuditContext = {
    userId: 'system',
    tenantId: 'default',
    locationId: '',
  };
  return listDisciplinaryActions({ limit: 50, ...input }, ctx);
}

export async function createDisciplinaryActionAction(input: Parameters<typeof createDisciplinaryAction>[0]) {
  const ctx: AuditContext = {
    userId: 'system',
    tenantId: 'default',
    locationId: '',
  };
  return createDisciplinaryAction(input, ctx);
}

export async function acknowledgeDisciplinaryActionAction(input: Parameters<typeof acknowledgeDisciplinaryAction>[0]) {
  const ctx: AuditContext = {
    userId: 'system',
    tenantId: 'default',
    locationId: '',
  };
  return acknowledgeDisciplinaryAction(input, ctx);
}