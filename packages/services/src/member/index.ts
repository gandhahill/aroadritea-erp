import { createHash, randomBytes, randomInt } from 'node:crypto';
import { db } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import {
  memberCredentials,
  memberLoyalty,
  memberOtpCodes,
  memberPointsTransactions,
  memberSessions,
  memberSignupAttempts,
  memberVouchers,
} from '@erp/db/schema/member';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
/**
 * Member Service — SD §31.5, §31.6
 *
 * Member registration, OTP authentication, session management, loyalty.
 * All reads are server-side (site app); writes go through this service.
 */
import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { decryptPii, encryptPii, encryptPiiForLookup } from '../security/pii';
import {
  buildOtpEmailHtml,
  buildPasswordResetEmailHtml,
  buildWelcomeEmailHtml,
} from './email-templates';
import { hashMemberPassword, verifyMemberPassword } from './password';

// ─── Rate limiting constants ───────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const RATE_LIMIT_SIGNUP_PER_IP = 3; // per hour
const TOKEN_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const SignupInputSchema = z.object({
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\+?[0-9]+$/, 'Invalid phone number'),
  name: z.string().min(2).max(100),
  birthDate: z.string().min(10, 'Birth date is required'), // YYYY-MM-DD
  city: z.string().min(1, 'City is required'),
  password: z.string().min(8).max(128),
  consentGiven: z.boolean().refine((v) => v === true, 'Consent is required'),
  turnstileToken: z.preprocess((value) => {
    if (typeof value !== 'string') return 'captcha-unreachable';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'captcha-unreachable';
  }, z.string().min(1)), // Cloudflare Turnstile token or explicit unreachable-provider sentinel
});

export const VerifyOtpInputSchema = z.object({
  token: z.string().min(1), // short-lived token from signup step
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const RetryOtpInputSchema = z.object({
  token: z.string().min(1),
});

export const CompleteSignupInputSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  birthDate: z.string().trim().min(10).optional(),
  city: z.string().trim().min(1).optional(),
  password: z.string().min(8).max(128).optional(),
  consentGiven: z.boolean().refine((v) => v === true, 'Consent is required'),
});

export const RequestPasswordResetInputSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(['id', 'en', 'zh']).optional().default('id'),
});

export const CompletePasswordResetInputSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;
export type RetryOtpInput = z.infer<typeof RetryOtpInputSchema>;
export type CompleteSignupInput = z.infer<typeof CompleteSignupInputSchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetInputSchema>;
export type CompletePasswordResetInput = z.infer<typeof CompletePasswordResetInputSchema>;

export const MemberPhoneLookupInputSchema = z.object({
  phone: z.string().min(8).max(32),
});

export type MemberPhoneLookupInput = z.infer<typeof MemberPhoneLookupInputSchema>;

export interface MemberLookupResult {
  memberId: string;
  name: string;
  phone: string | null;
  loyaltyTier: string;
  points: number;
  lifetimePoints: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function sanitizeCause(cause: unknown): Record<string, unknown> {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      ...(cause.cause ? { cause: String(cause.cause) } : {}),
    };
  }
  return { message: String(cause) };
}

function internalWithDetails(messageKey: string, cause: unknown): AppError {
  return new AppError('INTERNAL', messageKey, sanitizeCause(cause), cause);
}

function assertPiiEncryptionConfigured(): Result<true> {
  try {
    encryptPii('pii-preflight@example.invalid', 'partners.email');
    return ok(true);
  } catch (error) {
    return err(internalWithDetails('member.signup.piiEncryptionNotConfigured', error));
  }
}

function parseOptionalBirthDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeMemberPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function buildPhoneLookupCandidates(phone: string): string[] {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizeMemberPhone(phone);
  const candidates = new Set<string>();

  for (const value of [raw, digits, normalized]) {
    if (!value) continue;
    candidates.add(value);
    candidates.add(`+${value}`);
  }

  if (normalized.startsWith('62') && normalized.length > 2) {
    candidates.add(`0${normalized.slice(2)}`);
    candidates.add(`+62${normalized.slice(2)}`);
  }

  return [...candidates].filter((value) => value.length >= 8);
}

async function verifyTurnstile(token: string, ipAddress?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production' && token === 'dev-token';

  // Cloudflare Turnstile is unreachable from mainland China. The client
  // sets this sentinel when challenges.cloudflare.com fails to load so the
  // signup form does not deadlock. Bot protection still relies on the
  // mandatory email OTP downstream + per-IP rate limiting elsewhere.
  if (token === 'captcha-unreachable') {
    if (process.env.TURNSTILE_ALLOW_BYPASS === 'false') return false;
    return true;
  }

  const formData = new FormData();
  formData.set('secret', secret);
  formData.set('response', token);
  if (ipAddress) formData.set('remoteip', ipAddress);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      // 5s upper bound — siteverify is normally <500ms; if Cloudflare is
      // unreachable from the server too we fail open with OTP fallback
      // rather than block legitimate signups.
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { success?: boolean };
    return payload.success === true;
  } catch {
    // Network/timeout — allow OTP step to gate the registration.
    return process.env.TURNSTILE_ALLOW_BYPASS !== 'false';
  }
}

