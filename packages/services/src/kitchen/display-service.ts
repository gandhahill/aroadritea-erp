/**
 * kitchen/display-service.ts — Customer-facing display data (SD §21.4)
 *
 * Provides the current queue state for a location, designed for
 * SSE subscription from `/display/:locationId`.
 */

import { db } from '@erp/db';
import { kdsOrderItems } from '@erp/db/schema/kitchen';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { KdsStatus } from './kds-service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DisplayItem {
  id: string;
  pickupNumber: number;
  productSummary: string;
  status: KdsStatus;
  queuedAt: Date;
  makingAt: Date | null;
  readyAt: Date | null;
}

export interface DisplayQueue {
  locationId: string;
  timestamp: Date;
  queued: DisplayItem[];
  making: DisplayItem[];
  ready: DisplayItem[];
}

export type DisplayEventType = 'queue_update' | 'item_status_change';

export interface DisplayEvent {
  type: DisplayEventType;
  locationId: string;
  timestamp: Date;
  data: DisplayQueue | DisplayItemChange;
}

export interface DisplayItemChange {
  itemId: string;
  pickupNumber: number;
  previousStatus: KdsStatus;
  newStatus: KdsStatus;
}

// ─── Display data grouping (pure, testable) ─────────────────────────────────

export interface RawDisplayRow {
  id: string;
  pickupNumber: number;
  productSummary: string;
  status: string;
  queuedAt: Date;
  makingAt: Date | null;
  readyAt: Date | null;
}

export function groupDisplayItems(rows: RawDisplayRow[]): {
  queued: DisplayItem[];
  making: DisplayItem[];
  ready: DisplayItem[];
} {
  const queued: DisplayItem[] = [];
  const making: DisplayItem[] = [];
  const ready: DisplayItem[] = [];

  for (const row of rows) {
    const item: DisplayItem = {
      id: row.id,
      pickupNumber: row.pickupNumber,
      productSummary: row.productSummary,
      status: row.status as KdsStatus,
      queuedAt: row.queuedAt,
      makingAt: row.makingAt,
      readyAt: row.readyAt,
    };

    switch (row.status) {
      case 'queued':
        queued.push(item);
        break;
      case 'making':
        making.push(item);
        break;
      case 'ready':
        ready.push(item);
        break;
    }
  }

  queued.sort((a, b) => a.pickupNumber - b.pickupNumber);
  making.sort((a, b) => a.pickupNumber - b.pickupNumber);
  ready.sort((a, b) => a.pickupNumber - b.pickupNumber);

  return { queued, making, ready };
}

// ─── Service ────────────────────────────────────────────────────────────────

export async function getDisplayQueue(
  locationId: string,
): Promise<Result<DisplayQueue>> {
  if (!locationId) {
    return err(
      AppError.validation('display.errors.location_required'),
    );
  }

  const rows = await db
    .select({
      id: kdsOrderItems.id,
      pickupNumber: kdsOrderItems.pickupNumber,
      productSummary: kdsOrderItems.productSummary,
      status: kdsOrderItems.status,
      queuedAt: kdsOrderItems.queuedAt,
      makingAt: kdsOrderItems.makingAt,
      readyAt: kdsOrderItems.readyAt,
    })
    .from(kdsOrderItems)
    .where(
      and(
        eq(kdsOrderItems.locationId, locationId),
        inArray(kdsOrderItems.status, ['queued', 'making', 'ready']),
      ),
    )
    .orderBy(asc(kdsOrderItems.pickupNumber));

  const grouped = groupDisplayItems(rows);

  return ok({
    locationId,
    timestamp: new Date(),
    ...grouped,
  });
}

// ─── SSE helpers ────────────────────────────────────────────────────────────

export function formatSseEvent(event: DisplayEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createQueueUpdateEvent(
  locationId: string,
  queue: DisplayQueue,
): DisplayEvent {
  return {
    type: 'queue_update',
    locationId,
    timestamp: new Date(),
    data: queue,
  };
}

export function createItemChangeEvent(
  locationId: string,
  change: DisplayItemChange,
): DisplayEvent {
  return {
    type: 'item_status_change',
    locationId,
    timestamp: new Date(),
    data: change,
  };
}
