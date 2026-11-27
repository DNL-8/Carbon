import type { NextConfig } from 'next';

const devOriginHosts = new Set<string>([
  'localhost',
  '**.localhost',
  '127.0.0.1',
  '**.run.app',
  '**.aistudio.google.com',
  'aistudio.google.com',
]);

for (const raw of [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS?.split(',') ?? [])]) {
  if (!raw?.trim()) continue;
  try {
    devOriginHosts.add(new URL(raw.trim()).hostname);
  } catch {
    // ignore malformed origin
  }
}

const config: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: [...devOriginHosts],
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', 'motion', 'recharts'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default config;
