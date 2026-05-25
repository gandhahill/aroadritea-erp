/**
 * Shared SMTP transport — used by anywhere in the service layer that
 * needs to send a transactional email (member OTP, password reset,
 * shift assignment, …). Until T-0175 this lived inline in
 * `member/index.ts`; the shift notifier requires the same plumbing so
 * we factor it out.
 *
 * Config:
 *   - SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS /
 *     SMTP_FROM / SMTP_FROM_NAME (see docs/CONFIGURATION.md).
 *   - In development, when no SMTP host is configured, this returns
 *     ok(true) without sending (so local tests don't need MailHog set
 *     up). Production raises if config is missing.
 *
 * The function is a thin wrapper around nodemailer with safe defaults
 * (TLS, 10s connect timeout, 15s socket timeout). It never throws —
 * always returns `{ ok, error }` so callers can decide whether to
 * surface the failure or swallow it.
 */

import nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Set when the send was skipped (dev mode w/o SMTP) — caller may log. */
  skipped?: boolean;
  /** Error message; only present when ok=false. */
  error?: string;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const smtpHost = process.env.SMTP_HOST;
  const configuredPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpPort = Number.isFinite(configuredPort) ? configuredPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const smtpFromName = process.env.SMTP_FROM_NAME ?? 'Aroadri Tea';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, error: 'SMTP not configured (missing host/user/pass/from).' };
    }
    return { ok: true, skipped: true };
  }

  const secure =
    process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: smtpFrom.includes('<') ? smtpFrom : `${smtpFromName} <${smtpFrom}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
