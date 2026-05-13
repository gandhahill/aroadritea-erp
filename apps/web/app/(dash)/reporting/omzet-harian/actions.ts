/**
 * Omzet Harian Server Actions — SD §25.5b, SoT §21.3b
 */

'use server';

import { getOmzetHarian, saveOmzetAdjustment, exportOmzetHarianXlsx } from '@erp/services/reporting';
import type { AuditContext } from '@erp/shared/types';

export async function serverGetOmzetHarian(params: { locationId: string; date: string }, ctx: AuditContext) {
  return getOmzetHarian(params, ctx);
}

export async function serverSaveOmzetAdjustment(
  params: { locationId: string; date: string; adjustmentAmount: string; adjustmentNote?: string },
  ctx: AuditContext,
) {
  return saveOmzetAdjustment(params, ctx);
}

export async function serverExportOmzetHarian(
  params: { locationId: string; date: string; locale?: 'id' | 'en' | 'zh' },
  ctx: AuditContext,
) {
  return exportOmzetHarianXlsx(params, ctx);
}