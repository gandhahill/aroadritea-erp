import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess, serializeResult } from '../helpers';

// ─── Security Checks ──────────────────────────────────────────────────────────

/**
 * Ensures location_id is explicitly provided and matches the caller's location,
 * preventing AI from making tenant-wide updates without a specific outlet.
 */
function requireExplicitLocation(location_id: string | undefined, ctx: McpContext): string | Error {
  if (!location_id) return new Error('location_id is required to prevent accidental global scope');
  return location_id;
}

// ─── CMS Tools ────────────────────────────────────────────────────────────────

export const CMSListPagesSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const CMSListFaqsSchema = z.object({
  active_only: z.boolean().optional().default(true),
  category: z.string().optional(),
});

export const CMSUpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

export const cmsTools = [
  {
    name: 'cms.list_pages',
    description: 'Read CMS pages to answer customer inquiries or review website content.',
    schema: CMSListPagesSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CMSListPagesSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { listPages } = await import('@erp/services/cms');
      const result = await listPages(ctx.tenantId, { status: parsed.data.status });
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ pages: result.value });
    },
  },
  {
    name: 'cms.list_faqs',
    description: 'Read FAQs to answer customer inquiries accurately based on company policy.',
    schema: CMSListFaqsSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CMSListFaqsSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { listFaqs } = await import('@erp/services/cms');
      const result = await listFaqs(ctx.tenantId, { activeOnly: parsed.data.active_only, category: parsed.data.category });
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ faqs: result.value });
    },
  },
  {
    name: 'cms.update_setting',
    description: 'Update a global CMS setting (e.g., site_notice, active_promo). Requires high privileges.',
    schema: CMSUpdateSettingSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CMSUpdateSettingSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { setSetting } = await import('@erp/services/cms');
      const result = await setSetting(ctx.tenantId, parsed.data.key, parsed.data.value, { userId: ctx.userId, tenantId: ctx.tenantId, locationId: ctx.locationId ?? '' });
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ success: true, key: parsed.data.key });
    },
  },
];

// ─── Inventory Tools (Phase 3 additions) ──────────────────────────────────────

export const InventoryCreateOpnameSchema = z.object({
  location_id: z.string().min(1),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  period_code: z.string().min(1),
  kind: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  notes: z.string().optional(),
});

export const InventoryTransferStockSchema = z.object({
  from_location_id: z.string().min(1),
  to_location_id: z.string().min(1),
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string(),
  lines: z.array(
    z.object({
      productId: z.string().min(1),
      qtyTransfer: z.string(),
      uom: z.string(),
    })
  ).min(1),
});

export const inventoryToolsPhase3 = [
  {
    name: 'inventory.create_opname',
    description: 'Create a draft stock opname session for physical counting.',
    schema: InventoryCreateOpnameSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = InventoryCreateOpnameSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const locId = requireExplicitLocation(parsed.data.location_id, ctx);
      if (locId instanceof Error) return mcpError('MISSING_LOCATION', locId.message);

      const { createOpnameDraft } = await import('@erp/services/inventory/opname-service');
      const result = await createOpnameDraft(
        {
          sessionDate: parsed.data.session_date,
          periodCode: parsed.data.period_code,
          kind: parsed.data.kind,
          notes: parsed.data.notes,
        },
        { userId: ctx.userId, tenantId: ctx.tenantId, locationId: locId }
      );
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ session: result.value });
    },
  },
  {
    name: 'inventory.transfer_stock',
    description: 'Create a draft stock transfer between locations.',
    schema: InventoryTransferStockSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = InventoryTransferStockSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      
      const { createTransferDraft } = await import('@erp/services/inventory/transfer-service');
      const result = await createTransferDraft(
        {
          fromLocationId: parsed.data.from_location_id,
          toLocationId: parsed.data.to_location_id,
          transferDate: parsed.data.transfer_date,
          reason: parsed.data.reason as never,
          lines: parsed.data.lines,
        },
        { userId: ctx.userId, tenantId: ctx.tenantId, locationId: parsed.data.from_location_id }
      );
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ transfer: result.value });
    },
  },
];

// ─── POS Tools (Phase 3 additions) ────────────────────────────────────────────

export const POSLogExpenseSchema = z.object({
  location_id: z.string().min(1),
  shift_id: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().min(1),
});

export const posToolsPhase3 = [
  {
    name: 'pos.log_expense',
    description: 'Log an operational shift expense (e.g. buying water, emergency supplies).',
    schema: POSLogExpenseSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = POSLogExpenseSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const locId = requireExplicitLocation(parsed.data.location_id, ctx);
      if (locId instanceof Error) return mcpError('MISSING_LOCATION', locId.message);

      const { recordShiftExpense } = await import('@erp/services/pos/shift-expense-service');
      const result = await recordShiftExpense(
        {
          shiftId: parsed.data.shift_id,
          amount: String(parsed.data.amount),
          description: parsed.data.description,
          idempotencyKey: crypto.randomUUID(),
        },
        { userId: ctx.userId, tenantId: ctx.tenantId, locationId: locId }
      );
      if (!result.ok) return serializeResult(result);
      return mcpSuccess({ expense: result.value });
    },
  },
];

// ─── HR & Whistleblower Tools (Phase 3 additions) ──────────────────────────────

export const HRListWhistleblowerSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved']).optional(),
});

export const hrToolsPhase3 = [
  {
    name: 'hr.list_whistleblower_reports',
    description: 'List anonymous whistleblower reports (requires HR privileges).',
    schema: HRListWhistleblowerSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = HRListWhistleblowerSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const { listWhistleblowerReports } = await import('@erp/services/hr/whistleblower');
      const result = await listWhistleblowerReports({ userId: ctx.userId, tenantId: ctx.tenantId, locationId: ctx.locationId ?? '' });
      if (!result.ok) return serializeResult(result);
      
      let items = result.value;
      if (parsed.data.status) {
        items = items.filter((r: any) => r.status === parsed.data.status);
      }
      return mcpSuccess({ reports: items });
    },
  },
];

export const phase3Tools = [
  ...cmsTools,
  ...inventoryToolsPhase3,
  ...posToolsPhase3,
  ...hrToolsPhase3,
];
