import { createHash, randomBytes } from 'node:crypto';
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
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

// ─── Rate limiting constants ───────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const RATE_LIMIT_SIGNUP_PER_IP = 3; // per hour
const TOKEN_EXPIRY_MINUTES = 30;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const SignupInputSchema = z.object({
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\+?[0-9]+$/, 'Invalid phone number'),
  name: z.string().min(2).max(100),
  birthDate: z.string().optional(), // YYYY-MM-DD
  city: z.string().optional(),
  password: z.string().min(8).max(128),
  consentGiven: z.boolean().refine((v) => v === true, 'Consent is required'),
  turnstileToken: z.string().min(1), // Cloudflare Turnstile token
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
  name: z.string().min(2).max(100),
  birthDate: z.string().optional(),
  city: z.string().optional(),
  password: z.string().min(8).max(128).optional(),
  consentGiven: z.boolean().refine((v) => v === true, 'Consent is required'),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>;
export type RetryOtpInput = z.infer<typeof RetryOtpInputSchema>;
export type CompleteSignupInput = z.infer<typeof CompleteSignupInputSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateOtp(): string {
  const num = randomBytes(3).readUInt32BE(0);
  return (num % 1000000).toString().padStart(6, '0');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function verifyTurnstile(token: string, ipAddress?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== 'production' && token === 'dev-token';

  const formData = new FormData();
  formData.set('secret', secret);
  formData.set('response', token);
  if (ipAddress) formData.set('remoteip', ipAddress);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) return false;

  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}

async function sendSignupOtp(email: string, code: string): Promise<Result<void>> {
  const smtpHost = process.env.SMTP_HOST;
  const configuredPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpPort = Number.isFinite(configuredPort) ? configuredPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const smtpFromName = process.env.SMTP_FROM_NAME ?? 'Aroadri Tea';

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    if (process.env.NODE_ENV === 'production') {
      return err(AppError.internal('member.signup.otpProviderNotConfigured'));
    }
    console.info(`[member] Development OTP for ${email}: ${code}`);
    return ok(undefined);
  }

  try {
    const nodemailer = await import('nodemailer');
    const secure =
      process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpFrom.includes('<') ? smtpFrom : `${smtpFromName} <${smtpFrom}>`,
      to: email,
      subject: 'Kode OTP Aroadri Tea',
      text: `Kode OTP Aroadri Tea Anda: ${code}. Kode berlaku ${OTP_EXPIRY_MINUTES} menit.`,
      html: `<p>Kode OTP Aroadri Tea Anda:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Kode berlaku ${OTP_EXPIRY_MINUTES} menit.</p>`,
    });

    return ok(undefined);
  } catch (error) {
    return err(
      AppError.internal('member.signup.otpSendFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

// ─── Signup ─────────────────────────────────────────────────────────────────

/**
 * Step 1 of member signup: validate input, rate-limit, send OTP.
 * Returns a short-lived token to continue the flow.
 */
export async function initiateSignup(
  input: SignupInput,
  ipAddress?: string,
  userAgent?: string,
): Promise<Result<{ token: string }>> {
  const parsed = SignupInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('member.signup.validationFailed', { issues: parsed.error.issues }),
    );
  }

  const turnstileValid = await verifyTurnstile(input.turnstileToken, ipAddress);
  if (!turnstileValid) {
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email: input.email,
      phone: input.phone,
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

  // Check email not already registered
  const existing = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.email, input.email), eq(partners.kind, 'customer')))
    .limit(1);

  if (existing[0]) {
    await db.insert(memberSignupAttempts).values({
      id: crypto.randomUUID(),
      email: input.email,
      ipAddress,
      userAgent,
      outcome: 'email_exists',
    });
    return err(AppError.conflict('member.signup.emailExists'));
  }

  // Generate OTP + token
  const code = generateOtp();
  const token = generateToken();
  const codeHash = hashOtp(code);
  const expiresAt = minutesFromNow(OTP_EXPIRY_MINUTES);
  const tokenExpiresAt = minutesFromNow(TOKEN_EXPIRY_MINUTES);
  const { hashPassword } = await import('../auth/password');
  const passwordHash = await hashPassword(input.password);

  // Store signup payload in encrypted JSON (for later account creation)
  const payloadJson = JSON.stringify({
    name: input.name,
    phone: input.phone,
    birthDate: input.birthDate,
    city: input.city,
    passwordHash,
  });

  await db.insert(memberOtpCodes).values({
    id: crypto.randomUUID(),
    purpose: 'signup',
    channel: 'email',
    recipient: input.email,
    codeHash,
    expiresAt,
    attempts: 0,
    token,
    tokenExpiresAt,
    payloadJson,
  });

  const sendResult = await sendSignupOtp(input.email, code);
  if (!sendResult.ok) return sendResult;

  await db.insert(memberSignupAttempts).values({
    id: crypto.randomUUID(),
    email: input.email,
    phone: input.phone,
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

  const email = otpRecord.recipient;

  // Parse stored payload
  let storedPayload: Record<string, string> = {};
  try {
    if (otpRecord.payloadJson) storedPayload = JSON.parse(otpRecord.payloadJson as string);
  } catch {
    /* use form data as fallback */
  }

  const name = input.name || storedPayload.name || email;
  const phone = storedPayload.phone ?? '';
  const { hashPassword } = await import('../auth/password');
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : storedPayload.passwordHash || '';
  const birthDate = input.birthDate || storedPayload.birthDate;
  const city = input.city || storedPayload.city;

  if (!passwordHash) {
    return err(AppError.validation('member.completeSignup.passwordMissing'));
  }

  // Create partner record
  let memberId: string;
  try {
    const existingPartner = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.email, email), eq(partners.kind, 'customer')))
      .limit(1);

    if (existingPartner[0]) {
      memberId = existingPartner[0].id;
    } else {
      memberId = crypto.randomUUID();
      await db.insert(partners).values({
        id: memberId,
        tenantId: 'default',
        name,
        kind: 'customer',
        email,
        phone: phone || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        city: city || null,
        isMember: true,
        createdBy: ctx?.userId,
        updatedBy: ctx?.userId,
      });
    }
  } catch (e) {
    return err(AppError.internal('member.completeSignup.createFailed', e));
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

  return ok({ memberId, sessionToken });
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * Validate member session token and return member info.
 */
export async function validateMemberSession(
  token: string,
): Promise<Result<{ memberId: string; sessionId: string } | null>> {
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

    return ok({ memberId: sessions[0].memberId, sessionId: sessions[0].id });
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
