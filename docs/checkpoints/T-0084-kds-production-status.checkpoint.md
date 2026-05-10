# T-0084 — KDS Aroadri (production status: queued/making/ready)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §21.7

## Goal

Build the Aroadri-side KDS (Kitchen Display System) for tracking production status per order line item. This is separate from the Naixer machine — it's our internal kitchen workflow tracker.

## Plan

1. Schema: `kds_order_items` table in `packages/db/schema/kitchen.ts`
2. Service: KDS functions in `packages/services/src/kitchen/kds-service.ts`
   - `queueOrderItems(salesOrderId, ctx)` — creates KDS items from sales order lines
   - `updateItemStatus(itemId, newStatus, ctx)` — transitions status
   - `listKdsItems(locationId, filters, ctx)` — list by status/location
   - `getKdsStats(locationId, ctx)` — count per status
3. Unit tests for status transition validation
4. Export from kitchen barrel

## Status Flow

```
queued → making → ready → served
         ↘ (can also go back to queued if reset)
```

Valid transitions:
- queued → making
- making → ready
- ready → served
- Any → cancelled (voided order)

## Schema Design

`kds_order_items`:
- id (ULID)
- tenant_id
- location_id
- sales_order_id (FK)
- sales_order_line_id (FK)
- status: 'queued' | 'making' | 'ready' | 'served' | 'cancelled'
- queued_at
- making_at
- ready_at
- served_at
- prepared_by (FK users — who made it)
- pickup_number (display number for customer)
- product_summary (snapshot: product name + modifiers text)
- qr_payload (copy from sales_order_lines.kds_qr_payload)
- audit cols

## Next step

Implement schema and service.
