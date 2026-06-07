/**
 * HPP (Harga Pokok Penjualan) periodic adjustment posting.
 *
 * At month-end after stock opname, the accountant reviews inventory
 * variances by HPP category and posts adjustment journal entries:
 *
 * - hpp items:            DR HPP (6-1110) / CR Persediaan Bahan Baku (1-1210)
 * - supply_expense items: DR Beban Perlengkapan (6-2100) / CR Perlengkapan (1-1220)
 *
 * The adjustment amount = book value (GL balance) - physical value (qty × avgUnitCost).
 * Positive adjustment = book > physical (expense recognized).
 * Negative adjustment = physical > book (reverse entry).
 */

import { and, db, eq, inArray, isNull, sql } from '@erp/db';
import { accounts, journalEntries } from '@erp/db/schema/accounting';
import { products, stockLevels } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { createJournal } from './create-journal';
import { postJournal } from './post-journal';
import { resolveAccountIdsByCodes } from './account-resolver';

// COA codes per the seeded chart of accounts (Appendix A).
const HPP_ACCOUNT_CODE = '5-0000'; // Harga Pokok Penjualan (COGS)
const RAW_MATERIAL_INVENTORY_CODE = '1-1600'; // Persediaan Barang Dagangan
const SUPPLY_EXPENSE_CODE = '6-2500'; // Beban Perlengkapan Toko
const SUPPLIES_INVENTORY_CODE = '1-1800'; // Perlengkapan Toko

export interface HppSummaryLine {
  productId: string;
  productName: string;
  sku: string;
  hppCategory: 'hpp' | 'supply_expense';
  uom: string;
  physicalQty: number;
  avgUnitCost: string;
  physicalValue: string;
}

export interface HppSummary {
  locationId: string;
  periodEnd: string;
  lines: HppSummaryLine[];
  totalHppValue: string;
  totalSupplyValue: string;
}

export async function getHppSummary(
  input: { locationId: string; periodEnd: string },
  ctx: AuditContext,
): Promise<Result<HppSummary>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.hpp.view', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const rows = await db
        .select({
          productId: products.id,
          productName: products.name,
          sku: products.sku,
          hppCategory: products.hppCategory,
          uom: products.uom,
          qtyOnHand: stockLevels.qtyOnHand,
          avgUnitCost: stockLevels.avgUnitCost,
        })
        .from(stockLevels)
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .where(
          and(
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, input.locationId),
            isNull(products.deletedAt),
            eq(products.isActive, true),
            sql`${products.hppCategory} IS NOT NULL`,
          ),
        )
        .orderBy(products.sku);

      let totalHpp = 0n;
      let totalSupply = 0n;
      const lines: HppSummaryLine[] = [];

      for (const row of rows) {
        const qty = Number.parseFloat(String(row.qtyOnHand));
        const cost = row.avgUnitCost ?? 0n;
        const value = BigInt(Math.round(qty)) * cost;

        if (row.hppCategory === 'hpp') totalHpp += value;
        else if (row.hppCategory === 'supply_expense') totalSupply += value;

        const nameObj = row.productName as { id?: string; en?: string } | null;
        lines.push({
          productId: row.productId,
          productName: nameObj?.id ?? nameObj?.en ?? row.sku,
          sku: row.sku,
          hppCategory: row.hppCategory as 'hpp' | 'supply_expense',
          uom: row.uom,
          physicalQty: qty,
          avgUnitCost: cost.toString(),
          physicalValue: value.toString(),
        });
      }

      return {
        locationId: input.locationId,
        periodEnd: input.periodEnd,
        lines,
        totalHppValue: totalHpp.toString(),
        totalSupplyValue: totalSupply.toString(),
      };
    },
    (e) => AppError.internal('accounting.hpp.summaryFailed', e),
  );
}

