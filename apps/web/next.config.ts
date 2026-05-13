import { fileURLToPath } from 'node:url';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

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
};

export default withNextIntl(withSerwist(nextConfig));
