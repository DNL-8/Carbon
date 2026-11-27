import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { z } from 'zod'
import { healthActivitySchema, type HealthActivityInput } from '../../shared/health'

const STATE = 'murim_strava_state'
const SESSION = 'murim_strava_session'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const stateSchema = z.object({ state: z.string(), userId: z.string(), expires: z.number() })
const sessionSchema = z.object({ userId: z.string(), access: z.string().min(1).max(512), refresh: z.string().min(1).max(512), expires: z.number(), athleteId: z.number().int().positive() })
type StravaSession = z.infer<typeof sessionSchema>
const tokenSchema = z.object({ access_token: z.string().min(1).max(512), refresh_token: z.string().min(1).max(512), expires_at: z.number().int(), athlete: z.object({ id: z.number().int().positive() }).optional() })
export function stravaConfig() {
  const id = process.env.STRAVA_CLIENT_ID?.trim()
  const secret = process.env.STRAVA_CLIENT_SECRET?.trim()
  const encryption = process.env.STRAVA_SESSION_SECRET?.trim()
  let origin: string | undefined
  try { if (process.env.BETTER_AUTH_URL) origin = new URL(process.env.BETTER_AUTH_URL).origin } catch { /* invalid config */ }
  const configured = Boolean(id && secret && encryption && encryption.length >= 32 && origin?.startsWith('https://'))
  return { configured, callbackUrl: origin ? origin + '/api/strava/callback' : null, id, secret, encryption, origin }
}
function config() {
  const c = stravaConfig()
  if (!c.configured) throw createError({ statusCode: 503, statusMessage: 'Strava nao configurado' })
  return { id: c.id!, secret: c.secret!, key: createHash('sha256').update(c.encryption!).digest(), origin: c.origin!, callbackUrl: c.callbackUrl! }
}
function seal(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', config().key, iv)
  const content = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), content].map(item => item.toString('base64url')).join('.')
}
function unseal(raw?: string) {
  if (!raw || raw.length > 4096) return null
  try {
    const parts = raw.split('.').map(part => Buffer.from(part, 'base64url'))
    if (parts.length !== 3 || parts[0]!.length !== 12 || parts[1]!.length !== 16) return null
    const cipher = createDecipheriv('aes-256-gcm', config().key, parts[0]!)
    cipher.setAuthTag(parts[1]!)
    return JSON.parse(Buffer.concat([cipher.update(parts[2]!), cipher.final()]).toString('utf8')) as unknown
  } catch { return null }
}
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/api/strava' }
function saveSession(event: H3Event, session: StravaSession) {
  setCookie(event, SESSION, seal(session), { ...cookieOptions, maxAge: 30 * 24 * 3600 })
}
export function readStravaSession(event: H3Event, userId: string) {
  const result = sessionSchema.safeParse(unseal(getCookie(event, SESSION)))
  return result.success && result.data.userId === userId ? result.data : null
}
export function clearStravaSession(event: H3Event) {
  deleteCookie(event, SESSION, cookieOptions)
  deleteCookie(event, STATE, cookieOptions)
}
export function assertStravaOrigin(event: H3Event) {
  if (getRequestHeader(event, 'origin') !== config().origin) throw createError({ statusCode: 403, statusMessage: 'Origem invalida' })
}
export function createStravaAuthorization(event: H3Event, userId: string) {
  const c = config()
  const state = randomBytes(32).toString('base64url')
  setCookie(event, STATE, seal({ state, userId, expires: Date.now() + 600_000 }), { ...cookieOptions, maxAge: 600 })
  const params = new URLSearchParams({ client_id: c.id, redirect_uri: c.callbackUrl, response_type: 'code', approval_prompt: 'auto', scope: 'activity:read_all', state })
  return 'https://www.strava.com/oauth/authorize?' + params.toString()
}
async function tokens(body: Record<string, string>) {
  const c = config()
  const response = await fetch(TOKEN_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...body }) })
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Autorizacao Strava recusada' })
  const token = tokenSchema.parse(await response.json())
  if (token.expires_at <= Date.now() / 1000) throw createError({ statusCode: 502, statusMessage: 'Sessao Strava invalida' })
  return token
}
export async function finishStravaAuthorization(event: H3Event, userId: string, query: Record<string, unknown>) {
  const result = stateSchema.safeParse(unseal(getCookie(event, STATE)))
  deleteCookie(event, STATE, cookieOptions)
  if (!result.success || result.data.userId !== userId || result.data.expires < Date.now() || typeof query.state !== 'string'
      || query.state.length !== result.data.state.length || !timingSafeEqual(Buffer.from(query.state), Buffer.from(result.data.state))) {
    throw createError({ statusCode: 403, statusMessage: 'Estado OAuth invalido' })
  }
  if (typeof query.code !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(query.code) || typeof query.scope !== 'string' || !query.scope.split(',').includes('activity:read_all')) {
    throw createError({ statusCode: 400, statusMessage: 'Autorizacao nao concedida' })
  }
  const token = await tokens({ code: query.code, grant_type: 'authorization_code' })
  if (!token.athlete) throw createError({ statusCode: 502, statusMessage: 'Atleta Strava invalido' })
  saveSession(event, { userId, access: token.access_token, refresh: token.refresh_token, expires: token.expires_at, athleteId: token.athlete.id })
}
export async function freshStravaSession(event: H3Event, userId: string) {
  const session = readStravaSession(event, userId)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Conecte o Strava' })
  if (session.expires > Date.now() / 1000 + 120) return session
  const token = await tokens({ refresh_token: session.refresh, grant_type: 'refresh_token' })
  const updated = { ...session, access: token.access_token, refresh: token.refresh_token, expires: token.expires_at }
  saveSession(event, updated)
  return updated
}
const activity = z.object({
  id: z.number().int().positive(), name: z.string().optional(), sport_type: z.string().optional(), type: z.string().optional(),
  start_date: z.iso.datetime({ offset: true }), start_date_local: z.string().optional(), moving_time: z.number().nonnegative().optional(), elapsed_time: z.number().nonnegative().optional(),
  distance: z.number().nonnegative().optional(), total_elevation_gain: z.number().optional(), calories: z.number().nonnegative().optional(), average_heartrate: z.number().nonnegative().optional(), max_heartrate: z.number().nonnegative().optional(),
})
export function mapStravaActivity(raw: unknown): HealthActivityInput | null {
  const parsed = activity.safeParse(raw)
  if (!parsed.success) return null
  const a = parsed.data
  const dateKey = a.start_date_local?.slice(0, 10) ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(a.start_date))
  const sport = (a.sport_type || a.type || 'Workout').slice(0, 240)
  const durationMinutes = (a.moving_time ?? a.elapsed_time ?? 0) / 60
  if (durationMinutes <= 0) return null
  const result = healthActivitySchema.safeParse({
    externalId: 'strava_' + a.id, source: 'strava', title: (a.name?.trim() || sport).slice(0, 240), sportType: sport, dateKey,
    startedAt: a.start_date, durationMinutes, distanceKm: (a.distance ?? 0) / 1000, calories: a.calories ?? 0,
    elevationGainM: Math.max(0, a.total_elevation_gain ?? 0), avgHeartRate: a.average_heartrate ?? null, maxHeartRate: a.max_heartrate ?? null,
    zoneMinutes: [0, 0, 0, 0, 0], hrSamplePoints: [],
  })
  return result.success ? result.data : null
}
export async function fetchStravaActivities(session: StravaSession, days: number) {
  const after = Math.floor(Date.now() / 1000) - days * 86_400
  const signal = AbortSignal.timeout(18_000)
  const records: HealthActivityInput[] = []
  let truncated = false
  for (let page = 1; page <= 3; page++) {
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?' + new URLSearchParams({ after: String(after), per_page: '50', page: String(page) }), {
      headers: { Authorization: 'Bearer ' + session.access }, redirect: 'error', signal,
    })
    if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Falha ao consultar atividades Strava' })
    const rows = z.array(z.unknown()).max(50).parse(await response.json())
    for (const row of rows) { const mapped = mapStravaActivity(row); if (mapped) records.push(mapped) }
    if (rows.length < 50) break
    truncated = page === 3
  }
  return { records, truncated }
}
