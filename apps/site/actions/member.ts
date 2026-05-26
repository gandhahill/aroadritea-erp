/**
 * Member Portal — Server Actions (SD §31.5, §31.6, §31.7)
 * Used by the public site (apps/site) for member authentication and account.
 */
'use server';

import {
  completeMemberPasswordReset,
  completeSignup,
  deleteMyMember,
  destroyMemberSession,
  getMemberLoyalty,
  getMemberVouchers,
  getPointsHistory,
  initiateSignup,
  loginMember,
  requestMemberPasswordReset,
  validateMemberSession,
  verifySignupOtp,
} from '@erp/services/member';
import { clientIpFromHeaders } from '@erp/shared/client-ip';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

const MEMBER_SESSION_COOKIE = '__Host-member-session';

async function requestMetadata() {
  const hdrs = await headers();
  return {
    ipAddress: clientIpFromHeaders(hdrs),
    userAgent: hdrs.get('user-agent') ?? undefined,
  };
}

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
  const meta = await requestMetadata();

  const result = await initiateSignup(
    { email, phone, name, birthDate, city, password, consentGiven: consent, turnstileToken },
    meta.ipAddress,
    meta.userAgent,
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
  const meta = await requestMetadata();

  const result = await loginMember({ email, password }, meta.ipAddress, meta.userAgent);

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

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const locale = String(formData.get('locale') ?? 'id');
  const meta = await requestMetadata();

  const result = await requestMemberPasswordReset(
    { email, locale: locale as 'id' | 'en' | 'zh' },
    meta.ipAddress,
    meta.userAgent,
  );
  if (!result.ok) {
    return {
      success: false,
      error: 'Permintaan reset password belum berhasil. Silakan coba lagi.',
    };
  }

  return { success: true };
}

export async function resetPasswordAction(formData: FormData, token: string) {
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (password !== passwordConfirm) {
    return { success: false, error: 'Konfirmasi password tidak sama.' };
  }

  const result = await completeMemberPasswordReset({ token, password });
  if (!result.ok) {
    return { success: false, error: 'Link reset password tidak valid atau sudah kedaluwarsa.' };
  }

  return { success: true };
}

export async function verifyOtpAction(token: string, code: string) {
  const meta = await requestMetadata();
  const result = await verifySignupOtp({ token, code }, meta.ipAddress, meta.userAgent);
  if (!result.ok) return { success: false, error: String(result.error) };
  return { success: true };
}

export async function verifyAndCompleteSignupAction(token: string, code: string) {
  const meta = await requestMetadata();
  const verifyResult = await verifySignupOtp({ token, code }, meta.ipAddress, meta.userAgent);
  if (!verifyResult.ok) return { success: false, error: String(verifyResult.error) };

  const result = await completeSignup(
    { token, consentGiven: true },
    meta.ipAddress,
    meta.userAgent,
    {
      userId: 'member',
      tenantId: 'default',
      locationId: 'default',
    },
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
  const meta = await requestMetadata();

  const result = await completeSignup(
    {
      token,
      ...(name ? { name } : {}),
      ...(birthDate ? { birthDate } : {}),
      ...(city ? { city } : {}),
      consentGiven: consent,
    },
    meta.ipAddress,
    meta.userAgent,
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

/**
 * E23 — UU PDP-compliant member account deletion.
 *
 * Validates the caller actually owns the session, calls the service
 * which anonymises the partner row + revokes every session, then
 * clears the cookie. Returns a structured success/error so the page
 * can show a confirmation and redirect.
 */
export async function deleteMyAccountAction(input: {
  confirmation: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (input.confirmation !== 'HAPUS') {
    return { success: false, error: 'Ketik HAPUS untuk konfirmasi.' };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_SESSION_COOKIE)?.value;
  if (!token) return { success: false, error: 'Sesi tidak valid. Silakan login ulang.' };

  const sessionResult = await validateMemberSession(token);
  if (!sessionResult.ok || !sessionResult.value) {
    return { success: false, error: 'Sesi tidak valid. Silakan login ulang.' };
  }

  const memberId = sessionResult.value.memberId;
  const result = await deleteMyMember(
    { memberId, reason: input.reason },
    { userId: memberId, tenantId: 'default', locationId: '' },
  );
  if (!result.ok) {
    return { success: false, error: 'Penghapusan gagal. Hubungi admin.' };
  }
  cookieStore.delete(MEMBER_SESSION_COOKIE);
  revalidatePath('/[locale]/member/akun');
  return { success: true };
}
