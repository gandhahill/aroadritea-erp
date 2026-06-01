/**
 * Auth API route — mounts better-auth handler.
 * SD §11.1: All auth endpoints served via /api/auth/*
 */

import { createHash } from 'node:crypto';
import { and, db, eq, sql } from '@erp/db';
import { loginAttempts } from '@erp/db/schema/auth';
import { auth } from '@erp/services/auth';
import { clientIpFromHeaders } from '@erp/shared/client-ip';
import { generateId } from '@erp/shared/id';
import { toNextJsHandler } from 'better-auth/next-js';

const handlers = toNextJsHandler(auth);
const LOGIN_FAILURE_LIMIT = 5;
const ATTACK_FAILURE_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECS = 15 * 60; // 15 minutes
const ATTACK_LIMIT_WINDOW_SECS = 60 * 60; // 1 hour

function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: { message: 'RATE_LIMITED', retryAfter } },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  );
}

export const GET = handlers.GET;

async function getEmailFromRequest(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.clone().json()) as { email?: unknown };
      return typeof body.email === 'string' ? body.email.toLowerCase().trim() : null;
    }

    if (contentType.includes('form')) {
      const form = await request.clone().formData();
      const email = form.get('email');
      return typeof email === 'string' ? email.toLowerCase().trim() : null;
    }
  } catch {
    return null;
  }

  return null;
}

function hashEmail(email: string | null): string | null {
  if (!email) return null;
  return createHash('sha256').update(email).digest('hex');
}

async function assertLoginAllowed(
  ipAddress: string,
  emailHash: string | null,
): Promise<Response | null> {
  // When IP is 'direct' (proxy headers not trusted), all requests share the
  // same fake IP, making per-IP throttling useless and causing false lockouts.
  // Skip IP-based checks in that case — per-email check still protects.
  const hasRealIp = ipAddress !== 'direct';

  if (hasRealIp) {
    const recentIpFailures = await db
      .select({ oldest: sql<Date>`min(${loginAttempts.attemptedAt})` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.succeeded, false),
          sql`${loginAttempts.attemptedAt} >= now() - interval '15 minutes'`,
        ),
      )
      .having(sql`count(*) >= ${LOGIN_FAILURE_LIMIT}`);

    if (recentIpFailures.length > 0) {
      const oldest = recentIpFailures[0]!.oldest;
      const elapsed = Math.floor((Date.now() - new Date(oldest).getTime()) / 1000);
      return rateLimitResponse(Math.max(1, RATE_LIMIT_WINDOW_SECS - elapsed));
    }

    const hourlyIpFailures = await db
      .select({ oldest: sql<Date>`min(${loginAttempts.attemptedAt})` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.succeeded, false),
          sql`${loginAttempts.attemptedAt} >= now() - interval '1 hour'`,
        ),
      )
      .having(sql`count(*) >= ${ATTACK_FAILURE_LIMIT}`);

    if (hourlyIpFailures.length > 0) {
      const oldest = hourlyIpFailures[0]!.oldest;
      const elapsed = Math.floor((Date.now() - new Date(oldest).getTime()) / 1000);
      return rateLimitResponse(Math.max(1, ATTACK_LIMIT_WINDOW_SECS - elapsed));
    }
  }

  if (!emailHash) return null;

  const recentAccountFailures = await db
    .select({ oldest: sql<Date>`min(${loginAttempts.attemptedAt})` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.emailHash, emailHash),
        eq(loginAttempts.succeeded, false),
        sql`${loginAttempts.attemptedAt} >= now() - interval '15 minutes'`,
      ),
    )
    .having(sql`count(*) >= ${LOGIN_FAILURE_LIMIT}`);

  if (recentAccountFailures.length > 0) {
    const oldest = recentAccountFailures[0]!.oldest;
    const elapsed = Math.floor((Date.now() - new Date(oldest).getTime()) / 1000);
    return rateLimitResponse(Math.max(1, RATE_LIMIT_WINDOW_SECS - elapsed));
  }

  return null;
}

async function recordLoginAttempt(
  ipAddress: string,
  emailHash: string | null,
  userAgent: string | null,
  succeeded: boolean,
) {
  await db.insert(loginAttempts).values({
    id: generateId(),
    emailHash,
    ipAddress,
    userAgent,
    succeeded,
  });
}

export async function POST(request: Request) {
  const isEmailLogin = new URL(request.url).pathname.endsWith('/sign-in/email');
  if (!isEmailLogin) return handlers.POST(request);

  const ipAddress = clientIpFromHeaders(request.headers);
  const emailHash = hashEmail(await getEmailFromRequest(request));
  const userAgent = request.headers.get('user-agent');

  const blockedResponse = await assertLoginAllowed(ipAddress, emailHash);
  if (blockedResponse) {
    await recordLoginAttempt(ipAddress, emailHash, userAgent, false);
    return blockedResponse;
  }

  try {
    const response = await handlers.POST(request);
    await recordLoginAttempt(ipAddress, emailHash, userAgent, response.status < 400);
    return response;
  } catch (err) {
    await recordLoginAttempt(ipAddress, emailHash, userAgent, false);
    throw err;
  }
}
