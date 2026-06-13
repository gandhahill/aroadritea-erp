/**
 * Tests for KDS production status logic — T-0084
 *
 * Tests status transitions (pure logic) and type contracts.
 */

import type { salesOrderLines } from '@erp/db/schema/pos';
import type { ModifierSelection } from '@erp/shared/pos/modifiers';
import { describe, expect, it } from 'vitest';
import { type KdsStatus, buildProductSummary, isValidTransition } from '../src/kitchen/kds-service';

// ─── Status transition validation ───────────────────────────────────────────

describe('isValidTransition', () => {
  // queued transitions
  it('allows queued → making', () => {
    expect(isValidTransition('queued', 'making')).toBe(true);
  });

  it('allows queued → cancelled', () => {
    expect(isValidTransition('queued', 'cancelled')).toBe(true);
  });

  it('rejects queued → ready (must go through making)', () => {
    expect(isValidTransition('queued', 'ready')).toBe(false);
  });

  it('rejects queued → served', () => {
    expect(isValidTransition('queued', 'served')).toBe(false);
  });

  // making transitions
  it('allows making → ready', () => {
    expect(isValidTransition('making', 'ready')).toBe(true);
  });

  it('allows making → queued (reset)', () => {
    expect(isValidTransition('making', 'queued')).toBe(true);
  });

  it('allows making → cancelled', () => {
    expect(isValidTransition('making', 'cancelled')).toBe(true);
  });

  it('rejects making → served (must go through ready)', () => {
    expect(isValidTransition('making', 'served')).toBe(false);
  });

  // ready transitions
  it('allows ready → served', () => {
    expect(isValidTransition('ready', 'served')).toBe(true);
  });

  it('allows ready → cancelled', () => {
    expect(isValidTransition('ready', 'cancelled')).toBe(true);
  });

  it('rejects ready → queued', () => {
    expect(isValidTransition('ready', 'queued')).toBe(false);
  });

  it('rejects ready → making', () => {
    expect(isValidTransition('ready', 'making')).toBe(false);
  });

  // terminal states
  it('rejects served → any', () => {
    const statuses: KdsStatus[] = ['queued', 'making', 'ready', 'cancelled'];
    for (const target of statuses) {
      expect(isValidTransition('served', target)).toBe(false);
    }
  });

  it('rejects cancelled → any', () => {
    const statuses: KdsStatus[] = ['queued', 'making', 'ready', 'served'];
    for (const target of statuses) {
      expect(isValidTransition('cancelled', target)).toBe(false);
    }
  });

  // self-transition
  it('rejects queued → queued (no self-transition)', () => {
    expect(isValidTransition('queued', 'queued')).toBe(false);
  });

  it('rejects making → making', () => {
    expect(isValidTransition('making', 'making')).toBe(false);
  });
});

// ─── Full lifecycle paths ───────────────────────────────────────────────────

describe('lifecycle paths', () => {
  it('happy path: queued → making → ready → served', () => {
    const path: KdsStatus[] = ['queued', 'making', 'ready', 'served'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isValidTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('cancel from any active state', () => {
    const activeStates: KdsStatus[] = ['queued', 'making', 'ready'];
    for (const state of activeStates) {
      expect(isValidTransition(state, 'cancelled')).toBe(true);
    }
  });

  it('reset from making back to queued', () => {
    expect(isValidTransition('making', 'queued')).toBe(true);
  });

  it('cannot un-serve or un-cancel', () => {
    expect(isValidTransition('served', 'ready')).toBe(false);
    expect(isValidTransition('cancelled', 'queued')).toBe(false);
  });
});

// ─── Transition table completeness ──────────────────────────────────────────

describe('transition table completeness', () => {
  const ALL_STATUSES: KdsStatus[] = ['queued', 'making', 'ready', 'served', 'cancelled'];

  it('every status pair returns a boolean (no undefined/null)', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const result = isValidTransition(from, to);
        expect(typeof result).toBe('boolean');
      }
    }
  });

  it('queued has exactly 2 valid targets', () => {
    const validTargets = ALL_STATUSES.filter((to) => isValidTransition('queued', to));
    expect(validTargets).toEqual(['making', 'cancelled']);
  });

  it('making has exactly 3 valid targets', () => {
    const validTargets = ALL_STATUSES.filter((to) => isValidTransition('making', to));
    expect(validTargets).toEqual(['queued', 'ready', 'cancelled']);
  });

  it('ready has exactly 2 valid targets', () => {
    const validTargets = ALL_STATUSES.filter((to) => isValidTransition('ready', to));
    expect(validTargets).toEqual(['served', 'cancelled']);
  });

  it('served has 0 valid targets', () => {
    const validTargets = ALL_STATUSES.filter((to) => isValidTransition('served', to));
    expect(validTargets).toHaveLength(0);
  });

  it('cancelled has 0 valid targets', () => {
    const validTargets = ALL_STATUSES.filter((to) => isValidTransition('cancelled', to));
    expect(validTargets).toHaveLength(0);
  });
});

