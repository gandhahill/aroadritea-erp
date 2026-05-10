/**
 * Tests for kitchen QR payload generation — T-0081
 *
 * Tests: strategy encoding/decoding, demo prefix, format selection.
 */

import { describe, it, expect } from 'vitest';
import {
  dashStrategy,
  pipeStrategy,
  getStrategy,
  wrapDemo,
  isDemo,
  unwrapDemo,
  type NaixerQRPayload,
} from '../src/kitchen/qr-strategy';

// ─── Dash Strategy (Format B) ───────────────────────────────────────────────

describe('dashStrategy (Format B)', () => {
  it('encodes product code only', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: [],
    };
    expect(dashStrategy.encode(payload)).toBe('T003');
  });

  it('encodes product + single spec', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: ['C01'],
    };
    expect(dashStrategy.encode(payload)).toBe('T003-C01');
  });

  it('encodes product + multiple specs', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01'],
    };
    expect(dashStrategy.encode(payload)).toBe('T003-C01-S02-W01');
  });

  it('ignores orderNumber', () => {
    const payload: NaixerQRPayload = {
      orderNumber: 'ORD0001',
      productCode: 'T003',
      specCodes: ['C01'],
    };
    expect(dashStrategy.encode(payload)).toBe('T003-C01');
  });

  it('decodes product code only', () => {
    const result = dashStrategy.decode('T003');
    expect(result).toEqual({
      productCode: 'T003',
      specCodes: [],
    });
  });

  it('decodes product + specs', () => {
    const result = dashStrategy.decode('T003-C01-S02-W01');
    expect(result).toEqual({
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01'],
    });
  });

  it('roundtrips correctly', () => {
    const original: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01'],
    };
    const encoded = dashStrategy.encode(original);
    const decoded = dashStrategy.decode(encoded);
    expect(decoded?.productCode).toBe(original.productCode);
    expect(decoded?.specCodes).toEqual(original.specCodes);
  });
});

// ─── Pipe Strategy (Format A) ───────────────────────────────────────────────

describe('pipeStrategy (Format A)', () => {
  it('encodes with order number', () => {
    const payload: NaixerQRPayload = {
      orderNumber: 'ORD0001',
      productCode: 'P0003',
      specCodes: ['A001', 'M002', 'T001'],
    };
    expect(pipeStrategy.encode(payload)).toBe('ORD0001|P0003|A001,M002,T001');
  });

  it('encodes without order number', () => {
    const payload: NaixerQRPayload = {
      productCode: 'P0003',
      specCodes: ['A001'],
    };
    expect(pipeStrategy.encode(payload)).toBe('|P0003|A001');
  });

  it('encodes empty specs', () => {
    const payload: NaixerQRPayload = {
      orderNumber: 'ORD0001',
      productCode: 'P0003',
      specCodes: [],
    };
    expect(pipeStrategy.encode(payload)).toBe('ORD0001|P0003|');
  });

  it('decodes with order number', () => {
    const result = pipeStrategy.decode('ORD0001|P0003|A001,M002,T001');
    expect(result).toEqual({
      orderNumber: 'ORD0001',
      productCode: 'P0003',
      specCodes: ['A001', 'M002', 'T001'],
    });
  });

  it('decodes without order number', () => {
    const result = pipeStrategy.decode('|P0003|A001');
    expect(result).toEqual({
      orderNumber: undefined,
      productCode: 'P0003',
      specCodes: ['A001'],
    });
  });

  it('returns null for invalid input', () => {
    expect(pipeStrategy.decode('T003-C01')).toBeNull();
    expect(pipeStrategy.decode('just-one|part')).toBeNull();
  });

  it('roundtrips correctly', () => {
    const original: NaixerQRPayload = {
      orderNumber: 'ORD0001',
      productCode: 'P0003',
      specCodes: ['A001', 'M002'],
    };
    const encoded = pipeStrategy.encode(original);
    const decoded = pipeStrategy.decode(encoded);
    expect(decoded?.orderNumber).toBe(original.orderNumber);
    expect(decoded?.productCode).toBe(original.productCode);
    expect(decoded?.specCodes).toEqual(original.specCodes);
  });
});

