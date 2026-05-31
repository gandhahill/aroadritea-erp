/**
 * tax.listRates — SD §19.1
 *
 * Query tax rates from the database, optionally filtered by
 * active status and effective date.
 *
 * Permission: tax.view (read-only)
 */

import { db } from '@erp/db';
import { taxRates } from '@erp/db/schema/accounting';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

// --- Return type ---

export interface TaxRateResult {
  id: string;
  code: string;
  name: Record<string, string>;
  rateBps: number;
  /** Percentage representation for display (e.g., 10 for 10%). */
  ratePercent: number;
  calculation: string;
  postingAccountId: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

// --- Service functions ---

/**
 * List all tax rates, optionally filtered.
 *
 * @param options - Filter options
 * @param ctx - Audit context
 */
export async function listRates(
  options: {
    activeOnly?: boolean;
    effectiveDate?: string; // YYYY-MM-DD — filter rates effective on this date
  },
  ctx: AuditContext,
): Promise<Result<TaxRateResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'tax.view');
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      // Build conditions
      const conditions = [eq(taxRates.tenantId, ctx.tenantId)];

      if (options.activeOnly !== false) {
        conditions.push(eq(taxRates.isActive, true));
      }

      if (options.effectiveDate) {
        conditions.push(lte(taxRates.effectiveFrom, options.effectiveDate));
        conditions.push(
          or(
            isNull(taxRates.effectiveUntil),
            sql`${taxRates.effectiveUntil} >= ${options.effectiveDate}`,
          )!,
        );
      }

      const rows = await db
        .select()
        .from(taxRates)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return rows.map(
        (row): TaxRateResult => ({
          id: row.id,
          code: row.code,
          name: row.name as Record<string, string>,
          rateBps: row.rateBps,
          ratePercent: row.rateBps / 100,
          calculation: row.calculation,
          postingAccountId: row.postingAccountId,
          isActive: row.isActive,
          effectiveFrom: row.effectiveFrom,
          effectiveUntil: row.effectiveUntil,
        }),
      );
    },
    (e) => AppError.internal('tax.listRates.failed', e),
  );
}

/**
 * Get a single tax rate by code.
 */
export async function getRateByCode(
  code: string,
  ctx: AuditContext,
): Promise<Result<TaxRateResult>> {
  const permCheck = await requirePermission(ctx.userId, 'tax.view');
  if (!permCheck.ok) return permCheck;

  const row = await db
    .select()
    .from(taxRates)
    .where(and(eq(taxRates.tenantId, ctx.tenantId), eq(taxRates.code, code)))
    .then((rows) => rows[0]);

  if (!row) {
    return err(AppError.notFound('tax.rate.notFound', { code }));
  }

  return ok({
    id: row.id,
    code: row.code,
    name: row.name as Record<string, string>,
    rateBps: row.rateBps,
    ratePercent: row.rateBps / 100,
    calculation: row.calculation,
    postingAccountId: row.postingAccountId,
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
  });
}
