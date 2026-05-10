/**
 * Tests for customer-facing display service — T-0085i
 *
 * Tests: grouping logic, SSE formatting, event creation.
 */

import { describe, it, expect } from 'vitest';
import {
  groupDisplayItems,
  formatSseEvent,
  createQueueUpdateEvent,
  createItemChangeEvent,
  type RawDisplayRow,
  type DisplayQueue,
} from '../src/kitchen/display-service';

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeRow(overrides: Partial<RawDisplayRow> = {}): RawDisplayRow {
  return {
    id: 'item-1',
    pickupNumber: 1,
    productSummary: 'Product A',
    status: 'queued',
    queuedAt: new Date('2026-05-11T10:00:00Z'),
    makingAt: null,
    readyAt: null,
    ...overrides,
  };
}

// ─── groupDisplayItems ──────────────────────────────────────────────────────

describe('groupDisplayItems', () => {
  it('groups items by status', () => {
    const rows: RawDisplayRow[] = [
      makeRow({ id: 'a', status: 'queued', pickupNumber: 1 }),
      makeRow({ id: 'b', status: 'making', pickupNumber: 2 }),
      makeRow({ id: 'c', status: 'ready', pickupNumber: 3 }),
    ];

    const result = groupDisplayItems(rows);
    expect(result.queued).toHaveLength(1);
    expect(result.making).toHaveLength(1);
    expect(result.ready).toHaveLength(1);
    expect(result.queued[0]!.id).toBe('a');
    expect(result.making[0]!.id).toBe('b');
    expect(result.ready[0]!.id).toBe('c');
  });

  it('sorts by pickup number within each group', () => {
    const rows: RawDisplayRow[] = [
      makeRow({ id: 'a', status: 'queued', pickupNumber: 5 }),
      makeRow({ id: 'b', status: 'queued', pickupNumber: 2 }),
      makeRow({ id: 'c', status: 'queued', pickupNumber: 8 }),
      makeRow({ id: 'd', status: 'queued', pickupNumber: 1 }),
    ];

    const result = groupDisplayItems(rows);
    expect(result.queued.map((i) => i.pickupNumber)).toEqual([1, 2, 5, 8]);
  });

  it('handles empty input', () => {
    const result = groupDisplayItems([]);
    expect(result.queued).toHaveLength(0);
    expect(result.making).toHaveLength(0);
    expect(result.ready).toHaveLength(0);
  });

  it('ignores served and cancelled items', () => {
    const rows: RawDisplayRow[] = [
      makeRow({ id: 'a', status: 'served', pickupNumber: 1 }),
      makeRow({ id: 'b', status: 'cancelled', pickupNumber: 2 }),
      makeRow({ id: 'c', status: 'queued', pickupNumber: 3 }),
    ];

    const result = groupDisplayItems(rows);
    expect(result.queued).toHaveLength(1);
    expect(result.making).toHaveLength(0);
    expect(result.ready).toHaveLength(0);
  });

  it('handles multiple items per status', () => {
    const rows: RawDisplayRow[] = [
      makeRow({ id: 'a', status: 'queued', pickupNumber: 1 }),
      makeRow({ id: 'b', status: 'queued', pickupNumber: 2 }),
      makeRow({ id: 'c', status: 'making', pickupNumber: 3 }),
      makeRow({ id: 'd', status: 'making', pickupNumber: 4 }),
      makeRow({ id: 'e', status: 'ready', pickupNumber: 5 }),
    ];

    const result = groupDisplayItems(rows);
    expect(result.queued).toHaveLength(2);
    expect(result.making).toHaveLength(2);
    expect(result.ready).toHaveLength(1);
  });

  it('preserves item fields correctly', () => {
    const makingAt = new Date('2026-05-11T10:05:00Z');
    const readyAt = new Date('2026-05-11T10:10:00Z');
    const row = makeRow({
      id: 'item-42',
      pickupNumber: 42,
      productSummary: 'Glutinous Fragrant Tea | Sugar: Less | Ice: Standard',
      status: 'ready',
      makingAt,
      readyAt,
    });

    const result = groupDisplayItems([row]);
    const item = result.ready[0]!;
    expect(item.id).toBe('item-42');
    expect(item.pickupNumber).toBe(42);
    expect(item.productSummary).toContain('Glutinous');
    expect(item.status).toBe('ready');
    expect(item.makingAt).toEqual(makingAt);
    expect(item.readyAt).toEqual(readyAt);
  });
});

// ─── SSE formatting ─────────────────────────────────────────────────────────

describe('formatSseEvent', () => {
  it('formats event with correct SSE structure', () => {
    const event = createQueueUpdateEvent('loc-1', {
      locationId: 'loc-1',
      timestamp: new Date('2026-05-11T10:00:00Z'),
      queued: [],
      making: [],
      ready: [],
    });

    const result = formatSseEvent(event);
    expect(result).toContain('event: queue_update\n');
    expect(result).toContain('data: {');
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('formats item change event', () => {
    const event = createItemChangeEvent('loc-1', {
      itemId: 'item-1',
      pickupNumber: 5,
      previousStatus: 'making',
      newStatus: 'ready',
    });

    const result = formatSseEvent(event);
    expect(result).toContain('event: item_status_change\n');
    expect(result).toContain('"itemId":"item-1"');
    expect(result).toContain('"pickupNumber":5');
  });

  it('contains parseable JSON in data field', () => {
    const event = createQueueUpdateEvent('loc-1', {
      locationId: 'loc-1',
      timestamp: new Date('2026-05-11T10:00:00Z'),
      queued: [],
      making: [],
      ready: [],
    });

    const result = formatSseEvent(event);
    const dataLine = result.split('\n').find((l) => l.startsWith('data: '));
    expect(dataLine).toBeTruthy();
    const json = dataLine!.substring(6);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ─── Event creation ─────────────────────────────────────────────────────────

describe('createQueueUpdateEvent', () => {
  it('creates event with queue_update type', () => {
    const queue: DisplayQueue = {
      locationId: 'loc-1',
      timestamp: new Date(),
      queued: [],
      making: [],
      ready: [],
    };

    const event = createQueueUpdateEvent('loc-1', queue);
    expect(event.type).toBe('queue_update');
    expect(event.locationId).toBe('loc-1');
    expect(event.data).toBe(queue);
  });
});

describe('createItemChangeEvent', () => {
  it('creates event with item_status_change type', () => {
    const change = {
      itemId: 'item-1',
      pickupNumber: 3,
      previousStatus: 'queued' as const,
      newStatus: 'making' as const,
    };

    const event = createItemChangeEvent('loc-1', change);
    expect(event.type).toBe('item_status_change');
    expect(event.locationId).toBe('loc-1');
    expect(event.data).toEqual(change);
  });
});
