import { db } from '@erp/db';
import { idempotencyRecords } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import { and, eq } from 'drizzle-orm';

export interface IdempotencyClaim {
  id: string;
}

/**
 * Validates whether an idempotency key has already been used successfully,
 * and claims it if not. This prevents concurrent duplicate requests.
 *
 * @param locationId Branch location ID
 * @param idempotencyKey The unique idempotency key from the client
 * @param actionName Context for the error message (e.g. 'pos.createSale')
 */
export async function claimIdempotency(
  locationId: string,
  idempotencyKey: string,
  actionName: string,
): Promise<Result<IdempotencyClaim>> {
  // 1. Check existing
  const existing = await db
    .select()
    .from(idempotencyRecords)
    .where(
      and(
        eq(idempotencyRecords.locationId, locationId),
        eq(idempotencyRecords.idempotencyKey, idempotencyKey),
      ),
    )
    .then((r) => r[0]);

  if (existing) {
    if (existing.responseStatus >= 500) {
      // Previous attempt failed with 500. We can retry by overwriting later.
      return ok({ id: existing.id });
    }
    const cachedBody = existing.responseBody as Record<string, unknown> | null;
    return err(
      AppError.conflict(`${actionName}.duplicateRequest`, {
        idempotencyKey,
        responseStatus: existing.responseStatus,
        cachedResponse: cachedBody,
      }),
    );
  }

  // 2. Claim (HTTP 102 Processing)
  const expiryAt = new Date();
  expiryAt.setHours(expiryAt.getHours() + 24);
  const idempotencyId = generateId();

  const claimRows = await db
    .insert(idempotencyRecords)
    .values({
      id: idempotencyId,
      idempotencyKey,
      locationId,
      responseStatus: 102,
      responseBody: { status: 'processing' } as never,
      createdAt: new Date(),
      expiresAt: expiryAt,
    })
    .onConflictDoNothing({
      target: [idempotencyRecords.idempotencyKey, idempotencyRecords.locationId],
    })
    .returning({ id: idempotencyRecords.id });

  if (claimRows.length === 0) {
    // Inserted by another racing thread!
    return err(
      AppError.conflict(`${actionName}.idempotencyInProgress`, {
        idempotencyKey,
      }),
    );
  }

  return ok({ id: idempotencyId });
}

/**
 * Saves the idempotency record after a successful mutation.
 * This should ideally be called INSIDE the database transaction
 * that performs the mutation to ensure atomicity.
 */
export async function saveIdempotency(
  tx: any,
  locationId: string,
  idempotencyKey: string,
  responseStatus: number,
  responseBody: unknown,
) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour TTL

  await tx
    .insert(idempotencyRecords)
    .values({
      idempotencyKey,
      locationId,
      responseStatus,
      responseBody: responseBody || null,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [idempotencyRecords.idempotencyKey, idempotencyRecords.locationId],
      set: {
        responseStatus,
        responseBody: responseBody || null,
        expiresAt,
      },
    });
}

/**
 * Clears an idempotency claim if the request failed with a 4xx or 5xx.
 */
export async function releaseIdempotencyClaim(
  idempotencyId: string,
  errorStatus: number,
  errorBody: unknown,
) {
  await db
    .update(idempotencyRecords)
    .set({
      responseStatus: errorStatus,
      responseBody: errorBody as never,
    })
    .where(eq(idempotencyRecords.id, idempotencyId));
}
