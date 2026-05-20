/**
 * Email HTML Templates — branded Aroadri Tea emails.
 *
 * All emails use inline styles for maximum email client compatibility.
 * Brand colors: Red #C41E3A, Gold #B8860B, Cream #FAF7F2, Ink #1A1A1A
 */

const BRAND_RED = '#C41E3A';
const BRAND_CREAM = '#FAF7F2';
const BRAND_INK = '#1A1A1A';
const BRAND_INK_2 = '#4A4A4A';
const BRAND_CREAM_3 = '#E8E2D9';
type EmailLocale = 'id' | 'en' | 'zh';

function publicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://aroadritea.com'
  ).replace(/\/$/, '');
}

function baseLayout(content: string, locale: EmailLocale = 'id'): string {
  const logoUrl = `${publicSiteUrl()}/brand/logo-primary.png`;
  return `<!DOCTYPE html>
<html lang="${locale === 'zh' ? 'zh-CN' : locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aroadri Tea</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid ${BRAND_CREAM_3};overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_RED};padding:24px 32px;text-align:center;">
              <img src="${logoUrl}" width="120" height="120" alt="Aroadri Tea" style="display:block;margin:0 auto 12px;border:0;outline:none;text-decoration:none;width:120px;height:auto;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px;">Aroadri Tea</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${BRAND_CREAM_3};text-align:center;">
              <p style="margin:0;font-size:12px;color:#888888;line-height:1.5;">
                PT. Gandha Hill Catering Management Indonesia<br>
                Yogyakarta, Indonesia<br>
                <a href="https://aroadritea.com" style="color:${BRAND_RED};text-decoration:none;">aroadritea.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailHtml(
  code: string,
  expiryMinutes: number,
  locale: EmailLocale = 'id',
): string {
  const copy = {
    id: {
      title: 'Kode Verifikasi OTP',
      intro: 'Gunakan kode di bawah ini untuk memverifikasi akun Aroadri Tea Anda.',
      expiry: `Kode ini berlaku selama <strong>${expiryMinutes} menit</strong>.`,
      warning: 'Jangan bagikan kode ini kepada siapapun. Tim Aroadri Tea tidak akan pernah meminta kode OTP Anda.',
    },
    en: {
      title: 'OTP Verification Code',
      intro: 'Use the code below to verify your Aroadri Tea account.',
      expiry: `This code is valid for <strong>${expiryMinutes} minutes</strong>.`,
      warning: 'Do not share this code with anyone. The Aroadri Tea team will never ask for your OTP code.',
    },
    zh: {
      title: 'OTP验证码',
      intro: '请使用以下验证码验证您的 Aroadri Tea 账户。',
      expiry: `此验证码有效期为 <strong>${expiryMinutes} 分钟</strong>。`,
      warning: '请勿向任何人透露此验证码。Aroadri Tea 团队绝不会索取您的 OTP 验证码。',
    },
  }[locale];
  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_INK};">${copy.title}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND_INK_2};line-height:1.6;">
      ${copy.intro}
    </p>
    <div style="background-color:${BRAND_CREAM};border:2px dashed ${BRAND_CREAM_3};border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
      <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:8px;color:${BRAND_RED};">${code}</p>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND_INK_2};line-height:1.5;">
      ${copy.expiry}
    </p>
    <p style="margin:0;font-size:13px;color:${BRAND_INK_2};line-height:1.5;">
      ${copy.warning}
    </p>
  `;
  return baseLayout(content, locale);
}

export function buildWelcomeEmailHtml(memberName: string, locale: EmailLocale = 'id'): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_INK};">Selamat Datang, ${memberName}!</h2>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND_INK_2};line-height:1.6;">
      Akun member Aroadri Tea Anda telah aktif. Nikmati berbagai benefit eksklusif sebagai member kami.
    </p>
    <div style="background-color:${BRAND_CREAM};border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND_INK};">Benefit Member:</p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:${BRAND_INK_2};line-height:1.8;">
        <li>Kumpulkan poin setiap transaksi</li>
        <li>Voucher eksklusif &amp; promo khusus</li>
        <li>Naik tier untuk benefit lebih banyak</li>
      </ul>
    </div>
    <p style="margin:0;font-size:13px;color:${BRAND_INK_2};line-height:1.5;">
      Kunjungi outlet terdekat kami dan sebutkan nomor telepon terdaftar saat bertransaksi.
    </p>
  `;
  return baseLayout(content, locale);
}

export function buildPasswordResetEmailHtml(
  resetUrl: string,
  expiryMinutes: number,
  locale: EmailLocale = 'id',
): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND_INK};">Reset Password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND_INK_2};line-height:1.6;">
      Kami menerima permintaan untuk mereset password akun Aroadri Tea Anda. Klik tombol di bawah untuk membuat password baru.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${resetUrl}" style="display:inline-block;background-color:${BRAND_RED};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND_INK_2};line-height:1.5;">
      Link ini berlaku selama <strong>${expiryMinutes} menit</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:${BRAND_INK_2};line-height:1.5;">
      Jika Anda tidak merasa meminta reset password, abaikan email ini.
    </p>
  `;
  return baseLayout(content, locale);
}
