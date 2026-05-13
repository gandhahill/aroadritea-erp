/**
 * Outage Notification Job — SD §35.1.6
 *
 * Runs every 5 minutes. Pings healthz endpoints of web, mcp, worker.
 * After 3 consecutive failures (15 min), sends WhatsApp + email alerts.
 * After recovery, sends "resolved" notification.
 *
 * State is stored in-memory per worker instance (ephemeral restart = reset).
 * For persistent state, use the `outage_notifications` table's `incident_resolved_at` column.
 */

import { and, db, desc, eq, gte } from '@erp/db';
import { notificationChannels, outageNotifications } from '@erp/db/schema/notification';

export interface OutageMonitorJobData {
  tenantId?: string;
  /** How many consecutive failures before alerting. Default: 3. */
  failureThreshold?: number;
  /** Cron interval in minutes. Default: 5. */
  intervalMinutes?: number;
}

// ─── Service targets ─────────────────────────────────────────────────────────

interface HealthTarget {
  name: string;
  url: string;
}

function getTargets(): HealthTarget[] {
  const webUrl = process.env.WEB_HEALTH_URL ?? 'http://localhost:3000/api/healthz';
  const mcpUrl = process.env.MCP_HEALTH_URL ?? 'http://localhost:3001/api/healthz';
  const workerUrl = process.env.WORKER_HEALTH_URL ?? 'http://localhost:3002/api/healthz';
  return [
    { name: 'web', url: webUrl },
    { name: 'mcp', url: mcpUrl },
    { name: 'worker', url: workerUrl },
  ];
}

// ─── Health check ────────────────────────────────────────────────────────────

async function checkHealth(
  target: HealthTarget,
): Promise<{ ok: boolean; statusCode: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(target.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'aroadri-erp-worker/1.0 outage-monitor' },
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { ok: true, statusCode: res.status, latencyMs };
    } else {
      return {
        ok: false,
        statusCode: res.status,
        latencyMs,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      statusCode: 0,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Notification ────────────────────────────────────────────────────────────

interface OutageMessage {
  subject: string;
  body: string;
}

function buildAlertMessage(
  service: string,
  url: string,
  since: Date,
  lastError: string,
): OutageMessage {
  const ts = new Date().toISOString();
  const duration = formatDuration(Date.now() - since.getTime());
  return {
    subject: `[ALERT] Aroadri ERP — ${service.toUpperCase()} DOWN`,
    body: `⚠️ OUTAGE ALERT\n\nService: ${service}\nURL: ${url}\nDown since: ${since.toISOString()} (${duration})\nLast error: ${lastError}\nDetected at: ${ts}\n\nPlease check the service immediately.`,
  };
}

function buildRecoveryMessage(service: string, url: string, durationMs: number): OutageMessage {
  const ts = new Date().toISOString();
  return {
    subject: `[RECOVERED] Aroadri ERP — ${service.toUpperCase()} back online`,
    body: `✅ SERVICE RECOVERED\n\nService: ${service}\nURL: ${url}\nDowntime: ${formatDuration(durationMs)}\nRecovered at: ${ts}\n\nThe service is now responding normally.`,
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ─── Email sender (nodemailer) ───────────────────────────────────────────────

async function sendEmail(
  to: string,
  msg: OutageMessage,
): Promise<{ sent: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddr = process.env.SMTP_FROM ?? 'noreply@aroadritea.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { sent: false, error: 'SMTP env vars not configured' };
  }

  try {
    // Dynamic import to avoid requiring nodemailer in production if not used
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `Aroadri ERP <${fromAddr}>`,
      to,
      subject: msg.subject,
      text: msg.body,
    });

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── WhatsApp sender (Twilio) ────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return { sent: false, error: 'Twilio env vars not configured' };
  }

  try {
    const credentials = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: twilioFrom,
          To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
          Body: body,
        }),
      },
    );

    if (!res.ok) {
      const body2 = await res.text();
      return { sent: false, error: `Twilio ${res.status}: ${body2}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── State ─────────────────────────────────────────────────────────────────

// In-memory failure tracking per service (resets on worker restart)
const failureCount = new Map<string, number>(); // serviceName → consecutive failure count
const firstFailure = new Map<string, Date>(); // serviceName → first failure timestamp
const lastNotifiedAt = new Map<string, Date>(); // serviceName → last alert timestamp
const wasDown = new Set<string>(); // services that were in alert state

const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // Don't re-alert within 30 min

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function outageMonitorHandler(data: OutageMonitorJobData): Promise<void> {
  const tenantId = data.tenantId ?? 'default';
  const failureThreshold = data.failureThreshold ?? 3;

  console.info('[outage-monitor] Starting health check run');

  // 1. Fetch active notification channels for this tenant
  let channels: Array<{ id: string; channelType: string; target: string }> = [];
  try {
    channels = await db
      .select({
        id: notificationChannels.id,
        channelType: notificationChannels.channelType,
        target: notificationChannels.target,
      })
      .from(notificationChannels)
      .where(
        and(eq(notificationChannels.tenantId, tenantId), eq(notificationChannels.isActive, true)),
      );
  } catch (err) {
    console.warn(
      '[outage-monitor] Could not fetch notification channels, continuing without alerts',
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  // 2. Check each service
  const targets = getTargets();

  for (const target of targets) {
    const result = await checkHealth(target);

    if (!result.ok) {
      const count = (failureCount.get(target.name) ?? 0) + 1;
      failureCount.set(target.name, count);
      if (count === 1) firstFailure.set(target.name, new Date());

      console.warn(`[outage-monitor] ${target.name} DOWN (failure #${count})`, {
        url: target.url,
        error: result.error,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
      });

      // 3. Alert when threshold reached and cooldown elapsed
      if (count >= failureThreshold) {
        const since = firstFailure.get(target.name) ?? new Date();
        const lastAlert = lastNotifiedAt.get(target.name);
        const cooldownElapsed = !lastAlert || Date.now() - lastAlert.getTime() > ALERT_COOLDOWN_MS;

        if (!wasDown.has(target.name) || cooldownElapsed) {
          console.error(
            `[outage-monitor] ALERT: ${target.name} down since ${since.toISOString()}`,
            { url: target.url },
          );

          const msg = buildAlertMessage(
            target.name,
            target.url,
            since,
            result.error ?? 'Unknown error',
          );
          await sendAlerts(channels, target.name, target.url, since, msg, 'down');

          wasDown.add(target.name);
          lastNotifiedAt.set(target.name, new Date());
        }
      }
    } else {
      // Health check passed
      const prevFailures = failureCount.get(target.name) ?? 0;
      failureCount.set(target.name, 0);
      firstFailure.delete(target.name);

      if (result.ok && wasDown.has(target.name)) {
        // Service recovered
        const downSince = firstFailure.get(target.name);
        const durationMs = downSince ? Date.now() - downSince.getTime() : 0;

        console.info(`[outage-monitor] ${target.name} RECOVERED`, {
          url: target.url,
          latencyMs: result.latencyMs,
          wasDownFor: formatDuration(durationMs),
        });

        const msg = buildRecoveryMessage(target.name, target.url, durationMs);
        await sendAlerts(
          channels,
          target.name,
          target.url,
          downSince ?? new Date(),
          msg,
          'recovery',
        );

        wasDown.delete(target.name);
      }
    }
  }

  console.info('[outage-monitor] Health check run complete');
}

