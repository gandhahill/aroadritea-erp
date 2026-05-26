/**
 * POST /api/sync/pos - Idempotent POS transaction sync endpoint.
 *
 * Receives a POS sale from the IndexedDB outbox. Identity is always resolved
 * from the DB-backed better-auth session; client identity headers are ignored.
 */

import { and, db, eq } from '@erp/db';
import { salesOrders } from '@erp/db/schema/pos';
import { auth } from '@erp/services/auth';
import { type CreateSaleInput, CreateSaleInputSchema, createSale } from '@erp/services/pos';
import { clientIpFromHeaders } from '@erp/shared/client-ip';
import type { AuditContext } from '@erp/shared/types';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getAuditContext(req: NextRequest, locationId: string): Promise<AuditContext | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? '');
  if (!userId || !tenantId) return null;

  return {
    userId,
    tenantId,
    locationId,
    ipAddress: clientIpFromHeaders(req.headers),
    userAgent: req.headers.get('user-agent') ?? undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Missing Idempotency-Key header' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { clientOrderUuid, createdAtClient, payload } = body as {
      clientOrderUuid?: string;
      createdAtClient?: string;
      payload?: unknown;
    };

    if (!clientOrderUuid || !payload) {
      return NextResponse.json({ error: 'Missing clientOrderUuid or payload' }, { status: 400 });
    }
    if (clientOrderUuid !== idempotencyKey) {
      return NextResponse.json(
        { error: 'Idempotency-Key must match clientOrderUuid' },
        { status: 400 },
      );
    }

    const inputResult = CreateSaleInputSchema.safeParse(payload);
    if (!inputResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: inputResult.error.issues },
        { status: 422 },
      );
    }
    const input = inputResult.data as CreateSaleInput;

    const ctx = await getAuditContext(req, input.locationId);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await db
      .select({ id: salesOrders.id, number: salesOrders.number })
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.idempotencyKey, idempotencyKey),
          eq(salesOrders.tenantId, ctx.tenantId),
          eq(salesOrders.locationId, input.locationId),
        ),
      )
      .limit(1);

    const prev = existing[0];
    if (prev) {
      return NextResponse.json(
        { status: 'already_synced', saleNumber: prev.number, saleId: prev.id },
        { status: 200 },
      );
    }

    const clientTime = new Date(createdAtClient ?? '');
    if (Number.isNaN(clientTime.getTime())) {
      return NextResponse.json({ error: 'Invalid createdAtClient timestamp' }, { status: 400 });
    }

    const nowMs = new Date().getTime();
    const diffHours = (nowMs - clientTime.getTime()) / (1000 * 60 * 60);
    if (diffHours < -5 / 60) {
      return NextResponse.json(
        { error: 'Client timestamp is too far in the future' },
        { status: 422 },
      );
    }
    if (diffHours > 24) {
      return NextResponse.json(
        { error: 'Client timestamp too old (max 24 hours)' },
        { status: 422 },
      );
    }

    const result = await createSale(input, ctx);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error.messageKey,
          details: result.error.details,
        },
        { status: result.error.httpStatus },
      );
    }

    return NextResponse.json(
      {
        status: 'synced',
        saleId: result.value.id,
        saleNumber: result.value.number,
        syncedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
