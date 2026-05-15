const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
  'https://aroadritea.com'
).replace(/\/+$/, '');

export function displayAssetUrl(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/api/uploads/')) return raw;
  if (raw.startsWith('/photo/') || raw.startsWith('/brand/') || raw.startsWith('/images/')) {
    return `${PUBLIC_SITE_URL}${raw}`;
  }
  return raw;
}
