# T-0085i — Customer-facing display service (SSE)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §21.4

## Goal

Service layer for the customer-facing display at each location. Shows pickup numbers and production status (queued/making/ready). Designed for SSE subscription from `/display/:locationId`.

## Plan

1. Service: `getDisplayQueue(locationId)` — returns active items (not served/cancelled) grouped by status
2. Types for SSE events
3. Unit tests for grouping/sorting logic
4. Export from kitchen barrel

## Display Data

- Show items with status: queued, making, ready
- Group by status for column display
- Sort by pickup number within each group
- Ready items auto-hide after configurable timeout (handled by frontend)

## Files

- `packages/services/src/kitchen/display-service.ts`
- `packages/services/tests/display-service.test.ts`

## Next step

Implement service.