type EmailLocale = 'id' | 'en' | 'zh';

function normalizeEmailLocale(locale?: string): EmailLocale {
  return locale === 'en' || locale === 'zh' ? locale : 'id';
}

function publicSiteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://aroadritea.com'
  ).replace(/\/$/, '');
}

interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  missingConfigKey: string;
  sendFailedKey: string;
  devLog?: string;
}

async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<Result<void>> {
  const smtpHost = process.env.SMTP_HOST;
  const configuredPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpPort = Number.isFinite(configuredPort) ? configuredPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const smtpFromName = process.env.SMTP_FROM_NAME ?? 'Aroadri Tea';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    if (process.env.NODE_ENV === 'production') {
      return err(AppError.internal(input.missingConfigKey));
    }
    if (input.devLog) console.info(input.devLog);
    return ok(undefined);
  }

  try {
    const secure =
      process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
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

    return ok(undefined);
  } catch (error) {
    return err(
      AppError.internal(input.sendFailedKey, {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function sendSignupOtp(
  email: string,
  code: string,
  locale: EmailLocale,
): Promise<Result<void>> {
  return sendTransactionalEmail({
    to: email,
    subject:
      locale === 'en'
        ? 'Your Aroadri Tea OTP Code'
        : locale === 'zh'
          ? 'Aroadri Tea OTP Verification Code'
          : 'Kode OTP Aroadri Tea',
    text:
      locale === 'en'
        ? `Your Aroadri Tea OTP code: ${code}. This code is valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`
        : locale === 'zh'
          ? `Your Aroadri Tea OTP code: ${code}. This code is valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`
          : `Kode OTP Aroadri Tea Anda: ${code}. Kode berlaku ${OTP_EXPIRY_MINUTES} menit. Jangan bagikan kode ini kepada siapapun.`,
    html: buildOtpEmailHtml(code, OTP_EXPIRY_MINUTES, locale),
    missingConfigKey: 'member.signup.otpProviderNotConfigured',
    sendFailedKey: 'member.signup.otpSendFailed',
    devLog: `[member] Development OTP for ${email}: ${code}`,
  });
}

// ─── Signup ─────────────────────────────────────────────────────────────────

async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: EmailLocale,
): Promise<Result<void>> {
  const resetUrl = `${publicSiteBaseUrl()}/${locale}/member/reset-password?token=${encodeURIComponent(token)}`;
  return sendTransactionalEmail({
    to: email,
    subject:
      locale === 'en'
        ? 'Reset your Aroadri Tea password'
        : locale === 'zh'
          ? 'Reset your Aroadri Tea password'
          : 'Reset password Aroadri Tea',
    text:
      locale === 'en'
        ? `Open this link to reset your Aroadri Tea password. It is valid for ${PASSWORD_RESET_EXPIRY_MINUTES} minutes: ${resetUrl}`
        : locale === 'zh'
          ? `Open this link to reset your Aroadri Tea password. It is valid for ${PASSWORD_RESET_EXPIRY_MINUTES} minutes: ${resetUrl}`
          : `Buka tautan ini untuk mereset password Aroadri Tea Anda. Tautan berlaku ${PASSWORD_RESET_EXPIRY_MINUTES} menit: ${resetUrl}`,
    html: buildPasswordResetEmailHtml(resetUrl, PASSWORD_RESET_EXPIRY_MINUTES, locale),
    missingConfigKey: 'member.passwordReset.emailProviderNotConfigured',
    sendFailedKey: 'member.passwordReset.emailSendFailed',
    devLog: `[member] Development password reset link for ${email}: ${resetUrl}`,
  });
}

async function sendWelcomeEmail(
  email: string,
  memberName: string,
  locale: EmailLocale,
): Promise<Result<void>> {
  return sendTransactionalEmail({
    to: email,
    subject:
      locale === 'en'
        ? 'Welcome to Aroadri Tea'
        : locale === 'zh'
          ? 'Welcome to Aroadri Tea'
          : 'Selamat datang di Aroadri Tea',
    text:
      locale === 'en'
        ? `Welcome, ${memberName}. Your Aroadri Tea member account is active.`
        : locale === 'zh'
          ? `Welcome, ${memberName}. Your Aroadri Tea member account is active.`
          : `Selamat datang, ${memberName}. Akun member Aroadri Tea Anda sudah aktif.`,
    html: buildWelcomeEmailHtml(memberName, locale),
    missingConfigKey: 'member.welcome.emailProviderNotConfigured',
    sendFailedKey: 'member.welcome.emailSendFailed',
  });
}

/**
 * Step 1 of member signup: validate input, rate-limit, send OTP.
 * Returns a short-lived token to continue the flow.
 */
export async function initiateSignup(
  input: SignupInput,
  ipAddress?: string,
  userAgent?: string,
  locale?: string,
): Promise<Result<{ token: string }>> {
  const parsed = SignupInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.signup.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;
  const piiReady = assertPiiEncryptionConfigured();
  if (!piiReady.ok) return err(piiReady.error);

  const email = data.email.trim().toLowerCase();
  const normalizedPhone = normalizeMemberPhone(data.phone);
  const phoneCandidates = buildPhoneLookupCandidates(data.phone);

  const turnstileValid = await verifyTurnstile(data.turnstileToken, ipAddress);
  if (!turnstileValid) {
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email,
      phone: normalizedPhone || data.phone,
      ipAddress,
      userAgent,
      outcome: 'failed_captcha',
    });
    return err(AppError.forbidden('member.signup.captchaFailed'));
  }

  // Rate limit per IP
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = await db
    .select({ c: count() })
    .from(memberSignupAttempts)
    .where(
      ipAddress
        ? and(
            gte(memberSignupAttempts.attemptedAt, hourAgo),
            sql`${memberSignupAttempts.ipAddress} = ${ipAddress}`,
          )
        : sql`1=1`,
    );

  if ((recentAttempts[0]?.c ?? 0) >= RATE_LIMIT_SIGNUP_PER_IP) {
    return err(AppError.conflict('member.signup.rateLimited'));
  }

  // Check email not already registered. partners.email is encrypted at
  // rest (SD §25.1) so we compare against the deterministic ciphertext.
  const emailCipherSignup = encryptPiiForLookup(email, 'partners.email');
  const existing = await db
    .select({ id: partners.id })
    .from(partners)
    .where(
      and(
        eq(partners.tenantId, 'default'),
        or(eq(partners.email, emailCipherSignup ?? ''), sql`lower(${partners.email}) = ${email}`),
        eq(partners.kind, 'customer'),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email,
      phone: normalizedPhone || data.phone,
      ipAddress,
      userAgent,
      outcome: 'email_exists',
    });
    return err(AppError.conflict('member.signup.emailExists'));
  }

  // partners.phone is also encrypted — encrypt every dialing-format
  // candidate so we can detect duplicates regardless of how the new
  // signer typed the number.
  const phoneCipherCandidates = phoneCandidates
    .map((c) => encryptPiiForLookup(c, 'partners.phone'))
    .filter((c): c is string => Boolean(c));
  const existingPhone = phoneCipherCandidates.length
    ? await db
        .select({ id: partners.id })
        .from(partners)
        .where(
          and(
            eq(partners.tenantId, 'default'),
            eq(partners.kind, 'customer'),
            eq(partners.isMember, true),
            or(inArray(partners.phone, phoneCipherCandidates), inArray(partners.phone, phoneCandidates)),
          ),
        )
        .limit(1)
    : [];

  if (existingPhone[0]) {
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email,
      phone: normalizedPhone || data.phone,
      ipAddress,
      userAgent,
      outcome: 'phone_exists',
    });
    return err(AppError.conflict('member.signup.phoneExists'));
  }

  // Generate OTP + token
  const code = generateOtp();
  const token = generateToken();
  const codeHash = hashOtp(code);
  const expiresAt = minutesFromNow(OTP_EXPIRY_MINUTES);
  const tokenExpiresAt = minutesFromNow(TOKEN_EXPIRY_MINUTES);
  const passwordHash = await hashMemberPassword(data.password);

  // Store signup payload in encrypted JSON (for later account creation)
  const payloadJson = JSON.stringify({
    name: data.name,
    phone: normalizedPhone || data.phone,
    birthDate: data.birthDate,
    city: data.city,
    passwordHash,
    locale: normalizeEmailLocale(locale),
  });

  await db.insert(memberOtpCodes).values({
    id: crypto.randomUUID(),
    purpose: 'signup',
    channel: 'email',
    recipient: email,
    codeHash,
    expiresAt,
    attempts: 0,
    token,
    tokenExpiresAt,
    payloadJson,
  });

  const sendResult = await sendSignupOtp(email, code, normalizeEmailLocale(locale));
  if (!sendResult.ok) return sendResult;

  await db.insert(memberSignupAttempts).values({
    id: crypto.randomUUID(),
    email,
    phone: normalizedPhone || data.phone,
    ipAddress,
    userAgent,
    outcome: 'otp_sent',
  });

  // Development mode: return OTP in response so testers can verify without email.
  const devCode = process.env.NODE_ENV === 'development' ? code : undefined;
  return ok({ token: devCode ? `${token}:${code}` : token });
}

