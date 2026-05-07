/**
 * tax.resolve — SD §19.3.3
 *
 * Resolves which tax codes apply to a given transaction context.
 * Algorithm:
 *   1. Fetch all tax_rules effective on the given date.
 *   2. Filter by scope match (channel, customer_segment, product_category, global_default).
 *   3. For each tax_code, pick the rule with highest priority where is_applied_default=true.
 *   4. Return resolved tax info (code, rate, calculation, posting account).
 *
 * Permission: accounting.view
 */

import { eq, and, lte, or, isNull, sql } from 'drizzle-orm';
import { db } from '@erp/db';
import { taxRules } from '@erp/db/schema/accounting';
import { taxRates } from '@erp/db/schema/accounting';
import { type Result, ok, err, tryCatch } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

// --- Types ---

export type TaxResolutionContext = {
  /** Sales channel: 'walk_in' | 'gofood' | 'grabfood' | 'shopeefood' | etc. */
  channel?: string;
  /** Customer ID — used to resolve customer_segment rules. */
  customerId?: string;
  /** Product category ID — for product-specific tax rules. */
  productCategoryId?: string;
  /** Document kind: determines which rules apply. */
  documentKind: 'sales' | 'purchase';
  /** Date for effective check (defaults to today). */
  effectiveDate?: string; // YYYY-MM-DD
};

export interface ResolvedTax {
  taxCode: string;
  rateBps: number;
  ratePercent: number;
  calculation: string; // 'inclusive' | 'exclusive'
  postingAccountId: string;
}

// --- Service function ---

/**
 * Resolve applicable taxes for a transaction context.
 * Per SD §19.3.3:
 *   1. Get all effective tax_rules.
 *   2. Filter by scope match.
 *   3. For each tax_code, pick highest priority with is_applied_default=true.
 *   4. Join with tax_rates for rate details.
 */
export async function resolve(
  context: TaxResolutionContext,
  ctx: AuditContext,
): Promise<Result<ResolvedTax[]>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.view');
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const today = context.effectiveDate ?? new Date().toISOString().slice(0, 10);

      // Step 1: Fetch all effective rules for this tenant
      const effectiveRules = await db
        .select()
        .from(taxRules)
        .where(
          and(
            eq(taxRules.tenantId, ctx.tenantId),
            lte(taxRules.effectiveFrom, today),
            or(
              isNull(taxRules.effectiveUntil),
              sql`${taxRules.effectiveUntil} >= ${today}`,
            ),
          ),
        );

      // Step 2: Filter by scope match
      const matchingRules = effectiveRules.filter((rule) => {
        switch (rule.scopeKind) {
          case 'channel':
            return context.channel != null && rule.scopeId === context.channel;
          case 'customer_segment':
            // Future: resolve customer → segment lookup
            // For now, only match if scopeId equals customerId (placeholder)
            return context.customerId != null && rule.scopeId === context.customerId;
          case 'product_category':
            return context.productCategoryId != null && rule.scopeId === context.productCategoryId;
          case 'global_default':
            return true; // always matches
          default:
            return false;
        }
      });

      // Step 3: For each tax_code, pick highest priority with is_applied_default=true
      const bestByCode = new Map<string, typeof matchingRules[number]>();
      for (const rule of matchingRules) {
        if (!rule.isAppliedDefault) continue;
        const existing = bestByCode.get(rule.taxCode);
        if (!existing || rule.priority > existing.priority) {
          bestByCode.set(rule.taxCode, rule);
        }
      }

      if (bestByCode.size === 0) {
        return [];
      }

      // Step 4: Join with tax_rates for rate details
      const taxCodes = Array.from(bestByCode.keys());
      const rates = await db
        .select()
        .from(taxRates)
        .where(
          and(
            sql`${taxRates.code} IN (${sql.join(taxCodes.map(c => sql`${c}`), sql`, `)})`,
            eq(taxRates.isActive, true),
          ),
        );

      const rateMap = new Map(rates.map((r) => [r.code, r]));

      const resolved: ResolvedTax[] = [];
      for (const [taxCode] of bestByCode) {
        const rate = rateMap.get(taxCode);
        if (!rate) continue; // rate deactivated or not found — skip silently
        resolved.push({
          taxCode: rate.code,
          rateBps: rate.rateBps,
          ratePercent: rate.rateBps / 100,
          calculation: rate.calculation,
          postingAccountId: rate.postingAccountId,
        });
      }

      return resolved;
    },
    (e) => AppError.internal('tax.resolve.failed', e),
  );
}