export async function postHppAdjustment(
  input: {
    locationId: string;
    periodEnd: string;
    hppAdjustmentAmount: string;
    supplyAdjustmentAmount: string;
    notes?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ journalEntryId: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.hpp.adjust', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const hppAmount = BigInt(input.hppAdjustmentAmount || '0');
      const supplyAmount = BigInt(input.supplyAdjustmentAmount || '0');
      if (hppAmount === 0n && supplyAmount === 0n) {
        throw AppError.validation('accounting.hpp.noAdjustment');
      }

      const neededCodes = [
        HPP_ACCOUNT_CODE,
        RAW_MATERIAL_INVENTORY_CODE,
        SUPPLY_EXPENSE_CODE,
        SUPPLIES_INVENTORY_CODE,
      ];
      const accountMap = await resolveAccountIdsByCodes(ctx.tenantId, neededCodes);

      const lines: Array<{
        accountId: string;
        description: string;
        debit: string;
        credit: string;
      }> = [];

      if (hppAmount !== 0n) {
        const hppAccountId = accountMap.get(HPP_ACCOUNT_CODE);
        const invAccountId = accountMap.get(RAW_MATERIAL_INVENTORY_CODE);
        if (!hppAccountId || !invAccountId) {
          throw AppError.internal('accounting.hpp.accountNotFound', {
            missing: !hppAccountId ? HPP_ACCOUNT_CODE : RAW_MATERIAL_INVENTORY_CODE,
          });
        }
        if (hppAmount > 0n) {
          lines.push(
            { accountId: hppAccountId, description: 'HPP penyesuaian persediaan', debit: hppAmount.toString(), credit: '0' },
            { accountId: invAccountId, description: 'Penyesuaian persediaan bahan baku', debit: '0', credit: hppAmount.toString() },
          );
        } else {
          const abs = -hppAmount;
          lines.push(
            { accountId: invAccountId, description: 'Penyesuaian persediaan bahan baku', debit: abs.toString(), credit: '0' },
            { accountId: hppAccountId, description: 'HPP penyesuaian persediaan', debit: '0', credit: abs.toString() },
          );
        }
      }

      if (supplyAmount !== 0n) {
        const supExpId = accountMap.get(SUPPLY_EXPENSE_CODE);
        const supInvId = accountMap.get(SUPPLIES_INVENTORY_CODE);
        if (!supExpId || !supInvId) {
          throw AppError.internal('accounting.hpp.accountNotFound', {
            missing: !supExpId ? SUPPLY_EXPENSE_CODE : SUPPLIES_INVENTORY_CODE,
          });
        }
        if (supplyAmount > 0n) {
          lines.push(
            { accountId: supExpId, description: 'Beban perlengkapan penyesuaian', debit: supplyAmount.toString(), credit: '0' },
            { accountId: supInvId, description: 'Penyesuaian perlengkapan', debit: '0', credit: supplyAmount.toString() },
          );
        } else {
          const abs = -supplyAmount;
          lines.push(
            { accountId: supInvId, description: 'Penyesuaian perlengkapan', debit: abs.toString(), credit: '0' },
            { accountId: supExpId, description: 'Beban perlengkapan penyesuaian', debit: '0', credit: abs.toString() },
          );
        }
      }

      const result = await createJournal(
        {
          locationId: input.locationId,
          description: `Penyesuaian HPP & Perlengkapan akhir periode ${input.periodEnd}`,
          postingDate: input.periodEnd,
          referenceType: 'manual',
          referenceId: `HPP-ADJ-${input.periodEnd}`,
          lines: lines.map((l) => ({ ...l, locationId: input.locationId })),
          idempotencyKey: `hpp-adj-${input.locationId}-${input.periodEnd}`,
        },
        ctx,
        { skipPermissionCheck: true },
      );

      if (!result.ok) throw result.error;

      // createJournal produces a draft; post it to the ledger immediately.
      const posted = await postJournal({ journalId: result.value.id }, ctx, {
        skipPermissionCheck: true,
      });
      if (!posted.ok) throw posted.error;

      await auditRecord({
        action: 'create',
        entityType: 'hpp_adjustment',
        entityId: result.value.id,
        before: null,
        after: {
          locationId: input.locationId,
          periodEnd: input.periodEnd,
          hppAmount: input.hppAdjustmentAmount,
          supplyAmount: input.supplyAdjustmentAmount,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { journalEntryId: result.value.id };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.hpp.postingFailed', e);
    },
  );
}
