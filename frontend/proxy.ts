import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = randomBytes(24).toString('base64')
  const development = process.env.NODE_ENV !== 'production'
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    development ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-murim-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

// Only the application page needs dynamic rendering. API forwarding and assets
// retain their independent security headers and do not pass through this proxy.
export const config = { matcher: ['/'] }