/**
 * Step 2 of member signup: verify OTP only.
 * After verification, caller must call `completeSignup` with the same token.
 */
export async function verifySignupOtp(
  input: VerifyOtpInput,
  ipAddress?: string,
  userAgent?: string,
): Promise<Result<{ verified: boolean }>> {
  const parsed = VerifyOtpInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.verifyOtp.validationFailed', { issues: parsed.error.issues }),
    );
  }

  // Parse token and dev-only code
  let token = input.token;
  let devCode: string | undefined;
  if (process.env.NODE_ENV === 'development') {
    const parts = input.token.split(':');
    if (parts.length >= 2) {
      token = parts[0] ?? token;
      devCode = parts[1];
    }
  }

  const otpRecords = await db
    .select()
    .from(memberOtpCodes)
    .where(and(eq(memberOtpCodes.token, token), eq(memberOtpCodes.purpose, 'signup')))
    .limit(1);

  const otpRecord = otpRecords[0];
  if (!otpRecord || otpRecord.consumedAt) {
    return err(AppError.notFound('member.verifyOtp.tokenInvalid'));
  }
  if (new Date() > otpRecord.expiresAt) {
    return err(AppError.conflict('member.verifyOtp.expired'));
  }
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return err(AppError.conflict('member.verifyOtp.maxAttemptsReached'));
  }

  const codeToCheck = devCode ?? input.code;
  const codeHash = hashOtp(codeToCheck);
  if (codeHash !== otpRecord.codeHash) {
    await db
      .update(memberOtpCodes)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(eq(memberOtpCodes.id, otpRecord.id));
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email: otpRecord.recipient,
      ipAddress,
      userAgent,
      outcome: 'failed_otp',
    });
    return err(AppError.conflict('member.verifyOtp.invalidCode'));
  }

  // Mark OTP as consumed
  await db
    .update(memberOtpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(memberOtpCodes.id, otpRecord.id));
  return ok({ verified: true });
}

