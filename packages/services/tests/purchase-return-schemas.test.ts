/**
 * Schema-level tests for purchase returns — T-0180.
 *
 * Validates the Zod input shape only; full happy-path integration
 * with `createJournal` + stock movements is exercised via the live
 * outlet smoke once DB seed includes the new permissions.
 */

import { describe, expect, it } from 'vitest';
import {
  CreatePurchaseReturnInputSchema,
  PurchaseReturnLineInputSchema,
} from '../src/purchasing/return-schemas';

describe('PurchaseReturnLineInputSchema', () => {
  it('accepts a valid line with all fields', () => {
    const result = PurchaseReturnLineInputSchema.safeParse({
      grnLineId: 'grnl-1',
      productId: 'prod-1',
      variantId: 'var-1',
      qtyReturned: '2.500',
      uom: 'kg',
      unitCost: '15000',
      taxCode: 'PB1_10',
      notes: 'broken on arrival',
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero qty', () => {
    const result = PurchaseReturnLineInputSchema.safeParse({
      grnLineId: 'grnl-1',
      productId: 'prod-1',
      qtyReturned: '0',
      uom: 'kg',
      unitCost: '15000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative qty', () => {
    const result = PurchaseReturnLineInputSchema.safeParse({
      grnLineId: 'grnl-1',
      productId: 'prod-1',
      qtyReturned: '-1',
      uom: 'kg',
      unitCost: '15000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric unit cost', () => {
    const result = PurchaseReturnLineInputSchema.safeParse({
      grnLineId: 'grnl-1',
      productId: 'prod-1',
      qtyReturned: '1',
      uom: 'kg',
      unitCost: '15.50',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreatePurchaseReturnInputSchema', () => {
  const baseLine = {
    grnLineId: 'grnl-1',
    productId: 'prod-1',
    qtyReturned: '1',
    uom: 'kg',
    unitCost: '15000',
  };

  it('accepts a minimum-valid return', () => {
    const result = CreatePurchaseReturnInputSchema.safeParse({
      locationId: 'loc-1',
      grnId: 'grn-1',
      supplierId: 'sup-1',
      returnDate: '2026-05-25',
      reason: 'broken',
      lines: [baseLine],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty lines', () => {
    const result = CreatePurchaseReturnInputSchema.safeParse({
      locationId: 'loc-1',
      grnId: 'grn-1',
      supplierId: 'sup-1',
      returnDate: '2026-05-25',
      reason: 'broken',
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects bad date format', () => {
    const result = CreatePurchaseReturnInputSchema.safeParse({
      locationId: 'loc-1',
      grnId: 'grn-1',
      supplierId: 'sup-1',
      returnDate: '25/05/2026',
      reason: 'broken',
      lines: [baseLine],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a too-short reason', () => {
    const result = CreatePurchaseReturnInputSchema.safeParse({
      locationId: 'loc-1',
      grnId: 'grn-1',
      supplierId: 'sup-1',
      returnDate: '2026-05-25',
      reason: 'a',
      lines: [baseLine],
    });
    expect(result.success).toBe(false);
  });
});
