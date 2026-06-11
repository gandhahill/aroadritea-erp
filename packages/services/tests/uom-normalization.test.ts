/**
 * T-0295 — stock UOM normalization (follow-up of the 2026-06-11 MLI incident
 * where stock_levels rows in a foreign unit broke POS ingredient deduction).
 *
 * toProductUom is the guard used by every stock_levels write path (GRN,
 * adjustment, transfer, opname, import): a line qty entered in a unit other
 * than products.uom must be converted via uom_conversions or rejected.
 */
import { AppError } from '@erp/shared/errors';
import { err, ok } from '@erp/shared/result';
import { describe, expect, it } from 'vitest';
import {
  normalizeUom,
  scaleUnitCostToProductUom,
  toProductUom,
} from '../src/inventory/uom-service';

const noConversion = async () =>
  err(AppError.businessRule('inventory.errors.no_uom_conversion', {}));

describe('normalizeUom', () => {
  it('treats case and surrounding whitespace as insignificant', () => {
    expect(normalizeUom(' ML ')).toBe('ml');
    expect(normalizeUom('Pcs')).toBe('pcs');
  });
});

describe('toProductUom', () => {
  const product = { id: 'prod-1', uom: 'cup' };

  it('passes the qty through verbatim when units already match', async () => {
    const result = await toProductUom('t1', product, '5', 'cup', noConversion);
    expect(result).toEqual(ok({ qty: '5', uom: 'cup', factor: 1 }));
  });

  it('matches units case- and whitespace-insensitively (GK500 regression)', async () => {
    const result = await toProductUom('t1', product, '1254.000', ' CUP ', noConversion);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uom).toBe('cup'); // always the master uom verbatim
      expect(result.value.qty).toBe('1254.000');
      expect(result.value.factor).toBe(1);
    }
  });

  it('converts the qty when a uom_conversions row exists', async () => {
    // 1 pack = 25 pcs
    const convert = async (_t: string, qty: number) => ok(qty * 25);
    const result = await toProductUom(
      't1',
      { id: 'prod-2', uom: 'pcs' },
      '2',
      'pack',
      convert as never,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ qty: '50.000', uom: 'pcs', factor: 25 });
    }
  });

  it('rejects a foreign unit without a registered conversion', async () => {
    const result = await toProductUom('t1', product, '5', 'pcs', noConversion);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('inventory.errors.stock_uom_mismatch');
      expect(result.error.details).toEqual({
        productId: 'prod-1',
        inputUom: 'pcs',
        productUom: 'cup',
      });
    }
  });

  it('rejects a non-numeric qty', async () => {
    const result = await toProductUom('t1', product, 'abc', 'cup', noConversion);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.messageKey).toBe('inventory.errors.invalid_qty');
    }
  });

  it('derives the factor from a unit conversion for zero quantities', async () => {
    const convert = async (_t: string, qty: number) => ok(qty * 25);
    const result = await toProductUom(
      't1',
      { id: 'prod-2', uom: 'pcs' },
      '0',
      'pack',
      convert as never,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.qty).toBe('0.000');
      expect(result.value.factor).toBe(25);
    }
  });
});

describe('scaleUnitCostToProductUom', () => {
  it('keeps the cost unchanged when no conversion happened', () => {
    expect(scaleUnitCostToProductUom(25000n, 1)).toBe(25000n);
  });

  it('divides the per-unit cost by the conversion factor', () => {
    // Rp25.000/pack, 1 pack = 25 pcs → Rp1.000/pcs
    expect(scaleUnitCostToProductUom(25000n, 25)).toBe(1000n);
  });

  it('rounds to the nearest rupiah', () => {
    expect(scaleUnitCostToProductUom(10000n, 3)).toBe(3333n);
  });

  it('guards against a zero factor', () => {
    expect(scaleUnitCostToProductUom(10000n, 0)).toBe(10000n);
  });
});