/**
 * Step 3: Complete signup after OTP is verified.
 * Creates the partner record + member session.
 */
export async function completeSignup(
  input: CompleteSignupInput,
  ipAddress?: string,
  userAgent?: string,
  ctx?: AuditContext,
): Promise<Result<{ memberId: string; sessionToken: string }>> {
  const parsed = CompleteSignupInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.completeSignup.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }

  let token = input.token;
  if (process.env.NODE_ENV === 'development') {
    const parts = token.split(':');
    if (parts.length >= 2) token = parts[0] ?? token;
  }

  const otpRecords = await db
    .select()
    .from(memberOtpCodes)
    .where(and(eq(memberOtpCodes.token, token), eq(memberOtpCodes.purpose, 'signup')))
    .limit(1);

  const otpRecord = otpRecords[0];
  if (!otpRecord) return err(AppError.notFound('member.completeSignup.tokenInvalid'));
  if (!otpRecord.consumedAt) return err(AppError.conflict('member.completeSignup.otpNotVerified'));
  if (new Date() > otpRecord.tokenExpiresAt) {
    return err(AppError.conflict('member.completeSignup.tokenExpired'));
  }

  const piiReady = assertPiiEncryptionConfigured();
  if (!piiReady.ok) return err(piiReady.error);

  const email = otpRecord.recipient.trim().toLowerCase();

  // Parse stored payload
  let storedPayload: Record<string, string> = {};
  try {
    if (otpRecord.payloadJson) storedPayload = JSON.parse(otpRecord.payloadJson as string);
  } catch {
    /* use form data as fallback */
  }

  const name = input.name || storedPayload.name || email;
  const phone = storedPayload.phone ?? '';
  const passwordHash = input.password
    ? await hashMemberPassword(input.password)
    : storedPayload.passwordHash || '';
  const birthDate = input.birthDate || storedPayload.birthDate;
  const city = input.city || storedPayload.city;
  const parsedBirthDate = parseOptionalBirthDate(birthDate);

  if (!passwordHash) {
    return err(AppError.validation('member.completeSignup.passwordMissing'));
  }

  // Create partner record
  let memberId: string;
  try {
    // SD §25.1 / UU PDP: partners.email + partners.phone stored
    // encrypted at rest. Use deterministic encryptPiiForLookup for the
    // dedup query so the same plaintext yields the same ciphertext.
    const tenantId = ctx?.tenantId ?? 'default';
    const emailCipher = encryptPiiForLookup(email, 'partners.email');
    const phoneCipher = phone ? encryptPii(phone, 'partners.phone') : null;
    const existingPartner = await db
      .select({ id: partners.id, isMember: partners.isMember, phone: partners.phone })
      .from(partners)
      .where(
        and(
          eq(partners.tenantId, tenantId),
          or(eq(partners.email, emailCipher ?? ''), sql`lower(${partners.email}) = ${email}`),
          eq(partners.kind, 'customer'),
        ),
      )
      .limit(1);

    if (existingPartner[0]) {
      memberId = existingPartner[0].id;
      if (!existingPartner[0].isMember || existingPartner[0].phone !== phoneCipher) {
        await db
          .update(partners)
          .set({
            name,
            phone: phoneCipher ?? existingPartner[0].phone,
            birthDate: parsedBirthDate,
            city: city || null,
            isMember: true,
            updatedBy: ctx?.userId,
          })
          .where(eq(partners.id, memberId));
      }
    } else {
      memberId = crypto.randomUUID();
      await db.insert(partners).values({
        id: memberId,
        tenantId,
        name,
        kind: 'customer',
        email: emailCipher,
        phone: phoneCipher,
        birthDate: parsedBirthDate,
        city: city || null,
        isMember: true,
        createdBy: ctx?.userId,
        updatedBy: ctx?.userId,
      });
    }
  } catch (e) {
    return err(internalWithDetails('member.completeSignup.createFailed', e));
  }

  try {
    const existingCredential = await db
      .select({ id: memberCredentials.id })
      .from(memberCredentials)
      .where(eq(memberCredentials.memberId, memberId))
      .limit(1);

    if (existingCredential[0]) {
      await db
        .update(memberCredentials)
        .set({
          passwordHash,
          passwordUpdatedAt: new Date(),
          updatedBy: ctx?.userId ?? 'system',
        })
        .where(eq(memberCredentials.id, existingCredential[0].id));
    } else {
      await db.insert(memberCredentials).values({
        id: crypto.randomUUID(),
        memberId,
        passwordHash,
        createdBy: ctx?.userId ?? 'system',
        updatedBy: ctx?.userId ?? 'system',
      });
    }
  } catch (e) {
    return err(AppError.internal('member.completeSignup.credentialFailed', e));
  }

  // Create member session
  const sessionToken = randomBytes(48).toString('hex');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const expiresAt = minutesFromNow(30 * 24 * 60); // 30 days

  await db.insert(memberSessions).values({
    id: crypto.randomUUID(),
    memberId,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  // Create default loyalty record
  try {
    await db.insert(memberLoyalty).values({
      id: crypto.randomUUID(),
      memberId,
      createdBy: ctx?.userId ?? 'system',
      updatedBy: ctx?.userId ?? 'system',
    });
  } catch {
    /* loyalty may already exist */
  }

  // Mark signup as verified
  const recentAttempt = await db
    .select({ id: memberSignupAttempts.id })
    .from(memberSignupAttempts)
    .where(and(eq(memberSignupAttempts.email, email), eq(memberSignupAttempts.outcome, 'otp_sent')))
    .orderBy(desc(memberSignupAttempts.attemptedAt))
    .limit(1);

  if (recentAttempt[0]) {
    await db
      .update(memberSignupAttempts)
      .set({ outcome: 'otp_verified', partnerId: memberId })
      .where(eq(memberSignupAttempts.id, recentAttempt[0].id));
  }

  const welcomeLocale = normalizeEmailLocale(storedPayload.locale);
  await sendWelcomeEmail(email, name, welcomeLocale);

  return ok({ memberId, sessionToken });
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function requestMemberPasswordReset(
  input: RequestPasswordResetInput,
  ipAddress?: string,
  userAgent?: string,
): Promise<Result<{ sent: boolean }>> {
  const parsed = RequestPasswordResetInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.passwordReset.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const locale = normalizeEmailLocale(parsed.data.locale);
  const emailCipher = encryptPiiForLookup(email, 'partners.email');

  const [partner] = await db
    .select({
      id: partners.id,
      isActive: partners.isActive,
      isMember: partners.isMember,
    })
    .from(partners)
    .where(
      and(
        eq(partners.tenantId, 'default'),
        or(eq(partners.email, emailCipher ?? ''), sql`lower(${partners.email}) = ${email}`),
        eq(partners.kind, 'customer'),
      ),
    )
    .limit(1);

  await db.insert(memberSignupAttempts).values({
    id: crypto.randomUUID(),
    email,
    ipAddress,
    userAgent,
    outcome: 'password_reset_requested',
    partnerId: partner?.id,
  });

  if (!partner || !partner.isActive || !partner.isMember) {
    return ok({ sent: true });
  }

  const [credential] = await db
    .select({ id: memberCredentials.id })
    .from(memberCredentials)
    .where(eq(memberCredentials.memberId, partner.id))
    .limit(1);

  if (!credential) {
    return ok({ sent: true });
  }

  const token = generateToken();
  const expiresAt = minutesFromNow(PASSWORD_RESET_EXPIRY_MINUTES);

  await db
    .update(memberOtpCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(memberOtpCodes.recipient, email),
        eq(memberOtpCodes.purpose, 'reset'),
        isNull(memberOtpCodes.consumedAt),
      ),
    );

  await db.insert(memberOtpCodes).values({
    id: crypto.randomUUID(),
    purpose: 'reset',
    channel: 'email',
    recipient: email,
    codeHash: hashOtp(token),
    expiresAt,
    attempts: 0,
    token,
    tokenExpiresAt: expiresAt,
    payloadJson: JSON.stringify({ memberId: partner.id, locale }),
  });

  const sendResult = await sendPasswordResetEmail(email, token, locale);
  if (!sendResult.ok) return err(sendResult.error);

  return ok({ sent: true });
}

export async function completeMemberPasswordReset(
  input: CompletePasswordResetInput,
): Promise<Result<{ reset: boolean }>> {
  const parsed = CompletePasswordResetInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.passwordReset.completeValidationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }

  const { token, password } = parsed.data;
  const [otpRecord] = await db
    .select()
    .from(memberOtpCodes)
    .where(and(eq(memberOtpCodes.token, token), eq(memberOtpCodes.purpose, 'reset')))
    .limit(1);

  if (!otpRecord || otpRecord.consumedAt) {
    return err(AppError.notFound('member.passwordReset.tokenInvalid'));
  }
  if (new Date() > otpRecord.tokenExpiresAt || new Date() > otpRecord.expiresAt) {
    return err(AppError.conflict('member.passwordReset.tokenExpired'));
  }
  if (otpRecord.codeHash !== hashOtp(token)) {
    return err(AppError.conflict('member.passwordReset.tokenInvalid'));
  }

  const email = otpRecord.recipient.trim().toLowerCase();
  const emailCipher = encryptPiiForLookup(email, 'partners.email');
  const [partner] = await db
    .select({ id: partners.id, isActive: partners.isActive, isMember: partners.isMember })
    .from(partners)
    .where(
      and(
        eq(partners.tenantId, 'default'),
        or(eq(partners.email, emailCipher ?? ''), sql`lower(${partners.email}) = ${email}`),
        eq(partners.kind, 'customer'),
      ),
    )
    .limit(1);

  if (!partner || !partner.isActive || !partner.isMember) {
    return err(AppError.notFound('member.passwordReset.tokenInvalid'));
  }

  const passwordHash = await hashMemberPassword(password);
  const [credential] = await db
    .select({ id: memberCredentials.id })
    .from(memberCredentials)
    .where(eq(memberCredentials.memberId, partner.id))
    .limit(1);

  if (credential) {
    await db
      .update(memberCredentials)
      .set({ passwordHash, passwordUpdatedAt: new Date(), updatedBy: 'member' })
      .where(eq(memberCredentials.id, credential.id));
  } else {
    await db.insert(memberCredentials).values({
      id: crypto.randomUUID(),
      memberId: partner.id,
      passwordHash,
      createdBy: 'member',
      updatedBy: 'member',
    });
  }

  await db.delete(memberSessions).where(eq(memberSessions.memberId, partner.id));
  await db
    .update(memberOtpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(memberOtpCodes.id, otpRecord.id), isNull(memberOtpCodes.consumedAt)));

  return ok({ reset: true });
}

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Authenticate member by email + password.
 * Returns session token on success.
 * SD §31.5 — member login flow.
 */