async function sendAlerts(
  channels: Array<{ id: string; channelType: string; target: string }>,
  serviceName: string,
  url: string,
  since: Date,
  msg: OutageMessage,
  eventType: 'down' | 'recovery',
): Promise<void> {
  for (const channel of channels) {
    try {
      let sent = false;
      let deliveryError: string | undefined;

      if (channel.channelType === 'email') {
        const result = await sendEmail(channel.target, msg);
        sent = result.sent;
        deliveryError = result.error;
      } else if (channel.channelType === 'whatsapp') {
        const result = await sendWhatsApp(channel.target, msg.body);
        sent = result.sent;
        deliveryError = result.error;
      } else {
        console.warn(`[outage-monitor] Unknown channel type: ${channel.channelType}`);
        continue;
      }

      // Log notification to DB
      await db.insert(outageNotifications).values({
        id: crypto.randomUUID(),
        tenantId: 'default',
        serviceName,
        url,
        incidentStartedAt: since,
        incidentResolvedAt: eventType === 'recovery' ? new Date() : null,
        sentAt: new Date(),
        channelType: channel.channelType,
        recipientTarget: channel.target,
        messageText: msg.body,
        deliveryStatus: sent ? 'sent' : 'failed',
        deliveryError: deliveryError ?? null,
        createdBy: 'system',
        updatedBy: 'system',
      });

      console.info(
        `[outage-monitor] Notification ${sent ? 'sent' : 'FAILED'} via ${channel.channelType} to ${channel.target}`,
        { deliveryError },
      );
    } catch (err) {
      console.error(`[outage-monitor] Failed to send ${channel.channelType} notification`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
