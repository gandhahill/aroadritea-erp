/**
 * Unit tests for MCP response serialization (helpers.ts).
 *
 * Regression guard: reporting services return native `bigint` Money
 * fields. `JSON.stringify` throws on bigint unless a replacer renders it,
 * so mcpSuccess/serializeResult must serialize bigint as a string instead
 * of crashing the tool call.
 */

import { describe, expect, it } from 'vitest';
import { mcpSuccess, serializeResult } from './helpers';

/** Extract the first text block from an MCP response (guards index access). */
function firstText(res: { content: { type: 'text'; text: string }[] }): string {
  const block = res.content.at(0);
  if (!block) throw new Error('expected at least one content block');
  return block.text;
}

describe('mcpSuccess', () => {
  it('serializes native bigint fields as strings without throwing', () => {
    // Mirrors a reporting.profitLoss result shape (all-bigint Money totals).
    const data = {
      netIncome: 1_234_567n,
      grossProfit: 9_000_000n,
      nested: { total: 0n },
      arr: [10n, 20n],
      note: 'plain string',
    };

    const res = mcpSuccess(data);
    const parsed = JSON.parse(firstText(res));

    expect(res.isError).toBe(false);
    expect(parsed.netIncome).toBe('1234567');
    expect(parsed.grossProfit).toBe('9000000');
    expect(parsed.nested.total).toBe('0');
    expect(parsed.arr).toEqual(['10', '20']);
    expect(parsed.note).toBe('plain string');
  });
});

describe('serializeResult', () => {
  it('serializes an ok Result containing bigint fields', () => {
    const res = serializeResult({
      ok: true,
      value: { assets: { total: 5_000_000n }, retainedEarnings: -250n },
    });
    const parsed = JSON.parse(firstText(res));

    expect(res.isError).toBe(false);
    expect(parsed.assets.total).toBe('5000000');
    expect(parsed.retainedEarnings).toBe('-250');
  });

  it('maps an error Result to an MCP error response', () => {
    const res = serializeResult({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'missing' },
    });

    expect(res.isError).toBe(true);
    expect(firstText(res)).toContain('[NOT_FOUND]');
    expect(firstText(res)).toContain('missing');
  });
});
