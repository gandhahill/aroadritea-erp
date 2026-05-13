/**
 * Inventory, Purchasing, POS, HR, Payroll, CRM, Audit MCP tools.
 * These are Phase 2+ tools — stubs that return informative "not implemented" messages.
 */

import { can } from '@erp/services/iam';
import { z } from 'zod';
import type { McpContext } from '../context';
import { mcpError, mcpSuccess } from '../helpers';

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
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = InventoryListProductsSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const permitted = await checkPermission(ctx, 'inventory.view', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: inventory.view');

      const { listProducts } = await import('@erp/services/inventory');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await listProducts(
        {
          isActive: true,
          limit: 50,
          offset: 0,
          search: parsed.data.query,
          categoryId: parsed.data.category,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('INVENTORY_LIST_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'inventory.get_stock',
    schema: InventoryGetStockSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = InventoryGetStockSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { product_id, location_id } = parsed.data;
      const locId = location_id ?? ctx.locationId ?? '';

      const permitted = await checkPermission(ctx, 'inventory.view', locId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: inventory.view');

      const { db } = await import('@erp/db');
      const { stockLevels } = await import('@erp/db/schema/inventory');
      const { eq, and } = await import('drizzle-orm');

      const query = locId
        ? db
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.tenantId, ctx.tenantId),
                eq(stockLevels.productId, product_id),
                eq(stockLevels.locationId, locId),
              ),
            )
        : db
            .select()
            .from(stockLevels)
            .where(
              and(eq(stockLevels.tenantId, ctx.tenantId), eq(stockLevels.productId, product_id)),
            );

      const rows = await query;
      return mcpSuccess({ items: rows });
    },
  },
  {
    name: 'inventory.adjust',
    schema: InventoryAdjustSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = InventoryAdjustSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { product_id, location_id, qty_delta, reason, note } = parsed.data;

      const permitted = await checkPermission(ctx, 'inventory.adjust', location_id);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: inventory.adjust');

      const { createAdjustmentDraft, submitAdjustment } = await import('@erp/services/inventory');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: location_id };

      // 1. Create draft adjustment
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const draftResult = await createAdjustmentDraft(
        {
          locationId: location_id,
          adjustmentDate: today,
          reason: reason as never,
          notes: note,
          lines: [
            {
              productId: product_id,
              qtyBefore: '0',
              qtyAfter: String(Math.max(0, qty_delta)),
              qtyDelta: String(qty_delta),
              uom: 'pcs',
            },
          ],
        },
        auditCtx,
      );
      if (!draftResult.ok)
        return mcpError('INVENTORY_ADJUST_DRAFT_FAILED', JSON.stringify(draftResult.error));

      // 2. Auto-submit (single-step approval for MCP)
      const submitResult = await submitAdjustment(draftResult.value.id, auditCtx);
      if (!submitResult.ok)
        return mcpError('INVENTORY_ADJUST_SUBMIT_FAILED', JSON.stringify(submitResult.error));

      return mcpSuccess(submitResult.value);
    },
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
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PurchasingCreatePOSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { supplier_id, location_id, lines } = parsed.data;

      const permitted = await checkPermission(ctx, 'purchasing.po.create', location_id);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: purchasing.po.create');

      const { createPO } = await import('@erp/services/purchasing');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: location_id };
      const result = await createPO(
        {
          supplierId: supplier_id,
          locationId: location_id,
          lines: lines.map((l) => ({
            productId: l.product_id,
            qty: l.qty,
            unitPrice: l.unit_price,
          })),
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('PURCHASING_CREATE_PO_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'purchasing.approve_po',
    schema: PurchasingApprovePOSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PurchasingApprovePOSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { po_id } = parsed.data;

      // Load PO to get location for permission check
      const { db } = await import('@erp/db');
      const { purchaseOrders } = await import('@erp/db/schema/purchasing');
      const { eq } = await import('drizzle-orm');
      const [po] = await db
        .select({ locationId: purchaseOrders.locationId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, po_id))
        .limit(1);
      if (!po) return mcpError('NOT_FOUND', `Purchase order ${po_id} not found`);

      const permitted = await checkPermission(ctx, 'purchasing.po.approve', po.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: purchasing.po.approve');

      const { approvePO } = await import('@erp/services/purchasing');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: po.locationId };
      const result = await approvePO({ purchaseOrderId: po_id }, auditCtx);
      if (!result.ok) return mcpError('PURCHASING_APPROVE_PO_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'purchasing.create_grn',
    schema: PurchasingCreateGRNSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = PurchasingCreateGRNSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { po_id, lines } = parsed.data;

      // Load PO to get location for permission check
      const { db } = await import('@erp/db');
      const { purchaseOrders } = await import('@erp/db/schema/purchasing');
      const { eq } = await import('drizzle-orm');
      const [po] = await db
        .select({ locationId: purchaseOrders.locationId })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, po_id))
        .limit(1);
      if (!po) return mcpError('NOT_FOUND', `Purchase order ${po_id} not found`);

      const permitted = await checkPermission(ctx, 'purchasing.grn.create', po.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: purchasing.grn.create');

      const { createGRN } = await import('@erp/services/purchasing');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: po.locationId };
      const result = await createGRN(
        {
          purchaseOrderId: po_id,
          lines: lines.map((l) => ({
            poLineId: l.po_line_id,
            qtyReceived: l.qty_received,
            notes: l.notes,
          })),
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('PURCHASING_CREATE_GRN_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
] as const;

// --- POS ---

export const POSListSalesSchema = z.object({
  location_id: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  channel: z.enum(['walk_in', 'gofood', 'grabfood', 'shopeefood']).optional(),
  limit: z.number().min(1).max(200).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

export const POSRefundSchema = z.object({
  sales_order_id: z.string(),
  reason: z.string().min(5),
  lines: z.array(z.object({ line_id: z.string(), qty: z.number().int().positive() })).optional(),
});

export const posTools = [
  {
    name: 'pos.list_sales',
    schema: POSListSalesSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = POSListSalesSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { location_id, from, to, channel, limit, offset } = parsed.data;

      const permitted = await checkPermission(ctx, 'pos.transact', location_id);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: pos.transact');

      const { db } = await import('@erp/db');
      const { salesOrders } = await import('@erp/db/schema/pos');
      const { and, eq, gte, lte, desc, sql } = await import('drizzle-orm');

      const conditions = [
        eq(salesOrders.tenantId, ctx.tenantId),
        eq(salesOrders.locationId, location_id),
      ];
      if (from) conditions.push(gte(salesOrders.createdAt, new Date(from)));
      if (to) conditions.push(lte(salesOrders.createdAt, new Date(to)));
      if (channel) conditions.push(eq(salesOrders.channel, channel));

      const rows = await db
        .select()
        .from(salesOrders)
        .where(and(...conditions))
        .orderBy(desc(salesOrders.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, -1) : rows;
      return mcpSuccess({
        items,
        hasMore,
        nextOffset: hasMore ? String(offset + limit) : undefined,
      });
    },
  },
  {
    name: 'pos.refund',
    schema: POSRefundSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = POSRefundSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { sales_order_id, reason, lines } = parsed.data;

      const { db } = await import('@erp/db');
      const { salesOrders } = await import('@erp/db/schema/pos');
      const { eq } = await import('drizzle-orm');
      const [sale] = await db
        .select({ locationId: salesOrders.locationId })
        .from(salesOrders)
        .where(eq(salesOrders.id, sales_order_id))
        .limit(1);
      if (!sale) return mcpError('NOT_FOUND', `Sale ${sales_order_id} not found`);

      const permitted = await checkPermission(ctx, 'pos.transact', sale.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: pos.transact');

      const { refundSale } = await import('@erp/services/pos');
      const auditCtx = { userId: ctx.userId, tenantId: ctx.tenantId, locationId: sale.locationId };
      const result = await refundSale(
        {
          salesOrderId: sales_order_id,
          reason,
          refundLines: lines?.map((l) => ({ lineId: l.line_id, qty: l.qty })),
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('POS_REFUND_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
] as const;

// --- HR ---

export const HRCreateEmployeeSchema = z.object({
  nik: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1).max(64),
  department: z.string().optional(),
  hire_date: z.string().datetime(), // ISO date
  probation_end_date: z.string().datetime().optional(),
  contract_type: z.enum(['pkwt', 'pkwtt']),
  npwp: z.string().optional(),
  bpjs_kesehatan: z.string().optional(),
  bpjs_tenagakerja: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

export const HRListEmployeesSchema = z.object({
  status: z.enum(['probation', 'active', 'on_leave', 'terminated']).optional(),
  department: z.string().optional(),
  location_id: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const hrTools = [
  {
    name: 'hr.create_employee',
    schema: HRCreateEmployeeSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = HRCreateEmployeeSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const data = parsed.data;

      const permitted = await checkPermission(ctx, 'hr.employee.write', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.employee.write');

      const { createEmployee } = await import('@erp/services/hr');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await createEmployee(
        {
          nik: data.nik,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          position: data.position,
          department: data.department,
          hireDate: data.hire_date,
          probationEndDate: data.probation_end_date,
          contractType: data.contract_type,
          workSchedule: 'fulltime' as const,
          npwp: data.npwp,
          bpjsKesehatan: data.bpjs_kesehatan,
          bpjsTenagakerja: data.bpjs_tenagakerja,
          emergencyContactName: data.emergency_contact_name,
          emergencyContactPhone: data.emergency_contact_phone,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('HR_CREATE_EMPLOYEE_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'hr.list_employees',
    schema: HRListEmployeesSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = HRListEmployeesSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const permitted = await checkPermission(ctx, 'hr.employee.read', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.employee.read');

      const { listEmployees } = await import('@erp/services/hr');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await listEmployees(
        {
          status: parsed.data.status,
          department: parsed.data.department,
          locationId: parsed.data.location_id,
          search: parsed.data.search,
          limit: parsed.data.limit,
          offset: parsed.data.offset,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('HR_LIST_EMPLOYEES_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
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
        {
          periodCode: period_code,
          periodStart: period_start,
          periodEnd: period_end,
          locationId: location_id,
        },
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
      const [payroll] = await db
        .select({ locationId: payrolls.locationId })
        .from(payrolls)
        .where(eq(payrolls.id, payroll_id))
        .limit(1);
      if (!payroll) return mcpError('NOT_FOUND', `Payroll ${payroll_id} not found`);

      const permitted = await checkPermission(ctx, 'hr.payroll.approve', payroll.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.payroll.approve');

      const { approvePayroll } = await import('@erp/services/payroll');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: payroll.locationId,
      };
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
      const [payroll] = await db
        .select({ locationId: payrolls.locationId })
        .from(payrolls)
        .where(eq(payrolls.id, payroll_id))
        .limit(1);
      if (!payroll) return mcpError('NOT_FOUND', `Payroll ${payroll_id} not found`);

      const permitted = await checkPermission(ctx, 'hr.payroll.write', payroll.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: hr.payroll.write');

      const { markPayrollPaid } = await import('@erp/services/payroll');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: payroll.locationId,
      };
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
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await createDisciplinaryAction(
        {
          employeeId: employee_id,
          level,
          reason,
          incidentDate: incident_date,
          attachmentUrl: attachment_url,
        },
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
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
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
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await acknowledgeDisciplinaryAction(
        { disciplinaryId: parsed.data.disciplinary_id },
        auditCtx,
      );
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
  member_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  order_id: z.string().optional(),
  order_number: z.string().optional(),
  occurred_at: z.string().datetime(),
  category: z.enum(['product_quality', 'service', 'cleanliness', 'wrong_order', 'staff', 'other']),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
});

export const CRMListComplaintsSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed', 'escalated']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().optional().default(50),
});

export const CRMResolveComplaintSchema = z.object({
  complaint_id: z.string(),
  status: z.enum(['investigating', 'resolved', 'closed', 'escalated']),
  resolution_notes: z.string().optional(),
});

export const crmTools = [
  {
    name: 'crm.create_member',
    schema: CRMCreateMemberSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CRMCreateMemberSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { display_name, phone, email, date_of_birth, city } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.manage_members', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.manage_members');

      const { createPartner } = await import('@erp/services/crm');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await createPartner(
        {
          name: display_name,
          phone,
          email,
          kind: 'customer',
          isMember: true,
          birthDate: date_of_birth,
          city,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('CRM_CREATE_MEMBER_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'crm.log_complaint',
    schema: CRMLogComplaintSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CRMLogComplaintSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const {
        member_id,
        customer_name,
        customer_phone,
        order_id,
        order_number,
        occurred_at,
        category,
        description,
        priority,
      } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.logComplaint', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.logComplaint');

      const { logComplaint } = await import('@erp/services/crm');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await logComplaint(
        {
          memberId: member_id,
          customerName: customer_name,
          customerPhone: customer_phone,
          orderId: order_id,
          orderNumber: order_number,
          occurredAt: occurred_at,
          category,
          description,
          priority,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('CRM_LOG_COMPLAINT_FAILED', JSON.stringify(result.error));
      return mcpSuccess({ complaint_id: result.value.id });
    },
  },
  {
    name: 'crm.list_complaints',
    schema: CRMListComplaintsSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CRMListComplaintsSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));

      const permitted = await checkPermission(ctx, 'crm.listComplaints', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.listComplaints');

      const { listComplaints } = await import('@erp/services/crm');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await listComplaints(
        {
          status: parsed.data.status,
          from: parsed.data.from,
          to: parsed.data.to,
          limit: parsed.data.limit,
        },
        auditCtx,
      );
      if (!result.ok) return mcpError('CRM_LIST_COMPLAINTS_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'crm.resolve_complaint',
    schema: CRMResolveComplaintSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = CRMResolveComplaintSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { complaint_id, status, resolution_notes } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.resolveComplaint', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.resolveComplaint');

      const { resolveComplaint } = await import('@erp/services/crm');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await resolveComplaint(
        { complaintId: complaint_id, status, resolutionNotes: resolution_notes },
        auditCtx,
      );
      if (!result.ok) return mcpError('CRM_RESOLVE_COMPLAINT_FAILED', JSON.stringify(result.error));
      return mcpSuccess({ status });
    },
  },
] as const;

// --- Member / Loyalty (MCP for CRM/Member module) ---

export const MemberGetLoyaltySchema = z.object({
  member_id: z.string(),
});

export const MemberGetVouchersSchema = z.object({
  member_id: z.string(),
  unused_only: z.boolean().optional().default(true),
});

export const MemberRedeemPointsSchema = z.object({
  member_id: z.string(),
  points_to_redeem: z.number().positive(),
  voucher_kind: z.enum(['discount_percent', 'discount_fixed', 'free_delivery']),
  voucher_value: z.number().positive(),
});

export const memberTools = [
  {
    name: 'member.get_loyalty',
    schema: MemberGetLoyaltySchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = MemberGetLoyaltySchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { member_id } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.view', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.view');

      const { getMemberLoyalty } = await import('@erp/services/member');
      const result = await getMemberLoyalty(member_id);
      if (!result.ok) return mcpError('MEMBER_GET_LOYALTY_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'member.get_vouchers',
    schema: MemberGetVouchersSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = MemberGetVouchersSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { member_id, unused_only } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.view', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.view');

      const { getMemberVouchers } = await import('@erp/services/member');
      const result = await getMemberVouchers(member_id, { unusedOnly: unused_only });
      if (!result.ok) return mcpError('MEMBER_GET_VOUCHERS_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
  },
  {
    name: 'member.redeem_points',
    schema: MemberRedeemPointsSchema,
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = MemberRedeemPointsSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { member_id, points_to_redeem, voucher_kind, voucher_value } = parsed.data;

      const permitted = await checkPermission(ctx, 'crm.manage_members', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: crm.manage_members');

      const { redeemPoints } = await import('@erp/services/member');
      const auditCtx = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        locationId: ctx.locationId ?? '',
      };
      const result = await redeemPoints(
        member_id,
        points_to_redeem,
        voucher_kind,
        voucher_value,
        auditCtx,
      );
      if (!result.ok) return mcpError('MEMBER_REDEEM_POINTS_FAILED', JSON.stringify(result.error));
      return mcpSuccess(result.value);
    },
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
    handler: async (input: unknown, ctx: McpContext) => {
      const parsed = AuditSearchSchema.safeParse(input);
      if (!parsed.success) return mcpError('INVALID_INPUT', String(parsed.error.issues));
      const { entity_type, entity_id, actor, from, to, limit, cursor } = parsed.data;

      const permitted = await checkPermission(ctx, 'audit.read', ctx.locationId);
      if (!permitted) return mcpError('FORBIDDEN', 'Permission denied: audit.read');

      const { db } = await import('@erp/db');
      const { auditLog } = await import('@erp/db/schema/audit');
      const { and, eq, gte, lte, desc, sql } = await import('drizzle-orm');

      const conditions = [eq(auditLog.tenantId, ctx.tenantId)];
      if (entity_type) conditions.push(eq(auditLog.entityType, entity_type));
      if (entity_id) conditions.push(eq(auditLog.entityId, entity_id));
      if (actor) conditions.push(eq(auditLog.userId, actor));
      if (from) conditions.push(gte(auditLog.createdAt, new Date(from)));
      if (to) conditions.push(lte(auditLog.createdAt, new Date(to)));

      const pageLimit = (limit ?? 50) + 1;
      const rows = await db
        .select()
        .from(auditLog)
        .where(and(...conditions))
        .orderBy(desc(auditLog.createdAt))
        .limit(pageLimit);

      const hasMore = rows.length > (limit ?? 50);
      const items = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor =
        hasMore && items.length > 0 ? (items[items.length - 1]?.id as string) : undefined;
      return mcpSuccess({ items, nextCursor: nextCursor ?? undefined });
    },
  },
] as const;
