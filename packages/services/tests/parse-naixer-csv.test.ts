/**
 * Tests for Naixer CSV parsing — T-0083
 */

import { describe, expect, it } from 'vitest';
import { parseModifierCodesCsv, parseProductCodesCsv } from '../src/kitchen/parse-naixer-csv';

// ─── Product codes CSV ──────────────────────────────────────────────────────

describe('parseProductCodesCsv', () => {
  it('parses valid CSV with product_id and naixer_code', () => {
    const csv = `product_id,naixer_code
abc-123,T003
def-456,T004`;
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      { productId: 'abc-123', variantId: null, naixerCode: 'T003' },
      { productId: 'def-456', variantId: null, naixerCode: 'T004' },
    ]);
  });

  it('parses CSV with variant_id column', () => {
    const csv = `product_id,variant_id,naixer_code
abc-123,,T003
abc-123,var-001,T003A`;
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      { productId: 'abc-123', variantId: null, naixerCode: 'T003' },
      { productId: 'abc-123', variantId: 'var-001', naixerCode: 'T003A' },
    ]);
  });

  it('reports error for missing product_id header', () => {
    const csv = `naixer_code
T003`;
    const result = parseProductCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('product_id');
  });

  it('reports error for missing naixer_code header', () => {
    const csv = `product_id
abc-123`;
    const result = parseProductCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('naixer_code');
  });

  it('skips rows with empty product_id', () => {
    const csv = `product_id,naixer_code
,T003
abc-123,T004`;
    const result = parseProductCodesCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.line).toBe(2);
    expect(result.errors[0]!.message).toContain('product_id is required');
  });

  it('skips rows with empty naixer_code', () => {
    const csv = `product_id,naixer_code
abc-123,`;
    const result = parseProductCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('naixer_code is required');
  });

  it('handles header-only CSV', () => {
    const csv = `product_id,naixer_code`;
    const result = parseProductCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('at least one data row');
  });

  it('handles empty CSV', () => {
    const result = parseProductCodesCsv('');
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('trims whitespace from cells', () => {
    const csv = `product_id , naixer_code
 abc-123 , T003 `;
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toEqual({
      productId: 'abc-123',
      variantId: null,
      naixerCode: 'T003',
    });
  });

  it('handles CRLF line endings', () => {
    const csv = 'product_id,naixer_code\r\nabc-123,T003\r\ndef-456,T004';
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });

  it('ignores blank lines', () => {
    const csv = `product_id,naixer_code

abc-123,T003

def-456,T004
`;
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
  });

  it('handles columns in different order', () => {
    const csv = `naixer_code,product_id,variant_id
T003,abc-123,var-001`;
    const result = parseProductCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toEqual({
      productId: 'abc-123',
      variantId: 'var-001',
      naixerCode: 'T003',
    });
  });
});

// ─── Modifier codes CSV ─────────────────────────────────────────────────────

describe('parseModifierCodesCsv', () => {
  it('parses valid CSV', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code,display_order
size,opt-001,C01,1
ice,opt-002,S02,2`;
    const result = parseModifierCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      { modifierKind: 'size', modifierOptionId: 'opt-001', naixerCode: 'C01', displayOrder: 1 },
      { modifierKind: 'ice', modifierOptionId: 'opt-002', naixerCode: 'S02', displayOrder: 2 },
    ]);
  });

  it('defaults display_order to 0 when column is missing', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code
sugar,opt-003,W01`;
    const result = parseModifierCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]!.displayOrder).toBe(0);
  });

  it('rejects invalid modifier_kind', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code
invalid,opt-001,C01`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('invalid modifier_kind');
  });

  it('accepts all valid modifier kinds', () => {
    const kinds = ['size', 'ice', 'sugar', 'topping', 'cup', 'other'];
    const rows = kinds.map((k, i) => `${k},opt-${i},C${String(i).padStart(2, '0')},${i}`);
    const csv = `modifier_kind,modifier_option_id,naixer_code,display_order\n${rows.join('\n')}`;
    const result = parseModifierCodesCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(6);
  });

  it('reports error for missing required headers', () => {
    const csv = `naixer_code
C01`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('modifier_kind');
    expect(result.errors[0]!.message).toContain('modifier_option_id');
  });

  it('skips rows with empty modifier_option_id', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code
size,,C01`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('modifier_option_id is required');
  });

  it('skips rows with empty naixer_code', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code
size,opt-001,`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('naixer_code is required');
  });

  it('rejects non-integer display_order', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code,display_order
size,opt-001,C01,abc`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('invalid display_order');
  });

  it('handles header-only CSV', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('at least one data row');
  });

  it('mixes valid and invalid rows', () => {
    const csv = `modifier_kind,modifier_option_id,naixer_code,display_order
size,opt-001,C01,1
invalid_kind,opt-002,S02,2
ice,opt-003,S01,3`;
    const result = parseModifierCodesCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.line).toBe(3);
  });
});
