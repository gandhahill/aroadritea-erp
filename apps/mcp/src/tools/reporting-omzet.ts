/**
 * reporting.get_omzet_harian MCP tool — SD §25.5b.6, SoT §21.3b
 */

import { getOmzetHarian } from '@erp/services/reporting';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess } from '../helpers';

export const GetOmzetHarianSchema = z.object({
  location_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

async function checkPermission(ctx: McpContext, permission: string, locationId?: string) {
  const { can } = await import('@erp/services/iam');
  return can(ctx.userId, permission, locationId ? { locationId } : {});
}

export async function getOmzetHarianHandler(input: unknown, ctx: McpContext) {
  const parsed = GetOmzetHarianSchema.safeParse(input);
  if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

  const { location_id, date, locale } = parsed.data;

  const permitted = await checkPermission(ctx, 'reporting.view', location_id);
  if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: reporting.view');

  const result = await getOmzetHarian(
    { locationId: location_id, date },
    {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      locationId: location_id,
    },
  );

  if (!result.ok) return mcpError('OMZET_GET_FAILED', JSON.stringify(result.error));

  const data = result.value;

  // Format bigint strings to human-readable IDR
  function toIDR(s: string): string {
    const cents = BigInt(s);
    const idr = cents / BigInt(100);
    return Number(idr).toLocaleString(
      locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'id-ID',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      },
    );
  }

  return mcpSuccess({
    date: data.date,
    location_id: data.locationId,
    location_name: data.locationName,
    gross_sales_idr: toIDR(data.grossSales),
    pb1_amount_idr: toIDR(data.pb1Amount),
    net_omzet_idr: toIDR(data.netOmzet),
    adjustment_amount_idr: toIDR(data.adjustmentAmount),
    adjustment_note: data.adjustmentNote,
    fiscal_omzet_idr: toIDR(data.fiscalOmzet),
    shift_count: data.shiftCount,
    last_modified: data.lastModified,
  });
}
