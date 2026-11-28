import 'server-only'

export function upstream(): URL {
  const configured = process.env.MURIM_FASTAPI_ORIGIN ?? 'http://127.0.0.1:38202'
  const url = new URL(configured)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' || (loopback && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Origem de serviço inválida')
  }
  return url
}

// Opt-in only on Cloud Run; the default remains portable to Vercel/local Docker.
export async function upstreamHeaders(url: URL, headers: Headers): Promise<Headers> {
  if (process.env.MURIM_CLOUD_RUN_IAM !== 'true') return headers
  const origin = upstream()
  if (origin.origin !== url.origin || origin.protocol !== 'https:' ||
      !origin.hostname.endsWith('.run.app') || origin.port) {
    throw new Error('Origem Cloud Run inválida')
  }
  const identity = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity')
  identity.searchParams.set('audience', origin.origin)
  const token = await fetch(identity, {
    headers: { 'Metadata-Flavor': 'Google' }, cache: 'no-store',
    redirect: 'error', signal: AbortSignal.timeout(3000),
  })
  if (!token.ok) throw new Error('Identidade do serviço indisponível')
  const jwt = await token.text()
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt)) {
    throw new Error('Identidade do serviço inválida')
  }
  headers.set('X-Serverless-Authorization', 'Bearer ' + jwt)
  return headers
}

export async function getAccount(cookie: string): Promise<string | null> {
  const url = new URL('/api/auth/get-session', upstream())
  const result = await fetch(url, {
    cache: 'no-store', headers: await upstreamHeaders(url, new Headers({ cookie })),
    redirect: 'error', signal: AbortSignal.timeout(5000),
  })
  if (!result.ok) throw new Error('Sessão indisponível')
  const account: { user?: { id?: unknown; emailVerified?: unknown } } | null = await result.json()
  return account?.user?.emailVerified === true && typeof account.user.id === 'string' && account.user.id ? account.user.id : null
}
