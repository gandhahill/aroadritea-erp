/**
 * Inventory, Purchasing, POS, HR, Payroll, CRM, Audit MCP tools.
 * These are Phase 2+ tools — stubs that return informative "not implemented" messages.
 */

import { z } from 'zod';
import { mcpSuccess } from '../helpers';
import type { McpContext } from '../context';

const NOT_IMPLEMENTED = (module: string) =>
  mcpSuccess({
    note: `Module '${module}' is not yet implemented. Expected in Phase 2+. See SYSTEM-DESIGN.md §16.4 and TASK.md backlog.`,
  });

// --- Inventory ---

export const InventoryListProductsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
});

export const InventoryGetStockSchema = z.object({
  product_id: z.string(),
  location_id: z.string().optional(),
});

export const InventoryAdjustSchema = z.object({
  product_id: z.string(),
  location_id: z.string(),
  qty_delta: z.number(),
  reason: z.string(),
  note: z.string().optional(),
});

export const inventoryTools = [
  {
    name: 'inventory.list_products',
    schema: InventoryListProductsSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('inventory.list_products'),
  },
  {
    name: 'inventory.get_stock',
    schema: InventoryGetStockSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('inventory.get_stock'),
  },
  {
    name: 'inventory.adjust',
    schema: InventoryAdjustSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('inventory.adjust'),
  },
] as const;

// --- Purchasing ---

export const PurchasingCreatePOSchema = z.object({
  supplier_id: z.string(),
  location_id: z.string(),
  lines: z.array(
    z.object({
      product_id: z.string(),
      qty: z.number(),
      unit_price: z.string(),
    }),
  ),
});

export const PurchasingApprovePOSchema = z.object({
  po_id: z.string(),
});

export const PurchasingCreateGRNSchema = z.object({
  po_id: z.string(),
  lines: z.array(
    z.object({
      po_line_id: z.string(),
      qty_received: z.number(),
      notes: z.string().optional(),
    }),
  ),
});

export const purchasingTools = [
  {
    name: 'purchasing.create_po',
    schema: PurchasingCreatePOSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('purchasing.create_po'),
  },
  {
    name: 'purchasing.approve_po',
    schema: PurchasingApprovePOSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('purchasing.approve_po'),
  },
  {
    name: 'purchasing.create_grn',
    schema: PurchasingCreateGRNSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('purchasing.create_grn'),
  },
] as const;

// --- POS ---

export const POSListSalesSchema = z.object({
  location_id: z.string(),
  from: z.string(),
  to: z.string(),
  channel: z.enum(['walk_in', 'gofood', 'grabfood', 'shopeefood']).optional(),
});

export const POSRefundSchema = z.object({
  sales_order_id: z.string(),
  reason: z.string(),
  lines: z
    .array(z.object({ line_id: z.string(), qty: z.number() }))
    .optional(),
});

export const posTools = [
  {
    name: 'pos.list_sales',
    schema: POSListSalesSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('pos.list_sales'),
  },
  {
    name: 'pos.refund',
    schema: POSRefundSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('pos.refund'),
  },
] as const;

// --- HR ---

export const HRCreateEmployeeSchema = z.object({
  display_name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const HRListEmployeesSchema = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  location_id: z.string().optional(),
});

export const hrTools = [
  {
    name: 'hr.create_employee',
    schema: HRCreateEmployeeSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('hr.create_employee'),
  },
  {
    name: 'hr.list_employees',
    schema: HRListEmployeesSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('hr.list_employees'),
  },
] as const;

// --- Payroll ---

export const PayrollRunSchema = z.object({
  period_code: z.string(),
});

export const PayrollApproveSchema = z.object({
  payroll_id: z.string(),
});

export const payrollTools = [
  {
    name: 'payroll.run',
    schema: PayrollRunSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('payroll.run'),
  },
  {
    name: 'payroll.approve',
    schema: PayrollApproveSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('payroll.approve'),
  },
] as const;

// --- CRM ---

export const CRMCreateMemberSchema = z.object({
  display_name: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  date_of_birth: z.string().optional(),
  city: z.string().optional(),
});

export const CRMLogComplaintSchema = z.object({
  customer_id: z.string(),
  description: z.string(),
  compensation: z
    .object({ type: z.enum(['product', 'refund', 'discount']), value: z.string() })
    .optional(),
});

export const crmTools = [
  {
    name: 'crm.create_member',
    schema: CRMCreateMemberSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('crm.create_member'),
  },
  {
    name: 'crm.log_complaint',
    schema: CRMLogComplaintSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('crm.log_complaint'),
  },
] as const;

// --- Audit ---

export const AuditSearchSchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  actor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().optional().default(50),
  cursor: z.string().optional(),
});

export const auditTools = [
  {
    name: 'audit.search',
    schema: AuditSearchSchema,
    handler: async (_input: unknown, _ctx: McpContext) => NOT_IMPLEMENTED('audit.search'),
  },
] as const;
