/**
 * POST /api/error-report — receive client-side and server-side error reports,
 * then fan out an in-app notification to all users with `helpdesk.handle`
 * permission. Includes full stack trace so the dev doesn't need to check
 * PM2 / browser console manually.
 *
 * Body: { message, stack?, url?, source, userAgent?, componentStack?, extra? }
 */

import { getSession } from '@/lib/auth';
import { notifyByPermission } from '@erp/services/notification';
import { NextResponse } from 'next/server';

interface ErrorReportBody {
  message: string;
  stack?: string;
  url?: string;
  /** 'client' | 'server' | 'unhandledrejection' */
  source: string;
  userAgent?: string;
  componentStack?: string;
  extra?: string;
}

const MAX_BODY_LENGTH = 2000;

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ErrorReportBody;

    // Rate-limit: we don't want a broken loop to DDoS the notification table.
    // Simple in-memory token bucket — 10 reports per minute per server instance.
    const now = Date.now();
    if (now - lastReset > 60_000) {
      tokenBucket = 10;
      lastReset = now;
    }
    if (tokenBucket <= 0) {
      return NextResponse.json({ ok: true, throttled: true }, { status: 200 });
    }
    tokenBucket--;

    // Try to get session for tenant context
    let tenantId = 'default';
    let userId = 'unknown';
    let userEmail = '';
    try {
      const session = await getSession();
      if (session?.user) {
        const user = session.user as Record<string, unknown>;
        tenantId = String(user.tenantId ?? 'default');
        userId = String(user.id ?? 'unknown');
        userEmail = String(user.email ?? '');
      }
    } catch {
      // Session may not be available for unauthenticated errors
    }

    const sourceLabel =
      body.source === 'client'
        ? '🖥️ Client Error'
        : body.source === 'unhandledrejection'
          ? '🖥️ Unhandled Promise Rejection'
          : '⚙️ Server Error';

    const title = `${sourceLabel}: ${truncate(body.message, 120)}`;

    // Build a log-style body similar to PM2 log format
    const logLines: string[] = [];
    logLines.push(`[${new Date().toISOString()}] ${sourceLabel}`);
    logLines.push(`Message: ${truncate(body.message, 500)}`);
    if (body.url) logLines.push(`URL: ${body.url}`);
    if (userEmail) logLines.push(`User: ${userEmail} (${userId})`);
    if (body.userAgent) logLines.push(`UA: ${truncate(body.userAgent, 200)}`);
    if (body.stack) {
      logLines.push('--- Stack Trace ---');
      logLines.push(truncate(body.stack, 800));
    }
    if (body.componentStack) {
      logLines.push('--- Component Stack ---');
      logLines.push(truncate(body.componentStack, 500));
    }
    if (body.extra) {
      logLines.push('--- Extra ---');
      logLines.push(truncate(body.extra, 300));
    }

    const notifBody = logLines.join('\n').slice(0, MAX_BODY_LENGTH);

    await notifyByPermission({
      tenantId,
      kind: 'error',
      title,
      body: notifBody,
      link: body.url ?? '/dashboard',
      permission: 'helpdesk.handle',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // The error reporter itself must never crash visibly
    console.error('[error-report] Failed to process error report:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Simple in-memory rate limiter
let tokenBucket = 10;
let lastReset = Date.now();
