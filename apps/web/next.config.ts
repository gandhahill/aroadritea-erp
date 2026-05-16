import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} blob: https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      'frame-src https://challenges.cloudflare.com',
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

/**
 * @serwist/next requires InjectManifestOptions: swSrc, swDest, injectionPoint.
 * In dev mode (NODE_ENV=development) the service worker is disabled
 * so cashiers can use hot-reload without SW interference.
 * SD §35.1.1: Pre-cache POS routes at build time.
 */
const withSerwist = withSerwistInit({
  swSrc: 'service-worker/index.ts',
  swDest: 'public/sw.js',
  injectionPoint: 'self.__SW_MANIFEST',
});

const nextConfig: NextConfig = {
  transpilePackages: ['@erp/shared', '@erp/ui', '@erp/db', '@erp/offline'],
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(withSerwist(nextConfig));
