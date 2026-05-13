/**
 * Tests for KDS production status logic — T-0084
 *
 * Tests status transitions (pure logic) and type contracts.
 */

import { describe, expect, it } from 'vitest';
import { type KdsStatus, isValidTransition } from '../src/kitchen/kds-service';

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
