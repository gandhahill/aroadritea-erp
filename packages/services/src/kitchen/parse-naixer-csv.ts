/**
 * kitchen/parse-naixer-csv.ts — Parse CSV files for Naixer code import (T-0083)
 *
 * Pure functions — no DB or I/O. Used by scripts/seed-naixer-codes.ts.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductCodeRow {
  productId: string;
  variantId: string | null;
  naixerCode: string;
}

export interface ModifierCodeRow {
  modifierKind: string;
  modifierOptionId: string;
  naixerCode: string;
  displayOrder: number;
}

export interface ParseResult<T> {
  rows: T[];
  errors: Array<{ line: number; message: string }>;
}

const VALID_MODIFIER_KINDS = new Set([
  'size',
  'ice',
  'sugar',
  'topping',
  'cup',
  'other',
]);

// ─── CSV helpers ────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

function normalizeHeaders(headerLine: string): string[] {
  return splitCsvLine(headerLine).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
  );
}

// ─── Product codes ──────────────────────────────────────────────────────────

const PRODUCT_REQUIRED_HEADERS = ['product_id', 'naixer_code'];

export function parseProductCodesCsv(csv: string): ParseResult<ProductCodeRow> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 1, message: 'CSV must have a header row and at least one data row' }] };
  }

  const headers = normalizeHeaders(lines[0]!);
  const missingHeaders = PRODUCT_REQUIRED_HEADERS.filter(
    (h) => !headers.includes(h),
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Missing required headers: ${missingHeaders.join(', ')}` }],
    };
  }

  const productIdIdx = headers.indexOf('product_id');
  const variantIdIdx = headers.indexOf('variant_id');
  const naixerCodeIdx = headers.indexOf('naixer_code');

  const rows: ProductCodeRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = splitCsvLine(lines[i]!);

    const productId = cells[productIdIdx] ?? '';
    const variantId =
      variantIdIdx >= 0 ? (cells[variantIdIdx] || null) : null;
    const naixerCode = cells[naixerCodeIdx] ?? '';

    if (!productId) {
      errors.push({ line: lineNum, message: 'product_id is required' });
      continue;
    }
    if (!naixerCode) {
      errors.push({ line: lineNum, message: 'naixer_code is required' });
      continue;
    }

    rows.push({ productId, variantId: variantId || null, naixerCode });
  }

  return { rows, errors };
}

// ─── Modifier codes ─────────────────────────────────────────────────────────

const MODIFIER_REQUIRED_HEADERS = [
  'modifier_kind',
  'modifier_option_id',
  'naixer_code',
];

export function parseModifierCodesCsv(
  csv: string,
): ParseResult<ModifierCodeRow> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 1, message: 'CSV must have a header row and at least one data row' }] };
  }

  const headers = normalizeHeaders(lines[0]!);
  const missingHeaders = MODIFIER_REQUIRED_HEADERS.filter(
    (h) => !headers.includes(h),
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Missing required headers: ${missingHeaders.join(', ')}` }],
    };
  }

  const kindIdx = headers.indexOf('modifier_kind');
  const optionIdIdx = headers.indexOf('modifier_option_id');
  const naixerCodeIdx = headers.indexOf('naixer_code');
  const displayOrderIdx = headers.indexOf('display_order');

  const rows: ModifierCodeRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = splitCsvLine(lines[i]!);

    const modifierKind = cells[kindIdx] ?? '';
    const modifierOptionId = cells[optionIdIdx] ?? '';
    const naixerCode = cells[naixerCodeIdx] ?? '';
    const displayOrderRaw =
      displayOrderIdx >= 0 ? (cells[displayOrderIdx] ?? '0') : '0';

    if (!modifierKind) {
      errors.push({ line: lineNum, message: 'modifier_kind is required' });
      continue;
    }
    if (!VALID_MODIFIER_KINDS.has(modifierKind)) {
      errors.push({
        line: lineNum,
        message: `invalid modifier_kind "${modifierKind}" — must be one of: ${[...VALID_MODIFIER_KINDS].join(', ')}`,
      });
      continue;
    }
    if (!modifierOptionId) {
      errors.push({
        line: lineNum,
        message: 'modifier_option_id is required',
      });
      continue;
    }
    if (!naixerCode) {
      errors.push({ line: lineNum, message: 'naixer_code is required' });
      continue;
    }

    const displayOrder = Number.parseInt(displayOrderRaw, 10);
    if (Number.isNaN(displayOrder)) {
      errors.push({
        line: lineNum,
        message: `invalid display_order "${displayOrderRaw}" — must be an integer`,
      });
      continue;
    }

    rows.push({ modifierKind, modifierOptionId, naixerCode, displayOrder });
  }

  return { rows, errors };
}
