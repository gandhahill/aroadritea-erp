import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@erp/shared', '@erp/ui-public'],
  output: 'standalone',
};

export default nextConfig;