// ─── Strategy registry ──────────────────────────────────────────────────────

describe('getStrategy', () => {
  it('returns dash strategy for "dash"', () => {
    const strategy = getStrategy('dash');
    expect(strategy).toBe(dashStrategy);
  });

  it('returns pipe strategy for "pipe"', () => {
    const strategy = getStrategy('pipe');
    expect(strategy).toBe(pipeStrategy);
  });

  it('falls back to dash for unknown format', () => {
    const strategy = getStrategy('unknown');
    expect(strategy).toBe(dashStrategy);
  });

  it('falls back to dash for empty string', () => {
    const strategy = getStrategy('');
    expect(strategy).toBe(dashStrategy);
  });
});

// ─── Demo mode ──────────────────────────────────────────────────────────────

describe('demo mode', () => {
  it('wraps payload with DEMO- prefix', () => {
    expect(wrapDemo('T003-C01-S02', true)).toBe('DEMO-T003-C01-S02');
  });

  it('does not wrap when isDemo is false', () => {
    expect(wrapDemo('T003-C01-S02', false)).toBe('T003-C01-S02');
  });

  it('detects demo payload', () => {
    expect(isDemo('DEMO-T003-C01-S02')).toBe(true);
    expect(isDemo('T003-C01-S02')).toBe(false);
  });

  it('unwraps demo prefix', () => {
    expect(unwrapDemo('DEMO-T003-C01-S02')).toBe('T003-C01-S02');
  });

  it('unwrap is noop for non-demo', () => {
    expect(unwrapDemo('T003-C01-S02')).toBe('T003-C01-S02');
  });

  it('demo wrapping works with pipe format', () => {
    expect(wrapDemo('ORD0001|P0003|A001,M002', true)).toBe(
      'DEMO-ORD0001|P0003|A001,M002',
    );
  });
});

// ─── Payload construction ───────────────────────────────────────────────────

describe('payload construction patterns', () => {
  it('Aroadri typical: Glutinous Fragrant Milk Tea, Large, Less Ice, Less Sugar', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01'],
    };
    const result = dashStrategy.encode(payload);
    expect(result).toBe('T003-C01-S02-W01');
  });

  it('minimal: product only (no modifiers)', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T001',
      specCodes: [],
    };
    const result = dashStrategy.encode(payload);
    expect(result).toBe('T001');
  });

  it('with toppings', () => {
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01', 'TP01'],
    };
    const result = dashStrategy.encode(payload);
    expect(result).toBe('T003-C01-S02-W01-TP01');
  });

  it('pipe format with order ID for KDS tracking', () => {
    const payload: NaixerQRPayload = {
      orderNumber: 'MLI-2026-05-0042',
      productCode: 'T003',
      specCodes: ['C01', 'S02', 'W01'],
    };
    const result = pipeStrategy.encode(payload);
    expect(result).toBe('MLI-2026-05-0042|T003|C01,S02,W01');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles single-character codes', () => {
    const payload: NaixerQRPayload = {
      productCode: 'A',
      specCodes: ['B', 'C'],
    };
    expect(dashStrategy.encode(payload)).toBe('A-B-C');
  });

  it('handles long codes', () => {
    const payload: NaixerQRPayload = {
      productCode: 'PRODUCT001',
      specCodes: ['MODIFIER001', 'MODIFIER002'],
    };
    expect(dashStrategy.encode(payload)).toBe(
      'PRODUCT001-MODIFIER001-MODIFIER002',
    );
  });

  it('spec order is preserved', () => {
    const specs = ['Z99', 'A01', 'M50'];
    const payload: NaixerQRPayload = {
      productCode: 'T003',
      specCodes: specs,
    };
    const result = dashStrategy.decode(dashStrategy.encode(payload));
    expect(result?.specCodes).toEqual(specs);
  });
});
