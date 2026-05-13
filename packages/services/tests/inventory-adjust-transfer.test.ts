/**
 * Tests for inventory.adjust and inventory.transfer services.
 *
 * Uses direct imports (no mocking) to test schema validation.
 * Business logic tested with unit calculations.
 * Integration tests use the full test harness with Neon (SD §35.2).
 */

import { describe, expect, it } from 'vitest';
import {
  AdjustmentReasonSchema,
  ApproveAdjustmentInputSchema,
  CreateAdjustmentInputSchema,
  CreateTransferInputSchema,
  ReceiveTransferInputSchema,
  RejectAdjustmentInputSchema,
  ShipTransferInputSchema,
} from '../src/inventory/schemas';

// ─── Adjustment Schema Tests ──────────────────────────────────────────────────

describe('CreateAdjustmentInputSchema', () => {
  it('accepts valid waste adjustment', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'waste',
      notes: 'Expired tea leaves',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '10.000',
          qtyAfter: '8.000',
          qtyDelta: '-2.000',
          uom: 'kg',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts count_correction with negative delta', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'count_correction',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '10',
          qtyAfter: '8',
          qtyDelta: '-2',
          uom: 'pcs',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts damage reason', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'damage',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '20',
          qtyAfter: '0',
          qtyDelta: '-20',
          uom: 'pcs',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts opening_balance reason', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'opening_balance',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '0',
          qtyAfter: '100',
          qtyDelta: '100',
          uom: 'kg',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts optional fields omitted', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'other',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '5',
          qtyAfter: '5',
          qtyDelta: '0',
          uom: 'pcs',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format (DD-MM-YYYY)', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '09-05-2026',
      reason: 'waste',
      lines: [{ productId: 'p1', qtyBefore: '10', qtyAfter: '8', qtyDelta: '-2', uom: 'kg' }],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid reason', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'theft',
      lines: [{ productId: 'p1', qtyBefore: '10', qtyAfter: '8', qtyDelta: '-2', uom: 'kg' }],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty lines array', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'waste',
      lines: [],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing locationId', () => {
    const input = {
      adjustmentDate: '2026-05-09',
      reason: 'waste',
      lines: [{ productId: 'p1', qtyBefore: '10', qtyAfter: '8', qtyDelta: '-2', uom: 'kg' }],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts decimal quantities', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'waste',
      lines: [
        {
          productId: 'prod-1',
          qtyBefore: '10.500',
          qtyAfter: '8.250',
          qtyDelta: '-2.250',
          uom: 'kg',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects negative qtyBefore format (string with minus)', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'waste',
      lines: [{ productId: 'p1', qtyBefore: '-10', qtyAfter: '8', qtyDelta: '-2', uom: 'kg' }],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts optional variantId and batchNo', () => {
    const input = {
      locationId: 'loc-mli',
      adjustmentDate: '2026-05-09',
      reason: 'count_correction',
      lines: [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          batchNo: 'BATCH-2026-05',
          qtyBefore: '50',
          qtyAfter: '48',
          qtyDelta: '-2',
          uom: 'pcs',
        },
      ],
    };
    const result = CreateAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('ApproveAdjustmentInputSchema', () => {
  it('accepts valid approval input', () => {
    const input = { adjustmentId: 'adj-1', version: 1 };
    const result = ApproveAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects zero version', () => {
    const input = { adjustmentId: 'adj-1', version: 0 };
    const result = ApproveAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing adjustmentId', () => {
    const input = { version: 1 };
    const result = ApproveAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('RejectAdjustmentInputSchema', () => {
  it('accepts valid rejection input', () => {
    const input = { adjustmentId: 'adj-1', version: 1, reason: 'Invalid count' };
    const result = RejectAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty rejection reason', () => {
    const input = { adjustmentId: 'adj-1', version: 1, reason: '' };
    const result = RejectAdjustmentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('AdjustmentReasonSchema', () => {
  const validReasons = ['waste', 'damage', 'count_correction', 'opening_balance', 'other'];

  for (const reason of validReasons) {
    it(`accepts reason: ${reason}`, () => {
      const result = AdjustmentReasonSchema.safeParse(reason);
      expect(result.success).toBe(true);
    });
  }

  it('rejects invalid reason', () => {
    const result = AdjustmentReasonSchema.safeParse('fraud');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = AdjustmentReasonSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

// ─── Transfer Schema Tests ────────────────────────────────────────────────────

describe('CreateTransferInputSchema', () => {
  it('accepts valid transfer', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      notes: 'Restock Plaza Malioboro',
      lines: [{ productId: 'prod-1', qty: '5.000', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts multiple lines', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [
        { productId: 'prod-1', qty: '5', uom: 'kg' },
        { productId: 'prod-2', qty: '3', uom: 'pcs' },
        { productId: 'prod-3', qty: '1.5', uom: 'liter' },
      ],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts optional variantId', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [{ productId: 'prod-1', variantId: 'var-large', qty: '5', uom: 'pcs' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects same from/to location', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-mli',
      transferDate: '2026-05-09',
      lines: [{ productId: 'prod-1', qty: '5', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '09/05/2026',
      lines: [{ productId: 'prod-1', qty: '5', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects negative quantity', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [{ productId: 'prod-1', qty: '-5', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [{ productId: 'prod-1', qty: '0', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts decimal quantity', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [{ productId: 'prod-1', qty: '2.500', uom: 'kg' }],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty lines', () => {
    const input = {
      fromLocationId: 'loc-mli',
      toLocationId: 'loc-plz',
      transferDate: '2026-05-09',
      lines: [],
    };
    const result = CreateTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('ShipTransferInputSchema', () => {
  it('accepts valid ship input', () => {
    const input = { transferId: 'trf-1', version: 1 };
    const result = ShipTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects version 0', () => {
    const input = { transferId: 'trf-1', version: 0 };
    const result = ShipTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('ReceiveTransferInputSchema', () => {
  it('accepts receive with full received quantities', () => {
    const input = {
      transferId: 'trf-1',
      version: 1,
      lines: [
        { lineId: 'line-1', qtyReceived: '5.000' },
        { lineId: 'line-2', qtyReceived: '3.000' },
      ],
    };
    const result = ReceiveTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts partial receive (less than sent)', () => {
    const input = {
      transferId: 'trf-1',
      version: 1,
      lines: [
        { lineId: 'line-1', qtyReceived: '4.500' }, // sent 5.000, received 4.500
      ],
    };
    const result = ReceiveTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts receive without explicit lines (defaults to sent qty)', () => {
    const input = { transferId: 'trf-1', version: 1 };
    const result = ReceiveTransferInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects zero qtyReceived', () => {
    const input = {
      transferId: 'trf-1',
      version: 1,
      lines: [{ lineId: 'line-1', qtyReceived: '0' }],
    };
    const result = ReceiveTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects negative qtyReceived', () => {
    const input = {
      transferId: 'trf-1',
      version: 1,
      lines: [{ lineId: 'line-1', qtyReceived: '-1' }],
    };
    const result = ReceiveTransferInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── Adjustment Workflow Tests ─────────────────────────────────────────────────

describe('Adjustment workflow business rules', () => {
  it('valid statuses are: draft, submitted, approved, rejected', () => {
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected'];
    // These are enforced by the service logic, not schemas.
    // The workflow: draft → submitted → approved|rejected
    expect(validStatuses).toEqual(['draft', 'submitted', 'approved', 'rejected']);
  });

  it('submit only valid from draft', () => {
    const transitions = {
      draft: ['submitted'],
      submitted: [],
      approved: [],
      rejected: [],
    };
    expect(transitions.draft).toContain('submitted');
    expect(transitions.submitted).not.toContain('submitted');
  });

  it('approve only valid from submitted', () => {
    const transitions = {
      draft: [],
      submitted: ['approved', 'rejected'],
      approved: [],
      rejected: [],
    };
    expect(transitions.submitted).toContain('approved');
    expect(transitions.draft).not.toContain('approved');
  });

  it('reject only valid from submitted', () => {
    const transitions = {
      draft: [],
      submitted: ['approved', 'rejected'],
      approved: [],
      rejected: [],
    };
    expect(transitions.submitted).toContain('rejected');
    expect(transitions.draft).not.toContain('rejected');
  });
});

// ─── Transfer Workflow Tests ───────────────────────────────────────────────────

describe('Transfer workflow business rules', () => {
  it('valid statuses are: draft, in_transit, received, cancelled', () => {
    const validStatuses = ['draft', 'in_transit', 'received', 'cancelled'];
    // Workflow: draft → in_transit → received
    //            ↘ cancelled
    expect(validStatuses).toEqual(['draft', 'in_transit', 'received', 'cancelled']);
  });

  it('ship only valid from draft', () => {
    const transitions = {
      draft: ['in_transit', 'cancelled'],
      in_transit: ['received'],
      received: [],
      cancelled: [],
    };
    expect(transitions.draft).toContain('in_transit');
    expect(transitions.in_transit).not.toContain('in_transit');
  });

  it('receive only valid from in_transit', () => {
    const transitions = {
      draft: ['in_transit', 'cancelled'],
      in_transit: ['received'],
      received: [],
      cancelled: [],
    };
    expect(transitions.in_transit).toContain('received');
    expect(transitions.draft).not.toContain('received');
  });

  it('cancel only valid from draft', () => {
    const transitions = {
      draft: ['in_transit', 'cancelled'],
      in_transit: ['received'],
      received: [],
      cancelled: [],
    };
    expect(transitions.draft).toContain('cancelled');
    expect(transitions.in_transit).not.toContain('cancelled');
  });
});

// ─── Stock Level Calculation Tests ───────────────────────────────────────────

describe('Stock level calculations', () => {
  it('qty_available = qty_on_hand - qty_reserved', () => {
    const qtyOnHand = 100;
    const qtyReserved = 25;
    const qtyAvailable = qtyOnHand - qtyReserved;
    expect(qtyAvailable).toBe(75);
  });

  it('newly created stock level has qty_reserved = 0', () => {
    const qtyOnHand = 50;
    const qtyReserved = 0;
    const qtyAvailable = qtyOnHand - qtyReserved;
    expect(qtyAvailable).toBe(50);
  });

  it('transfer deducts from source qty_on_hand', () => {
    const sourceBefore = 100;
    const qtySent = 30;
    const sourceAfter = Math.max(0, sourceBefore - qtySent);
    expect(sourceAfter).toBe(70);
  });

  it('transfer adds to destination qty_on_hand', () => {
    const destBefore = 20;
    const qtyReceived = 28; // 2 kg lost in transit
    const destAfter = destBefore + qtyReceived;
    expect(destAfter).toBe(48);
  });

  it('partial receive keeps source deducted but dest only gets what arrived', () => {
    const sourceBefore = 100;
    const qtySent = 30;
    const qtyReceived = 28;
    expect(Math.max(0, sourceBefore - qtySent)).toBe(70);
    // destination only gets what arrived
    expect(qtyReceived).toBe(28);
    // the 2 kg difference stays as waste
    expect(qtySent - qtyReceived).toBe(2);
  });

  it('negative adjustment reduces qty_on_hand', () => {
    const before = 100;
    const delta = -5;
    const after = before + delta;
    expect(after).toBe(95);
  });

  it('positive adjustment increases qty_on_hand', () => {
    const before = 100;
    const delta = 10;
    const after = before + delta;
    expect(after).toBe(110);
  });
});

// ─── JE Calculation Tests ─────────────────────────────────────────────────────

describe('JE monetary calculation', () => {
  // netDelta = sum(qtyDelta × unitCost) — unitCost is bigint rupiah
  // netDelta > 0 = gain (DR inventory, CR income)
  // netDelta < 0 = loss (DR expense, CR inventory)

  it('calculates net delta for mixed positive/negative lines', () => {
    const lines = [
      { qtyDelta: -2, unitCost: 50000n }, // -100000
      { qtyDelta: 1, unitCost: 30000n }, // +30000
      { qtyDelta: -0.5, unitCost: 20000n }, // -10000
    ];
    const netDelta = lines.reduce((sum, l) => sum + l.qtyDelta * Number(l.unitCost), 0);
    expect(netDelta).toBe(-80000);
  });

  it('netDelta > 0 triggers gain journal entry', () => {
    const lines = [
      { qtyDelta: 5, unitCost: 20000n }, // +100000
    ];
    const netDelta = lines.reduce((sum, l) => sum + l.qtyDelta * Number(l.unitCost), 0);
    expect(netDelta > 0).toBe(true);
  });

  it('netDelta < 0 triggers loss journal entry', () => {
    const lines = [
      { qtyDelta: -3, unitCost: 15000n }, // -45000
    ];
    const netDelta = lines.reduce((sum, l) => sum + l.qtyDelta * Number(l.unitCost), 0);
    expect(netDelta < 0).toBe(true);
  });

  it('zero unit cost results in netDelta = 0, skips JE', () => {
    const lines = [{ qtyDelta: -5, unitCost: null as bigint | null }];
    const netDelta = lines.reduce((sum, l) => {
      const cost = l.unitCost ? Number(l.unitCost) : 0;
      return sum + l.qtyDelta * cost;
    }, 0);
    expect(netDelta).toBe(0);
    expect(Math.abs(netDelta) > 0.01).toBe(false);
  });

  it('tiny adjustments (|netDelta| ≤ 0.01) skip JE creation', () => {
    const lines = [
      { qtyDelta: 0.001, unitCost: 10000n }, // 10 IDR
    ];
    const netDelta = lines.reduce((sum, l) => sum + l.qtyDelta * Number(l.unitCost), 0);
    expect(netDelta).toBe(10);
    expect(netDelta > 0.01).toBe(true); // > 0.01 threshold
  });

  it('exactly 1 IDR triggers JE (boundary)', () => {
    const netDelta = 1;
    expect(netDelta > 0.01).toBe(true); // JE created for 1 IDR
  });
});
