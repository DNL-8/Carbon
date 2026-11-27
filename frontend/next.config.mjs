import { fileURLToPath } from 'node:url'

export default {
  turbopack: { root: fileURLToPath(new URL('..', import.meta.url)) },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }]
  },
}
