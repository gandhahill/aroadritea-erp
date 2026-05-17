const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ||
  'https://aroadritea.com'
).replace(/\/+$/, '');

/**
 * Resolve a stored image reference to a URL the browser can fetch.
 *
 * Acceptable inputs:
 * - Absolute URL (`https:`, `data:`, `blob:`) → returned as-is.
 * - `/api/uploads/...` → served by the ERP web app directly.
 * - `/uploads/...`, `/photo/...`, `/brand/...`, `/images/...` → assumed
 *   to live on the public site (apps/site `public/`). Prefixed with
 *   NEXT_PUBLIC_SITE_URL.
 * - Anything else with a leading `/` → also prefixed with the public
 *   site origin (catches legacy product image paths that didn't include
 *   the `/photo/` segment, which used to 404 silently).
 */
export function displayAssetUrl(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/api/uploads/')) return raw;
  if (raw.startsWith('/')) {
    return `${PUBLIC_SITE_URL}${raw}`;
  }
  // Bare filename — assume product photos directory on the public site.
  return `${PUBLIC_SITE_URL}/photo/${raw.replace(/^\/+/, '')}`;
}