// ─── buildProductSummary (G1/ADR-0019 — ModifierSelection[] display) ───────────

describe('buildProductSummary', () => {
  const productNameById = new Map([
    ['prod-tea', { id: 'Es Teh Lemon', en: 'Iced Lemon Tea', zh: '柠檬冰茶' }],
  ]);
  const variantNameById = new Map([['var-large', { id: 'Besar', en: 'Large', zh: '大' }]]);

  function line(overrides: {
    productId?: string;
    variantId?: string | null;
    modifierJson?: ModifierSelection[] | null;
  }): typeof salesOrderLines.$inferSelect {
    return {
      productId: overrides.productId ?? 'prod-tea',
      variantId: overrides.variantId ?? null,
      modifierJson: overrides.modifierJson ?? null,
    } as unknown as typeof salesOrderLines.$inferSelect;
  }

  it('shows just the product name when there are no modifiers', () => {
    expect(buildProductSummary(line({}), productNameById, variantNameById)).toBe('Es Teh Lemon');
  });

  it('includes variant name in parentheses', () => {
    expect(buildProductSummary(line({ variantId: 'var-large' }), productNameById, variantNameById)).toBe(
      'Es Teh Lemon (Besar)',
    );
  });

  it('groups sugar/ice/topping selections by groupRole using the snapshotted group name', () => {
    const modifierJson: ModifierSelection[] = [
      {
        groupId: 'modgrp-sugar-level',
        groupRole: 'sugar',
        groupName: 'Level Gula',
        optionId: 'modopt-sugar-less',
        optionName: 'Less Sugar',
        extraPrice: '0',
      },
      {
        groupId: 'modgrp-ice-level',
        groupRole: 'ice',
        groupName: 'Level Es',
        optionId: 'modopt-ice-normal',
        optionName: 'Normal Ice',
        extraPrice: '0',
      },
      {
        groupId: 'modgrp-topping',
        groupRole: 'topping',
        groupName: 'Topping',
        optionId: 'modopt-topping-cheese-pearl',
        optionName: 'Cheese Pearl',
        extraPrice: '5000',
      },
      {
        groupId: 'modgrp-topping',
        groupRole: 'topping',
        groupName: 'Topping',
        optionId: 'modopt-topping-oat-pearl',
        optionName: 'Oat Pearl',
        extraPrice: '5000',
      },
    ];

    expect(buildProductSummary(line({ modifierJson }), productNameById, variantNameById)).toBe(
      'Es Teh Lemon | Level Gula: Less Sugar | Level Es: Normal Ice | Topping: Cheese Pearl, Oat Pearl',
    );
  });

  it('ignores malformed modifierJson (legacy/dead shapes) instead of throwing', () => {
    const legacyObjectShape = { sugar: 'Normal', ice: 'Less', toppings: [{ name: 'Pearl' }] };
    expect(
      buildProductSummary(
        line({ modifierJson: legacyObjectShape as unknown as ModifierSelection[] }),
        productNameById,
        variantNameById,
      ),
    ).toBe('Es Teh Lemon');

    const legacyArrayShape = [{ kind: 'sugar', optionId: 'modopt-sugar-normal' }];
    expect(
      buildProductSummary(
        line({ modifierJson: legacyArrayShape as unknown as ModifierSelection[] }),
        productNameById,
        variantNameById,
      ),
    ).toBe('Es Teh Lemon');
  });
});
