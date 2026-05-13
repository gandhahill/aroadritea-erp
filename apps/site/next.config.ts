import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ['@erp/shared', '@erp/ui-public'],
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
};

export default withNextIntl(nextConfig);
