/**
 * Public API — submit a job application for a given opening.
 * Rate-limited via in-memory IP bucket (best-effort; production should
 * front this with Turnstile / hCaptcha).
 */

import { and, db, eq, isNull } from '@erp/db';
import { jobApplicants, jobOpenings } from '@erp/db/schema/hr';
import { encryptPii } from '@erp/services/security/pii';
import { clientIpFromHeaders } from '@erp/shared/client-ip';
import { generateId } from '@erp/shared/id';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip);
  if (!bucket || bucket.resetAt < now) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (RATE_LIMIT.size > 10_000) {
      for (const [key, val] of RATE_LIMIT) {
        if (val.resetAt < now) RATE_LIMIT.delete(key);
      }
    }
    return false;
  }
  if (bucket.count >= MAX_PER_WINDOW) return true;
  bucket.count += 1;
  return false;
}

const ERROR_CODES = {
  INVALID_JSON: 'careers.error.invalidJson',
  NAME_REQUIRED: 'careers.error.nameRequired',
  FIELD_TOO_LONG: 'careers.error.fieldTooLong',
  OPENING_NOT_FOUND: 'careers.error.openingNotFound',
  OPENING_CLOSED: 'careers.error.openingClosed',
  RATE_LIMITED: 'careers.error.rateLimited',
} as const;

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.RATE_LIMITED },
      { status: 429 },
    );
  }

  let body: {
    openingId?: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    notes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.INVALID_JSON },
      { status: 400 },
    );
  }

  const openingId = String(body.openingId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const notes = String(body.notes ?? '').trim();

  if (!openingId || !name) {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.NAME_REQUIRED },
      { status: 400 },
    );
  }
  if (name.length > 128 || notes.length > 2000) {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.FIELD_TOO_LONG },
      { status: 400 },
    );
  }

  const [opening] = await db
    .select({ id: jobOpenings.id, status: jobOpenings.status })
    .from(jobOpenings)
    .where(
      and(
        eq(jobOpenings.id, openingId),
        eq(jobOpenings.tenantId, 'default'),
        isNull(jobOpenings.deletedAt),
      ),
    )
    .limit(1);
  if (!opening) {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.OPENING_NOT_FOUND },
      { status: 404 },
    );
  }
  if (opening.status !== 'open') {
    return NextResponse.json(
      { ok: false, error: ERROR_CODES.OPENING_CLOSED },
      { status: 409 },
    );
  }

  const id = generateId();
  await db.insert(jobApplicants).values({
    id,
    tenantId: 'default',
    openingId,
    name,
    email: email || null,
    phone: phone ? encryptPii(phone, 'job_applicants.phone') : null,
    stage: 'applied',
    notes: notes || null,
    createdBy: 'public_career_form',
    updatedBy: 'public_career_form',
  });

  return NextResponse.json({ ok: true, id });
}
