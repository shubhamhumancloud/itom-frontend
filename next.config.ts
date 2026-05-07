import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/itom',
  allowedDevOrigins: ['localhost', 'dev.acai.localhost', 'dev.tryacai.app'],
  transpilePackages: ['@swar-da/humancloud-ui'],
};

export default nextConfig;
