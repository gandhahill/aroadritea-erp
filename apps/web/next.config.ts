import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@erp/shared', '@erp/ui', '@erp/db'],
  output: 'standalone',
};

export default nextConfig;
