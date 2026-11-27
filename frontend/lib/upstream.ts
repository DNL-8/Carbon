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

export async function getAccount(cookie: string): Promise<string | null> {
  const result = await fetch(new URL('/api/auth/get-session', upstream()), {
    cache: 'no-store', headers: { cookie }, signal: AbortSignal.timeout(5000),
  })
  if (!result.ok) throw new Error('Sessão indisponível')
  const account: { user?: { id?: unknown; emailVerified?: unknown } } | null = await result.json()
  return account?.user?.emailVerified === true && typeof account.user.id === 'string' && account.user.id ? account.user.id : null
}
