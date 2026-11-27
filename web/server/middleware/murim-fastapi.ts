import { defineEventHandler, getRequestURL, proxyRequest } from 'h3'

const routes: Readonly<Record<string, ReadonlySet<string>>> = {
  GET: new Set([
    'arsenal', 'arsenal/conjuntos', 'catalogo', 'conquistas', 'conta', 'estado', 'extrato',
    'heroi', 'missao', 'mobile/config', 'painel', 'progresso', 'saude/health-connect',
    'saude/resumo', 'strava/callback', 'strava/config', 'strava/status', 'treinos/historico',
    'treinos/personalizados', 'votos',
  ]),
  POST: new Set([
    'arsenal', 'arsenal/conjuntos', 'missao', 'oracle/ask', 'saude/health-connect',
    'saude/importar', 'strava/auth-url', 'strava/disconnect', 'strava/sync', 'treinos/concluir', 'votos',
  ]),
  PUT: new Set(['heroi', 'saude/peso']),
  DELETE: new Set(['saude/peso']),
}

export default defineEventHandler((event) => {
  const upstream = useRuntimeConfig(event).murimFastapiOrigin
  if (!upstream) return
  const url = getRequestURL(event)
  const path = url.pathname
  const method = event.method
  if (!path.startsWith('/api/')) return
  const route = path.slice(5)
  const customWorkout = (method === 'PUT' || method === 'DELETE')
    && /^treinos\/personalizados\/[^/]+$/.test(route)
  if (!routes[method]?.has(route) && !customWorkout) return

  const target = new URL(upstream)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if (!(target.protocol === 'https:' || (local && target.protocol === 'http:'))
    || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw createError({ statusCode: 503, statusMessage: 'API indisponivel' })
  }
  target.pathname = path
  target.search = url.search
  return proxyRequest(event, target.href, {
    fetchOptions: { redirect: 'manual', signal: AbortSignal.timeout(35_000) },
  })
})