export async function loginMember(
  input: LoginInput,
  ipAddress?: string,
  userAgent?: string,
): Promise<Result<{ memberId: string; sessionToken: string }>> {
  const parsed = LoginInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.login.validationFailed', { issues: parsed.error.issues }),
    );
  }

  const { email, password } = parsed.data;

  // Find member by email — partners.email is encrypted; deterministic
  // encryption means the same plaintext always produces the same
  // ciphertext, so a direct equality match still works.
  const emailCipher = encryptPiiForLookup(email.toLowerCase().trim(), 'partners.email');
  const [partner] = await db
    .select({
      id: partners.id,
      name: partners.name,
      isActive: partners.isActive,
      isMember: partners.isMember,
    })
    .from(partners)
    .where(
      and(
        eq(partners.tenantId, 'default'),
        eq(partners.email, emailCipher ?? ''),
        eq(partners.kind, 'customer'),
      ),
    )
    .limit(1);

  if (!partner || !partner.isMember || !partner.isActive) {
    return err(AppError.unauthenticated('member.login.invalidCredentials'));
  }

  // Get password hash
  const [credential] = await db
    .select({ passwordHash: memberCredentials.passwordHash })
    .from(memberCredentials)
    .where(eq(memberCredentials.memberId, partner.id))
    .limit(1);

  if (!credential) {
    return err(AppError.unauthenticated('member.login.invalidCredentials'));
  }

  // Verify password
  const valid = await verifyMemberPassword(password, credential.passwordHash);
  if (!valid) {
    return err(AppError.unauthenticated('member.login.invalidCredentials'));
  }

  // Create session
  const sessionToken = randomBytes(48).toString('hex');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const expiresAt = minutesFromNow(30 * 24 * 60); // 30 days

  await db.insert(memberSessions).values({
    id: crypto.randomUUID(),
    memberId: partner.id,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return ok({ memberId: partner.id, sessionToken });
}

// ─── Store Lookup ─────────────────────────────────────────────────────────────

export async function findMemberByPhone(
  input: MemberPhoneLookupInput,
  tenantId = 'default',
): Promise<Result<MemberLookupResult | null>> {
  const parsed = MemberPhoneLookupInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.lookup.validationFailed', { issues: parsed.error.issues }),
    );
  }

  const candidates = buildPhoneLookupCandidates(parsed.data.phone);
  if (candidates.length === 0) {
    return err(AppError.validation('member.lookup.invalidPhone'));
  }

  // partners.phone is encrypted at rest — encrypt every dialing-format
  // candidate before the lookup so we can match without scanning rows.
  const cipherCandidates = candidates
    .map((c) => encryptPiiForLookup(c, 'partners.phone'))
    .filter((c): c is string => Boolean(c));

  try {
    const rows = await db
      .select({
        memberId: partners.id,
        name: partners.name,
        phone: partners.phone,
        loyaltyTier: partners.loyaltyTier,
        points: memberLoyalty.points,
        lifetimePoints: memberLoyalty.lifetimePoints,
        tier: memberLoyalty.tier,
      })
      .from(partners)
      .leftJoin(
        memberLoyalty,
        and(eq(memberLoyalty.memberId, partners.id), eq(memberLoyalty.tenantId, tenantId)),
      )
      .where(
        and(
          eq(partners.tenantId, tenantId),
          eq(partners.kind, 'customer'),
          eq(partners.isMember, true),
          eq(partners.isActive, true),
          inArray(partners.phone, cipherCandidates),
        ),
      )
      .limit(1);

    const member = rows[0];
    if (!member) return ok(null);

    return ok({
      memberId: member.memberId,
      name: member.name,
      // Decrypt the persisted ciphertext before handing back to the UI;
      // findByPhone is called from the POS so the cashier sees a readable
      // number when confirming the lookup result.
      phone: decryptPii(member.phone, 'partners.phone') ?? '',
      loyaltyTier: member.tier ?? member.loyaltyTier ?? 'bronze',
      points: member.points ?? 0,
      lifetimePoints: member.lifetimePoints ?? 0,
    });
  } catch (e) {
    return err(AppError.internal('member.lookup.failed', e));
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * Validate member session token and return member info.
 */
export async function validateMemberSession(
  token: string,
): Promise<Result<{ memberId: string; sessionId: string; memberName: string | null } | null>> {
  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const sessions = await db
      .select({ id: memberSessions.id, memberId: memberSessions.memberId })
      .from(memberSessions)
      .where(
        and(eq(memberSessions.tokenHash, tokenHash), gte(memberSessions.expiresAt, new Date())),
      )
      .limit(1);

    if (!sessions[0]) return ok(null);

    await db
      .update(memberSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(memberSessions.id, sessions[0].id));

    // Fetch member name from partners table
    let memberName: string | null = null;
    const [partner] = await db
      .select({ name: partners.name })
      .from(partners)
      .where(eq(partners.id, sessions[0].memberId))
      .limit(1);
    if (partner) memberName = partner.name;

    return ok({ memberId: sessions[0].memberId, sessionId: sessions[0].id, memberName });
  } catch (e) {
    return err(AppError.internal('member.session.validateFailed', e));
  }
}

