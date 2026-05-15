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
  const rawBirthDate = formData.get('birthDate');
  const birthDate =
    typeof rawBirthDate === 'string' && rawBirthDate.trim() ? rawBirthDate : undefined;
  const rawCity = formData.get('city');
  const city = typeof rawCity === 'string' && rawCity.trim() ? rawCity : undefined;
  const password = String(formData.get('password') ?? '');
  const turnstileToken = String(
    formData.get('turnstileToken') ?? formData.get('cf-turnstile-response') ?? '',
  );
  const consent = formData.get('consentGiven') === 'on';

  const result = await initiateSignup(
    { email, phone, name, birthDate, city, password, consentGiven: consent, turnstileToken },
    undefined, // ip from headers
    undefined, // userAgent
  );

  if (!result.ok) return { success: false, error: String(result.error) };
  return { success: true, token: result.value.token };
}

export async function verifyOtpAction(token: string, code: string) {
  const result = await verifySignupOtp({ token, code });
  if (!result.ok) return { success: false, error: String(result.error) };
  return { success: true };
}

export async function completeSignupAction(formData: FormData, token: string) {
  const name = String(formData.get('name') ?? '');
  const birthDate = String(formData.get('birthDate') ?? '');
  const city = String(formData.get('city') ?? '');
  const consent = formData.get('consentGiven') === 'on';

  const result = await completeSignup(
    { token, name, birthDate, city, consentGiven: consent },
    undefined,
    undefined,
    { userId: 'member', tenantId: 'default', locationId: 'default' },
  );

  if (!result.ok) return { success: false, error: String(result.error) };

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
