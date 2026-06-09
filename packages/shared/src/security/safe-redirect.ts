const DEFAULT_FALLBACK = '/dashboard';

export function safeInternalRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_FALLBACK,
) {
  if (!value) return fallback;

  const candidate = value.trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  try {
    const base = 'https://aroadri.local';
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
