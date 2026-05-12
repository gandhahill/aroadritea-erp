/**
 * Inventory, Purchasing, POS, HR, Payroll, CRM, Audit MCP tools.
 * These are Phase 2+ tools — stubs that return informative "not implemented" messages.
 */

import { z } from 'zod';
import { can } from '@erp/services/iam';
import { mcpSuccess, mcpError } from '../helpers';
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
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  location_id: z.string(),
});

export const PayrollApproveSchema = z.object({
  payroll_id: z.string(),
  description: z.string().optional(),
});

export const PayrollMarkPaidSchema = z.object({
  payroll_id: z.string(),
});

async function checkPermission(ctx: McpContext, permission: string, locationId?: string) {
  return can(ctx.userId, permission, locationId ? { locationId } : {});
}

export const payrollTools = [
  {
    name: 'payroll.run',
    schema: PayrollRunSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PayrollRunSchema.safeParse(input);
      if (!parsed.success) {
        return mcpError('INVALID_INPUT', String(parsed.error.issues));
      }
      const { period_code, period_start, period_end, location_id } = parsed.data;

      const permitted = await checkPermission(ctx, 'hr.payroll.write', location_id);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.payroll.write');

      const { runPayroll } = await import('@erp/services/payroll');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: location_id };
      const result = await runPayroll(
        { periodCode: period_code, periodStart: period_start, periodEnd: period_end, locationId: location_id },
        auditCtx,
      );
      if (!result.ok) return mcpError('PAYROLL_RUN_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'payroll.approve',
    schema: PayrollApproveSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PayrollApproveSchema.safeParse(input);
      if (!parsed.success) {
        return mcpError('INVALID_INPUT', String(parsed.error.issues));
      }
      const { payroll_id, description } = parsed.data;

      // Load payroll to find location_id for permission check
      const { db } = await import('@erp/db');
      const { payrolls } = await import('@erp/db/schema/hr');
      const { eq } = await import('drizzle-orm');
      const [payroll] = await db.select({ locationId: payrolls.locationId }).from(payrolls).where(eq(payrolls.id, payroll_id)).limit(1);
      if (!payroll) return mcpError('NOT_FOUND', `Payroll ${payroll_id} not found`);

      const permitted = await checkPermission(ctx, 'hr.payroll.approve', payroll.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.payroll.approve');

      const { approvePayroll } = await import('@erp/services/payroll');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: payroll.locationId };
      const result = await approvePayroll({ payrollId: payroll_id, description }, auditCtx);
      if (!result.ok) return mcpError('PAYROLL_APPROVE_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'payroll.mark_paid',
    schema: PayrollMarkPaidSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PayrollMarkPaidSchema.safeParse(input);
      if (!parsed.success) {
        return mcpError('INVALID_INPUT', String(parsed.error.issues));
      }
      const { payroll_id } = parsed.data;

      const { db } = await import('@erp/db');
      const { payrolls } = await import('@erp/db/schema/hr');
      const { eq } = await import('drizzle-orm');
      const [payroll] = await db.select({ locationId: payrolls.locationId }).from(payrolls).where(eq(payrolls.id, payroll_id)).limit(1);
      if (!payroll) return mcpError('NOT_FOUND', `Payroll ${payroll_id} not found`);

      const permitted = await checkPermission(ctx, 'hr.payroll.write', payroll.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.payroll.write');

      const { markPayrollPaid } = await import('@erp/services/payroll');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: payroll.locationId };
      const result = await markPayrollPaid({ payrollId: payroll_id }, auditCtx);
      if (!result.ok) return mcpError('PAYROLL_MARK_PAID_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
] as const;

// --- Disciplinary Actions (HR) ---

export const DisciplinaryCreateSchema = z.object({
  employee_id: z.string(),
  level: z.enum(['SP1', 'SP2', 'SP3']),
  reason: z.string().min(10),
  incident_date: z.string().datetime(),
  attachment_url: z.string().url().optional(),
});

export const DisciplinaryAcknowledgeSchema = z.object({
  disciplinary_id: z.string(),
});

export const DisciplinaryListSchema = z.object({
  employee_id: z.string().optional(),
  level: z.enum(['SP1', 'SP2', 'SP3']).optional(),
  status: z.enum(['issued', 'acknowledged', 'escalated']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

export const disciplinaryTools = [
  {
    name: 'hr.create_disciplinary_action',
    schema: DisciplinaryCreateSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = DisciplinaryCreateSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { employee_id, level, reason, incident_date, attachment_url } = parsed.data;

      const permitted = await checkPermission(ctx, 'hr.disciplinary.write', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.disciplinary.write');

      const { createDisciplinaryAction } = await import('@erp/services/hr');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: ctx.locationId ?? '' };
      const result = await createDisciplinaryAction(
        { employeeId: employee_id, level, reason, incidentDate: incident_date, attachmentUrl: attachment_url },
        auditCtx,
      );
      if (!result.ok) return mcpError('DISCIPLINARY_CREATE_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'hr.list_disciplinary_actions',
    schema: DisciplinaryListSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = DisciplinaryListSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const permitted = await checkPermission(ctx, 'hr.disciplinary.read', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.disciplinary.read');

      const { listDisciplinaryActions } = await import('@erp/services/hr');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: ctx.locationId ?? '' };
      const result = await listDisciplinaryActions(parsed.data, auditCtx);
      if (!result.ok) return mcpError('DISCIPLINARY_LIST_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'hr.acknowledge_disciplinary_action',
    schema: DisciplinaryAcknowledgeSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = DisciplinaryAcknowledgeSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const permitted = await checkPermission(ctx, 'hr.disciplinary.write', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.disciplinary.write');

      const { acknowledgeDisciplinaryAction } = await import('@erp/services/hr');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: ctx.locationId ?? '' };
      const result = await acknowledgeDisciplinaryAction({ disciplinaryId: parsed.data.disciplinary_id }, auditCtx);
      if (!result.ok) return mcpError('DISCIPLINARY_ACK_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
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
