/**
 * Member Portal — Server Actions (SD §31.5, §31.6, §31.7)
 * Used by the public site (apps/site) for member authentication and account.
 */
'use server';

import {
  completeSignup,
  destroyMemberSession,
  getMemberLoyalty,
  getMemberVouchers,
  getPointsHistory,
  initiateSignup,
  loginMember,
  validateMemberSession,
  verifySignupOtp,
} from '@erp/services/member';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

const MEMBER_SESSION_COOKIE = '__Host-member-session';

export async function signupAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const phone = String(formData.get('phone') ?? '');
  const name = String(formData.get('name') ?? '');
  const birthDate = String(formData.get('birthDate') ?? '');
  const city = String(formData.get('city') ?? '');
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'id');
  const challengeToken = String(formData.get('cf-turnstile-response') ?? '').trim();
  const fallbackToken = String(formData.get('turnstileToken') ?? '').trim();
  const turnstileToken = challengeToken || fallbackToken || 'captcha-unreachable';
  const consent = formData.get('consentGiven') === 'on';

  const result = await initiateSignup(
    { email, phone, name, birthDate, city, password, consentGiven: consent, turnstileToken },
    undefined, // ip from headers
    undefined, // userAgent
    locale,
  );

  if (!result.ok) {
    return {
      success: false,
      error:
        result.error.code === 'VALIDATION_FAILED'
          ? 'Data pendaftaran belum lengkap atau tidak valid.'
          : 'Pendaftaran belum berhasil. Silakan coba lagi.',
    };
  }
  return { success: true, token: result.value.token };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const result = await loginMember({ email, password });

  if (!result.ok) {
    return { success: false, error: 'Email atau kata sandi tidak valid.' };
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, result.value.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return { success: true };
}

export async function verifyOtpAction(token: string, code: string) {
  const result = await verifySignupOtp({ token, code });
  if (!result.ok) return { success: false, error: String(result.error) };
  return { success: true };
}

export async function verifyAndCompleteSignupAction(token: string, code: string) {
  const verifyResult = await verifySignupOtp({ token, code });
  if (!verifyResult.ok) return { success: false, error: String(verifyResult.error) };

  const result = await completeSignup(
    { token, consentGiven: true },
    undefined,
    undefined,
    { userId: 'member', tenantId: 'default', locationId: 'default' },
  );

  if (!result.ok) {
    return { success: false, error: 'Akun belum berhasil dibuat. Silakan coba lagi.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, result.value.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return { success: true };
}

export async function completeSignupAction(formData: FormData, token: string) {
  const name = String(formData.get('name') ?? '').trim();
  const birthDate = String(formData.get('birthDate') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const consent = formData.get('consentGiven') === 'on';

  const result = await completeSignup(
    {
      token,
      ...(name ? { name } : {}),
      ...(birthDate ? { birthDate } : {}),
      ...(city ? { city } : {}),
      consentGiven: consent,
    },
    undefined,
    undefined,
    { userId: 'member', tenantId: 'default', locationId: 'default' },
  );

  if (!result.ok) {
    return { success: false, error: 'Akun belum berhasil dibuat. Silakan coba lagi.' };
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(MEMBER_SESSION_COOKIE, result.value.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return { success: true };
}

export async function getMemberAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionResult = await validateMemberSession(token);
  if (!sessionResult.ok || !sessionResult.value) return null;

  const loyaltyResult = await getMemberLoyalty(sessionResult.value.memberId);
  const pointsHistoryResult = await getPointsHistory(sessionResult.value.memberId);
  const vouchersResult = await getMemberVouchers(sessionResult.value.memberId, {
    unusedOnly: true,
  });

  return {
    memberId: sessionResult.value.memberId,
    sessionId: sessionResult.value.sessionId,
    memberName: sessionResult.value.memberName,
    loyalty: loyaltyResult.ok ? loyaltyResult.value : null,
    pointsHistory: pointsHistoryResult.ok ? pointsHistoryResult.value : [],
    vouchers: vouchersResult.ok ? vouchersResult.value : [],
  };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;

  if (token) {
    const sessionResult = await validateMemberSession(token);
    if (sessionResult.ok && sessionResult.value) {
      await destroyMemberSession(sessionResult.value.sessionId);
    }
  }

  cookieStore.delete(MEMBER_SESSION_COOKIE);
  revalidatePath('/[locale]/member/akun');
}
