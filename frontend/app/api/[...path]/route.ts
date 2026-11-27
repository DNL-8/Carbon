import type { NextRequest } from 'next/server'
import { upstream } from '../../../lib/upstream'

const business: Record<string, readonly string[]> = {
  GET: [
    'arsenal', 'arsenal/conjuntos', 'catalogo', 'conquistas', 'conta', 'estado', 'extrato',
    'health', 'heroi', 'missao', 'mobile/config', 'painel', 'progresso', 'ready',
    'saude/health-connect', 'saude/resumo', 'strava/callback', 'strava/config', 'strava/status',
    'treinos/historico', 'treinos/personalizados', 'votos',
  ],
  POST: [
    'arsenal', 'arsenal/conjuntos', 'missao', 'oracle/ask', 'saude/health-connect', 'saude/importar',
    'strava/auth-url', 'strava/disconnect', 'strava/sync', 'treinos/concluir', 'votos',
  ],
  PUT: ['heroi', 'saude/peso'],
  DELETE: ['saude/peso'],
}

async function proxy(request: NextRequest, context: RouteContext<'/api/[...path]'>) {
  const { path } = await context.params
  if (path.some(segment => !/^[a-z\d-]+$/i.test(segment))) {
    return Response.json({ statusMessage: 'Rota indisponível' }, { status: 404 })
  }
  const route = path.join('/')
  const isAuth = path[0] === 'auth' && path.length > 1
  const isCustomWorkout = path.length === 3 && path[0] === 'treinos' && path[1] === 'personalizados'
    && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(path[2])
    && ['PUT', 'DELETE'].includes(request.method)
  if (!isAuth && !isCustomWorkout && !business[request.method]?.includes(route)) {
    return Response.json({ statusMessage: 'Rota indisponível' }, { status: 404 })
  }
  const probe = request.method === 'GET' && (route === 'health' || route === 'ready')
  try {
    const pythonAuth = process.env.MURIM_AUTH_PROVIDER === 'authlib'
    const url = upstream(!pythonAuth && (isAuth || (probe && route === 'health')) ? 'auth' : 'fastapi')
    url.pathname = '/api/' + route
    url.search = request.nextUrl.search
    const headers = new Headers()
    for (const name of ['accept', 'content-type', 'cookie', 'origin', 'referer']) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    const withBody = request.method !== 'GET' && request.body !== null
    const timeout = ['strava/sync', 'oracle/ask'].includes(route) ? 35_000 : 20_000
    const response = await fetch(url, {
      method: request.method, headers, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      ...(withBody ? { body: request.body, duplex: 'half' } : {}),
    } as RequestInit)
    const outgoing = new Headers({ 'Cache-Control': probe ? 'no-store' : 'private, no-store' })
    for (const name of ['content-type', 'location', 'referrer-policy']) {
      const value = response.headers.get(name)
      if (value) outgoing.set(name, value)
    }
    for (const value of response.headers.getSetCookie()) outgoing.append('Set-Cookie', value)
    return new Response(response.body, { status: response.status, headers: outgoing })
  } catch {
    if (probe && route === 'ready') {
      return Response.json({ ready: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    return Response.json({ statusCode: 502, statusMessage: 'Serviço temporariamente indisponível' }, {
      status: 502, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE }
