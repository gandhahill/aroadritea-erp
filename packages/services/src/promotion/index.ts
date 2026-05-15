import { auditLog, db, promotions } from '@erp/db';
import type {
  PromotionBenefitConfig,
  PromotionConditionConfig,
  PromotionKind,
  PromotionStatus,
} from '@erp/db/schema/promotion';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';

const LocaleNameSchema = z.object({
  id: z.string().min(1).max(160),
  en: z.string().min(1).max(160),
  zh: z.string().min(1).max(160),
});

const PromotionKindSchema = z.enum([
  'percent_discount',
  'fixed_discount',
  'buy_x_get_y',
  'free_item',
  'complimentary',
]);

const PromotionStatusSchema = z.enum(['draft', 'active', 'paused', 'expired']);

const TokenArraySchema = z.array(z.string().trim().min(1).max(80)).default([]);

export const UpsertPromotionInputSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: LocaleNameSchema,
  kind: PromotionKindSchema,
  status: PromotionStatusSchema,
  priority: z.number().int().min(0).max(9999).default(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  locationScope: TokenArraySchema,
  channelScope: TokenArraySchema,
  conditions: z
    .object({
      minSubtotal: z.string().regex(/^\d+$/).optional(),
      requiredProductIds: TokenArraySchema.optional(),
      requiredCategoryIds: TokenArraySchema.optional(),
      minQty: z.number().int().positive().optional(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      startTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      endTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      memberOnly: z.boolean().optional(),
    })
    .default({}),
  benefits: z
    .object({
      percentBps: z.number().int().min(0).max(10000).optional(),
      amount: z.string().regex(/^\d+$/).optional(),
      appliesTo: z.enum(['order', 'matching_lines']).optional(),
      maxDiscountAmount: z.string().regex(/^\d+$/).optional(),
      buyProductId: z.string().optional(),
      buyQty: z.number().int().positive().optional(),
      getProductId: z.string().optional(),
      getVariantId: z.string().optional(),
      getQty: z.number().int().positive().optional(),
      discountBps: z.number().int().min(0).max(10000).optional(),
      requiresReason: z.boolean().optional(),
      expenseAccountCode: z.string().optional(),
    })
    .default({}),
  stackable: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  usageLimit: z.number().int().positive().optional().nullable(),
});

export type UpsertPromotionInput = z.infer<typeof UpsertPromotionInputSchema>;

export interface PromotionListItem {
  id: string;
  code: string;
  name: { id: string; en: string; zh: string };
  kind: PromotionKind;
  status: PromotionStatus;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  locationScope: string[];
  channelScope: string[];
  conditions: PromotionConditionConfig;
  benefits: PromotionBenefitConfig;
  stackable: boolean;
  requiresApproval: boolean;
  usageLimit: number | null;
  usageCount: number;
  updatedAt: string;
}

function toPromotionListItem(row: typeof promotions.$inferSelect): PromotionListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    locationScope: row.locationScopeJson,
    channelScope: row.channelScopeJson,
    conditions: row.conditionsJson,
    benefits: row.benefitsJson,
    stackable: row.stackable,
    requiresApproval: row.requiresApproval,
    usageLimit: row.usageLimit,
    usageCount: row.usageCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function canManagePromotions(ctx: AuditContext): Promise<Result<void>> {
  const manage = await requirePermission(ctx.userId, 'promotion.manage');
  if (manage.ok) return ok(undefined);
  const settings = await requirePermission(ctx.userId, 'settings.manage');
  return settings.ok ? ok(undefined) : manage;
}

async function canViewPromotions(ctx: AuditContext): Promise<Result<void>> {
  const view = await requirePermission(ctx.userId, 'promotion.view');
  if (view.ok) return ok(undefined);
  return canManagePromotions(ctx);
}

export async function listPromotions(ctx: AuditContext): Promise<Result<PromotionListItem[]>> {
  const permission = await canViewPromotions(ctx);
  if (!permission.ok) return permission;

  const rows = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.tenantId, ctx.tenantId), isNull(promotions.deletedAt)))
    .orderBy(desc(promotions.updatedAt));

  return ok(rows.map(toPromotionListItem));
}

export async function upsertPromotion(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<PromotionListItem>> {
  const permission = await canManagePromotions(ctx);
  if (!permission.ok) return permission;

  const parsed = UpsertPromotionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('promotion.upsert.validationFailed', parsed.error.flatten()));
  }

  const data = parsed.data;
  const now = new Date();
  const startsAt = new Date(data.startsAt);
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    return err(AppError.businessRule('promotion.upsert.invalidDateRange'));
  }

  const values = {
    tenantId: ctx.tenantId,
    code: data.code.trim().toUpperCase(),
    name: data.name,
    kind: data.kind,
    status: data.status,
    priority: data.priority,
    startsAt,
    endsAt,
    locationScopeJson: data.locationScope,
    channelScopeJson: data.channelScope,
    conditionsJson: data.conditions,
    benefitsJson: data.benefits,
    stackable: data.stackable,
    requiresApproval: data.requiresApproval,
    usageLimit: data.usageLimit ?? null,
    updatedAt: now,
    updatedBy: ctx.userId,
  };

  if (data.id) {
    const [before] = await db
      .select()
      .from(promotions)
      .where(and(eq(promotions.tenantId, ctx.tenantId), eq(promotions.id, data.id)))
      .limit(1);
    if (!before || before.deletedAt) {
      return err(AppError.notFound('promotion.upsert.notFound', { id: data.id }));
    }

    const [updated] = await db
      .update(promotions)
      .set(values)
      .where(and(eq(promotions.tenantId, ctx.tenantId), eq(promotions.id, data.id)))
      .returning();
    if (!updated) return err(AppError.internal('promotion.upsert.updateFailed'));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'promotion',
      entityId: data.id,
      before,
      after: updated,
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok(toPromotionListItem(updated));
  }

  const [duplicate] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(
      and(
        eq(promotions.tenantId, ctx.tenantId),
        eq(promotions.code, values.code),
        isNull(promotions.deletedAt),
      ),
    )
    .limit(1);
  if (duplicate)
    return err(AppError.conflict('promotion.upsert.codeExists', { code: values.code }));

  const [created] = await db
    .insert(promotions)
    .values({
      id: generateId(),
      ...values,
      createdAt: now,
      createdBy: ctx.userId,
    })
    .returning();
  if (!created) return err(AppError.internal('promotion.upsert.createFailed'));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'create',
    entityType: 'promotion',
    entityId: created.id,
    before: null,
    after: created,
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
  });

  return ok(toPromotionListItem(created));
}

export async function listActivePromotionsForSale(params: {
  tenantId: string;
  locationId: string;
  channel: string;
  now?: Date;
}): Promise<PromotionListItem[]> {
  const now = params.now ?? new Date();
  const rows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.tenantId, params.tenantId),
        eq(promotions.status, 'active'),
        isNull(promotions.deletedAt),
      ),
    );

  return rows
    .filter((row) => row.startsAt <= now && (!row.endsAt || row.endsAt >= now))
    .filter(
      (row) =>
        row.locationScopeJson.length === 0 || row.locationScopeJson.includes(params.locationId),
    )
    .filter(
      (row) => row.channelScopeJson.length === 0 || row.channelScopeJson.includes(params.channel),
    )
    .sort((a, b) => a.priority - b.priority)
    .map(toPromotionListItem);
}
