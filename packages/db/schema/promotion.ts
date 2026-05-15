/**
 * Promotions schema.
 *
 * Rule-based POS promotions and complimentary/free-item programs. Rules live in
 * JSON so new campaign mechanics can be configured from the ERP UI.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol, versionCol } from './common';

export type PromotionKind =
  | 'percent_discount'
  | 'fixed_discount'
  | 'buy_x_get_y'
  | 'free_item'
  | 'complimentary';

export type PromotionStatus = 'draft' | 'active' | 'paused' | 'expired';

export interface PromotionConditionConfig {
  minSubtotal?: string;
  requiredProductIds?: string[];
  requiredCategoryIds?: string[];
  minQty?: number;
  channelIds?: string[];
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  memberOnly?: boolean;
}

export interface PromotionBenefitConfig {
  percentBps?: number;
  amount?: string;
  appliesTo?: 'order' | 'matching_lines';
  maxDiscountAmount?: string;
  buyProductId?: string;
  buyQty?: number;
  getProductId?: string;
  getVariantId?: string;
  getQty?: number;
  discountBps?: number;
  requiresReason?: boolean;
  expenseAccountCode?: string;
}

export const promotions = pgTable(
  'promotions',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(),
    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    kind: text('kind').notNull().$type<PromotionKind>(),
    status: text('status').notNull().default('draft').$type<PromotionStatus>(),
    priority: integer('priority').notNull().default(100),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    locationScopeJson: jsonb('location_scope_json').notNull().$type<string[]>().default([]),
    channelScopeJson: jsonb('channel_scope_json').notNull().$type<string[]>().default([]),
    conditionsJson: jsonb('conditions_json')
      .notNull()
      .$type<PromotionConditionConfig>()
      .default({}),
    benefitsJson: jsonb('benefits_json').notNull().$type<PromotionBenefitConfig>().default({}),
    stackable: boolean('stackable').notNull().default(false),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    usageLimit: integer('usage_limit'),
    usageCount: integer('usage_count').notNull().default(0),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('promotions_tenant_code_idx').on(t.tenantId, t.code),
    index('promotions_tenant_status_idx').on(t.tenantId, t.status),
    index('promotions_active_window_idx').on(t.startsAt, t.endsAt),
  ],
);

export const promotionApplications = pgTable(
  'promotion_applications',
  {
    ...pk,
    ...tenantCol,
    promotionId: text('promotion_id').notNull(),
    salesOrderId: text('sales_order_id').notNull(),
    lineId: text('line_id'),
    benefitType: text('benefit_type').notNull(),
    discountAmount: text('discount_amount').notNull().default('0'),
    freeProductId: text('free_product_id'),
    freeVariantId: text('free_variant_id'),
    freeQty: integer('free_qty').notNull().default(0),
    reason: text('reason'),
    approvedBy: text('approved_by'),
    ...auditCols,
  },
  (t) => [
    index('promotion_applications_promo_idx').on(t.promotionId),
    index('promotion_applications_sale_idx').on(t.salesOrderId),
    index('promotion_applications_tenant_idx').on(t.tenantId),
  ],
);
