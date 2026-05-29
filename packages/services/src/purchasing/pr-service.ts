import { db } from '@erp/db';
import { purchaseRequisitions, purchaseRequisitionLines, rfqs, rfqLines } from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  CreatePurchaseRequisitionInputSchema,
  CreateRFQInputSchema,
  PRIdInputSchema,
} from './pr-schemas';

async function generatePRNumber(tenantId: string, requestDate: string): Promise<string> {
  const prefix = \`PRQ-\${requestDate.substring(0, 7)}-\`;

  const result = await db
    .select({ count: sql<number>\`count(*)\` })
    .from(purchaseRequisitions)
    .where(
      and(
        eq(purchaseRequisitions.tenantId, tenantId),
        sql\`\${purchaseRequisitions.number} LIKE \${prefix + '%'}\`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');
  return \`\${prefix}\${nextSeq}\`;
}

async function generateRFQNumber(tenantId: string, rfqDate: string): Promise<string> {
  const prefix = \`RFQ-\${rfqDate.substring(0, 7)}-\`;

  const result = await db
    .select({ count: sql<number>\`count(*)\` })
    .from(rfqs)
    .where(
      and(
        eq(rfqs.tenantId, tenantId),
        sql\`\${rfqs.number} LIKE \${prefix + '%'}\`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');
  return \`\${prefix}\${nextSeq}\`;
}

export async function createPurchaseRequisition(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; number: string }>> {
  const parsed = CreatePurchaseRequisitionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input', { detail: parsed.error.message }));
  }
  const input = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: input.locationId,
  }); // Using PO create perm as fallback if PR perm doesn't exist
  if (!permCheck.ok) return permCheck;

  const number = await generatePRNumber(ctx.tenantId, input.requestDate);
  const prId = generateId();

  await db.insert(purchaseRequisitions).values({
    id: prId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number,
    requestDate: input.requestDate,
    requestedBy: ctx.userId,
    status: 'draft',
    notes: input.notes ?? null,
    version: 1,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  const lineValues = input.lines.map((line, idx) => ({
    id: generateId(),
    prId,
    lineNo: idx + 1,
    productId: line.productId,
    variantId: line.variantId ?? null,
    qtyRequested: line.qtyRequested,
    uom: line.uom,
    notes: line.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db.insert(purchaseRequisitionLines).values(lineValues);

  await auditRecord({
    action: 'create',
    entityType: 'purchase_requisition',
    entityId: prId,
    before: null,
    after: { number, status: 'draft', lineCount: lineValues.length },
    ctx,
  });

  return ok({ id: prId, number });
}

export async function submitPurchaseRequisition(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PRIdInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(AppError.validation('invalid input'));
  
  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, parsed.data.prId)).limit(1);
  if (!pr || pr.status !== 'draft') return err(AppError.businessRule('invalid state'));

  await db.update(purchaseRequisitions).set({ status: 'submitted', submittedBy: ctx.userId, submittedAt: new Date() }).where(eq(purchaseRequisitions.id, pr.id));
  return ok({ id: pr.id, status: 'submitted' });
}

export async function approvePurchaseRequisition(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PRIdInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(AppError.validation('invalid input'));
  
  const [pr] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, parsed.data.prId)).limit(1);
  if (!pr || pr.status !== 'submitted') return err(AppError.businessRule('invalid state'));

  await db.update(purchaseRequisitions).set({ status: 'approved', approvedBy: ctx.userId, approvedAt: new Date() }).where(eq(purchaseRequisitions.id, pr.id));
  return ok({ id: pr.id, status: 'approved' });
}

export async function createRFQ(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; number: string }>> {
  const parsed = CreateRFQInputSchema.safeParse(rawInput);
  if (!parsed.success) return err(AppError.validation('purchasing.errors.invalid_input', { detail: parsed.error.message }));
  
  const input = parsed.data;

  const number = await generateRFQNumber(ctx.tenantId, input.rfqDate);
  const rfqId = generateId();

  await db.insert(rfqs).values({
    id: rfqId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number,
    prId: input.prId ?? null,
    rfqDate: input.rfqDate,
    deadlineDate: input.deadlineDate,
    notes: input.notes ?? null,
    status: 'draft',
    version: 1,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  const lineValues = input.lines.map((line, idx) => ({
    id: generateId(),
    rfqId,
    lineNo: idx + 1,
    productId: line.productId,
    variantId: line.variantId ?? null,
    qty: line.qty,
    uom: line.uom,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db.insert(rfqLines).values(lineValues);

  return ok({ id: rfqId, number });
}
