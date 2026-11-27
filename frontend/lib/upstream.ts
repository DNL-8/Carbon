import 'server-only'

export function upstream(service: 'auth' | 'fastapi'): URL {
  const configured = service === 'auth'
    ? process.env.MURIM_AUTH_ORIGIN ?? 'http://127.0.0.1:38201'
    : process.env.MURIM_FASTAPI_ORIGIN ?? 'http://127.0.0.1:38202'
  const url = new URL(configured)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!(url.protocol === 'https:' || (loopback && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Origem de serviço inválida')
  }
  return url
}

export async function getAccount(cookie: string): Promise<boolean> {
  const result = await fetch(new URL('/api/conta', upstream('fastapi')), {
    cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(5000),
  })
  if (!result.ok) throw new Error('Sessão indisponível')
  const account: { authenticated?: unknown } = await result.json()
  return account.authenticated === true
}
