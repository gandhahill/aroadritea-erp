const PRIVATE_FALLBACK = 'direct';

export interface HeaderReader {
  get(name: string): string | null;
}

function cleanIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  if (!first) return null;

  const normalized = first.replace(/^\[|\]$/g, '');
  if (!/^[0-9A-Fa-f:.]{3,45}$/.test(normalized)) return null;
  return normalized;
}

function trustsProxyHeaders(headers: HeaderReader): boolean {
  const secret = process.env.TRUSTED_PROXY_HEADER_SECRET;
  if (secret) return headers.get('x-aroadri-proxy-secret') === secret;
  return process.env.NODE_ENV !== 'production' && process.env.TRUST_PROXY_HEADERS === 'true';
}

export function clientIpFromHeaders(headers: HeaderReader): string {
  if (!trustsProxyHeaders(headers)) return PRIVATE_FALLBACK;

  return (
    cleanIp(headers.get('cf-connecting-ip')) ??
    cleanIp(headers.get('x-real-ip')) ??
    cleanIp(headers.get('x-forwarded-for')) ??
    PRIVATE_FALLBACK
  );
}