/**
 * Invalidate member session (logout).
 */
export async function destroyMemberSession(sessionId: string): Promise<Result<void>> {
  try {
    await db.delete(memberSessions).where(eq(memberSessions.id, sessionId));
    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('member.session.destroyFailed', e));
  }
}

// ─── Loyalty ────────────────────────────────────────────────────────────────

export async function getMemberLoyalty(
  memberId: string,
): Promise<Result<Record<string, unknown> | null>> {
  try {
    const rows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, memberId))
      .limit(1);
    return ok(rows[0] ?? null);
  } catch (e) {
    return err(AppError.internal('member.loyalty.getFailed', e));
  }
}

export async function earnPoints(
  memberId: string,
  amount: number, // in IDR cents
  orderId: string,
  description: Record<string, string>,
  ctx: AuditContext,
): Promise<Result<{ newBalance: number }>> {
  try {
    const points = Math.floor(amount / 10000);

    let loyaltyRows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, memberId))
      .limit(1);

    if (!loyaltyRows[0]) {
      const newId = crypto.randomUUID();
      await db.insert(memberLoyalty).values({
        id: newId,
        memberId,
        points: 0,
        lifetimePoints: 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      loyaltyRows = await db
        .select()
        .from(memberLoyalty)
        .where(eq(memberLoyalty.memberId, memberId))
        .limit(1);
    }

    const record = loyaltyRows[0];
    if (!record) return err(AppError.internal('member.loyalty.createFailed'));

    const newPoints = record.points + points;
    const newLifetime = record.lifetimePoints + points;

    await db
      .update(memberLoyalty)
      .set({
        points: newPoints,
        lifetimePoints: newLifetime,
        lastEarnedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(memberLoyalty.memberId, memberId));

    await db.insert(memberPointsTransactions).values({
      id: crypto.randomUUID(),
      memberId,
      loyaltyId: record.id,
      type: 'earn',
      points,
      balanceAfter: newPoints,
      referenceType: 'sales_order',
      referenceId: orderId,
      description,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return ok({ newBalance: newPoints });
  } catch (e) {
    return err(AppError.internal('member.loyalty.earnFailed', e));
  }
}

export async function redeemPoints(
  memberId: string,
  pointsToRedeem: number,
  voucherKind: string,
  voucherValue: number,
  ctx: AuditContext,
): Promise<Result<{ voucherCode: string; pointsRemaining: number }>> {
  try {
    const loyaltyRows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, memberId))
      .limit(1);

    const record = loyaltyRows[0];
    if (!record || record.points < pointsToRedeem) {
      return err(AppError.conflict('member.loyalty.insufficientPoints'));
    }

    const newBalance = record.points - pointsToRedeem;
    const voucherCode = `V${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const validUntil = minutesFromNow(30 * 24 * 60);

    await db
      .update(memberLoyalty)
      .set({ points: newBalance, updatedBy: ctx.userId })
      .where(eq(memberLoyalty.memberId, memberId));

    await db.insert(memberVouchers).values({
      id: crypto.randomUUID(),
      memberId,
      code: voucherCode,
      kind: voucherKind,
      value: voucherValue,
      validFrom: new Date(),
      validUntil,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await db.insert(memberPointsTransactions).values({
      id: crypto.randomUUID(),
      memberId,
      loyaltyId: record.id,
      type: 'redeem',
      points: -pointsToRedeem,
      balanceAfter: newBalance,
      referenceType: 'voucher_redeem',
      referenceId: voucherCode,
      description: {
        id: `Tukar ${pointsToRedeem} poin untuk voucher`,
        en: `Redeem ${pointsToRedeem} points for voucher`,
        zh: `兑换${pointsToRedeem}积分`,
      },
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return ok({ voucherCode, pointsRemaining: newBalance });
  } catch (e) {
    return err(AppError.internal('member.loyalty.redeemFailed', e));
  }
}

export async function getPointsHistory(
  memberId: string,
  limitCount = 20,
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const rows = await db
      .select()
      .from(memberPointsTransactions)
      .where(eq(memberPointsTransactions.memberId, memberId))
      .orderBy(desc(memberPointsTransactions.createdAt))
      .limit(limitCount);
    return ok(rows);
  } catch (e) {
    return err(AppError.internal('member.points.historyFailed', e));
  }
}

export async function getMemberVouchers(
  memberId: string,
  options?: { activeOnly?: boolean; unusedOnly?: boolean },
): Promise<Result<Array<Record<string, unknown>>>> {
  try {
    const rows = await db
      .select()
      .from(memberVouchers)
      .where(eq(memberVouchers.memberId, memberId))
      .orderBy(desc(memberVouchers.createdAt));

    const now = new Date();
    let filtered = rows;
    if (options?.activeOnly) {
      filtered = filtered.filter((v) => v.isActive && v.validFrom <= now && v.validUntil >= now);
    }
    if (options?.unusedOnly) {
      filtered = filtered.filter((v) => v.isActive && !v.usedAt && v.validUntil >= now);
    }
    return ok(filtered);
  } catch (e) {
    return err(AppError.internal('member.vouchers.listFailed', e));
  }
}


