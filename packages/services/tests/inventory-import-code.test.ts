import { describe, expect, it } from 'vitest';
import {
  normalizeInventoryImportCode,
  variantMatchesImportCode,
} from '../src/inventory/import-service';

describe('inventory movement import code matching', () => {
  it('normalizes manager spreadsheet codes with inconsistent spacing', () => {
    expect(normalizeInventoryImportCode('  JGFT -  LC ')).toBe('JGFT - LC');
  });

  it('matches either internal variant SKU or manager inventory code', () => {
    const variant = {
      sku: 'FT-JAS-LARGE-COLD',
      attributes: {
        managerInventoryCode: 'JGFT -  LC',
        managerInventoryAliases: 'JGFT - LC',
      },
    };

    expect(variantMatchesImportCode('FT-JAS-LARGE-COLD', variant)).toBe(true);
    expect(variantMatchesImportCode('JGFT - LC', variant)).toBe(true);
    expect(variantMatchesImportCode('JGFT -  LC', variant)).toBe(true);
    expect(variantMatchesImportCode('JGFT - LH', variant)).toBe(false);
  });
});
