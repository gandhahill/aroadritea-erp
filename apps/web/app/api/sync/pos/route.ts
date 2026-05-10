/**
 * POST /api/sync/pos — Idempotent POS transaction sync endpoint
 *
 * SD §10.3, §14.2, §35.1.1
 *
 * Receives a POS sale from the IndexedDB outbox (client-side).
 * Uses Idempotency-Key (client_order_uuid) to guarantee at-most-once semantics.
 *
 * Flow:
 * 1. Check Idempotency-Key header
 * 2. If sale already exists with same clientOrderUuid → return 409 (already synced)
 * 3. Validate input
 * 4. Call createSale service (writes sale + journal + audit)
 * 5. Return sale number
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, eq, and } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { createSale } from '@erp/services';
import type { AuditContext } from '@erp/shared/types';
import { CreateSaleInputSchema, type CreateSaleInput } from '@erp/services';

/** Re-export for Next.js edge */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Helper: get auth context from request ───────────────────────────────────

async function getAuditContext(req: NextRequest): Promise<AuditContext> {
  // For sync endpoint, we use a lightweight session check
  // The client sends a session token via cookie
  // In production: validate better-auth session from cookies
  const sessionToken = req.cookies.get('session')?.value ?? '';
  // TODO: validate better-auth session and extract userId/tenantId/locationId
  // For now, extract from a custom header set by the service worker
  const userId = req.headers.get('X-User-Id') ?? 'unknown';
  const tenantId = req.headers.get('X-Tenant-Id') ?? 'default';
  const locationId = req.headers.get('X-Location-Id') ?? req.headers.get('x-location-id') ?? 'unknown';
  const ipAddress = req.headers.get('x-forwarded-for') ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  return { userId, tenantId, locationId, ipAddress, userAgent };
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Idempotency-Key
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing Idempotency-Key header' },
        { status: 400 },
      );
    }

    // 2. Check if already processed (idempotency lookup)
    // idempotencyKey + locationId makes it unique per outlet
    const locationId = req.headers.get('X-Location-Id') ?? req.headers.get('x-location-id') ?? '';
    const existing = await db
      .select({ id: salesOrders.id, number: salesOrders.number })
      .from(salesOrders)
      .where(and(eq(salesOrders.idempotencyKey, idempotencyKey), eq(salesOrders.locationId, locationId)))
      .limit(1);

    const prev = existing[0];
    if (prev) {
      // Already processed — return 409 with the existing sale
      return NextResponse.json(
        { status: 'already_synced', saleNumber: prev.number, saleId: prev.id },
        { status: 409 },
      );
    }

    // 3. Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { clientOrderUuid, createdAtClient, payload } = body as {
      clientOrderUuid: string;
      createdAtClient: string;
      payload: unknown;
    };

    if (!clientOrderUuid || !payload) {
      return NextResponse.json({ error: 'Missing clientOrderUuid or payload' }, { status: 400 });
    }

    // 4. Validate payload against CreateSaleInput schema
    const inputResult = CreateSaleInputSchema.safeParse(payload);
    if (!inputResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: inputResult.error.issues },
        { status: 422 },
      );
    }

    // 5. Check client timestamp isn't too old (SD §14.5: max 24 hours)
    const clientTime = new Date(createdAtClient);
    const now = new Date();
    const diffHours = (now.getTime() - clientTime.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24) {
      return NextResponse.json(
        { error: 'Client timestamp too old (max 24 hours)' },
        { status: 422 },
      );
    }

    // 6. Build AuditContext
    const ctx = await getAuditContext(req);

    // 7. Create the sale
    const result = await createSale(inputResult.data as CreateSaleInput, ctx);

    if (!result.ok) {
      // Service returned an error — return as 422 (business/validation error)
      return NextResponse.json(
        {
          error: result.error.messageKey,
          details: result.error.details,
        },
        { status: 422 },
      );
    }

    // 8. Success
    return NextResponse.json(
      {
        status: 'synced',
        saleId: result.value.id,
        saleNumber: result.value.number,
        syncedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[sync/pos] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}