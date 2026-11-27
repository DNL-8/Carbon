import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { Pool } from 'pg'
import { chromium } from 'playwright-core'

const database = new URL(process.env.MURIM_TEST_DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
assert.equal(database.pathname, '/murim_fastapi_test')
assert.equal(database.search, '')
const db = new Pool({ connectionString: database.href })
const origin = 'http://127.0.0.1:38186'
const proxy = 'http://127.0.0.1:38187'
const python = 'http://127.0.0.1:38188'
const stravaOrigin = 'https://murim.example.test'
const env = {
  ...process.env, HOST: '127.0.0.1', PORT: '38186', DATABASE_URL: database.href,
  BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: 'synthetic-ci-only-better-auth-test-secret',
  RESEND_API_KEY: 'mock', AUTH_EMAIL_FROM: 'Test <test@example.test>',
  NUXT_MURIM_FASTAPI_ORIGIN: '',
  GEMINI_API_KEY: 'mock', GEMINI_MODEL: 'mock-local-model',
  STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'mock',
  STRAVA_SESSION_SECRET: 'synthetic-local-test-strava-session-secret',
}
const children = []
const accounts = []
let emailLink
const nativeFetch = globalThis.fetch
function run(command, args, options) {
  const child = spawn(command, args, { stdio: 'inherit', ...options })
  children.push(child)
  return child
}
async function waitFor(endpoint, child) {
  for (let i = 0; i < 80; i++) {
    if (child?.exitCode != null) break
    try { if ((await nativeFetch(endpoint, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* starting */ }
    await delay(200)
  }
  throw Error('Serviço de teste indisponível em ' + endpoint)
}
async function send(base, method, path, cookie, body, requestOrigin = base === proxy ? proxy : origin) {
  const response = await nativeFetch(base + '/api/' + path, {
    method, headers: {
      Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(12000),
  })
  return response
}
async function createAccount() {
  const email = randomUUID() + '@example.test'
  accounts.push(email)
  const info = { email, password: 'synthetic-local-test-password' }
  emailLink = undefined
  const register = await send(origin, 'POST', 'auth/sign-up/email', '', { ...info, name: 'Teste', callbackURL: '/' })
  assert.equal(register.status, 200, await register.text())
  assert.ok(emailLink)
  assert.equal((await nativeFetch(emailLink, { redirect: 'manual' })).status, 302)
  const login = await send(origin, 'POST', 'auth/sign-in/email', '', info)
  assert.equal(login.status, 200, await login.text())
  return login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
}

try {
  Object.assign(process.env, env)
  globalThis.fetch = (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      emailLink = JSON.parse(options.body).text.split('\n\n').at(-1)
      return Promise.resolve(Response.json({}))
    }
    const target = url instanceof Request ? url.url : String(url)
    if (target === 'https://www.strava.com/oauth/token') {
      return Promise.resolve(Response.json({
        access_token: 'test-access', refresh_token: 'test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600, athlete: { id: 5 },
      }))
    }
    if (target.startsWith('https://www.strava.com/api/v3/athlete/activities?')) {
      return Promise.resolve(Response.json([{
        id: 17, name: 'Atividade Strava de teste', type: 'Run',
        start_date: new Date().toISOString(), moving_time: 1800,
      }]))
    }
    if (target.startsWith('https://generativelanguage.googleapis.com/')) {
      return Promise.resolve(Response.json({
        candidates: [{ content: { parts: [{ text: 'Resposta de teste do Oráculo.' }] } }],
      }))
    }
    return nativeFetch(url, options)
  }
  await import('../web/.output/server/index.mjs')
  const backend = run('backend/.venv/bin/uvicorn', ['tests.http_parity_server:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '38188', '--no-access-log'], {
    env: { ...env, AUTH_ORIGIN: origin, BETTER_AUTH_URL: proxy, ENABLE_WRITES: 'true' },
  })
  const gateway = run(process.execPath, ['web/.output/server/index.mjs'], {
    env: { ...env, PORT: '38187', NUXT_MURIM_FASTAPI_ORIGIN: python },
  })
  await Promise.all([
    waitFor(origin + '/api/health'), waitFor(python + '/api/ready', backend), waitFor(proxy + '/api/health', gateway),
  ])
  const [nitroCookie, fastapiCookie] = [await createAccount(), await createAccount()]
  const paths = new Set()
  async function compare(method, path, body, status = 200, transform = value => value) {
    const left = await send(origin, method, path, nitroCookie, body)
    const right = await send(proxy, method, path, fastapiCookie, body)
    assert.equal(left.status, status, method + ' Nitro ' + path + ' ' + await left.clone().text())
    assert.equal(right.status, status, method + ' FastAPI ' + path + ' ' + await right.clone().text())
    if (status === 200) assert.deepEqual(transform(await right.json()), transform(await left.clone().json()), method + ' ' + path)
    paths.add(method + ' ' + path.split('?')[0])
    return left
  }

  for (const path of ['conta', 'estado', 'painel', 'progresso', 'heroi', 'missao', 'votos', 'arsenal',
    'arsenal/conjuntos', 'extrato', 'treinos/personalizados', 'saude/health-connect', 'saude/resumo', 'treinos/historico', 'conquistas']) await compare('GET', path)
  const catalog = await (await compare('GET', 'catalogo')).json()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const profile = { name: 'Teste', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante', restingHrBaseline: 60 }
  await compare('PUT', 'heroi', profile)
  await compare('PUT', 'saude/peso', { kg: 75, dateKey: today })
  await compare('POST', 'missao', { id: 'weight_today' })
  await compare('POST', 'missao', { id: 'weight_today' })
  const workout = catalog[0]
  const completion = {
    id: randomUUID(), workoutId: workout.id, elapsedSeconds: 1800,
    sets: workout.exercises.map(e => ({ exerciseId: e.id, weightKg: 80, reps: 10 })),
  }
  await compare('POST', 'treinos/concluir', completion)
  await compare('POST', 'treinos/concluir', completion)
  await compare('POST', 'treinos/concluir', { ...completion, sets: completion.sets.slice(0, 1) }, 409)
  const vow = randomUUID()
  await compare('POST', 'votos', { id: vow, action: 'create', title: 'Voto de teste' })
  await compare('POST', 'votos', { id: vow, action: 'violate' })
  await compare('POST', 'votos', { id: vow, action: 'violate' })
  await compare('POST', 'votos', { id: vow, action: 'complete' }, 409)
  const health = {
    externalId: 'health-connect-parity', source: 'health_connect', title: 'Corrida',
    sportType: 'Run', dateKey: today, startedAt: new Date().toISOString(), durationMinutes: 30,
    distanceKm: 5, calories: 150, elevationGainM: 20, avgHeartRate: 130, maxHeartRate: 160,
    zoneMinutes: [0, 15, 15, 0, 0], hrSamplePoints: [],
  }
  await compare('POST', 'saude/health-connect', {
    source: 'health_connect', activities: [health], dailyMetrics: [{ dateKey: today, steps: 6001, sleepHours: 8 }],
  })
  await compare('POST', 'saude/health-connect', {
    source: 'health_connect', activities: [], dailyMetrics: [{ dateKey: today, restingHeartRate: 62 }],
  })
  await compare('POST', 'saude/importar', { source: 'csv', activities: [{ ...health, source: 'csv' }], dailyMetrics: [] })
  await compare('POST', 'missao', { id: 'steps_6000' })
  await compare('POST', 'missao', { id: 'weekly_workouts_3' })
  const custom = randomUUID()
  const scrubExercise = value => JSON.parse(JSON.stringify(value, (_key, item) =>
    item?.name === 'Remada' && item.id ? { ...item, id: 'generated' } : item))
  await compare('PUT', 'treinos/personalizados/' + custom, {
    name: 'Teste', description: 'Plano', type: 'forca', durationMinutes: 12,
    exercises: [{ name: 'Remada', prescription: '3 x 10' }],
  }, 200, scrubExercise)
  await compare('POST', 'arsenal', { action: 'equip', id: 'arma_bastao_treino' })
  const loadout = randomUUID()
  const normalizeDates = value => JSON.parse(JSON.stringify(value, (key, item) => {
    if (['createdAt', 'unlockedAt', 'updatedAt'].includes(key) && typeof item === 'string') {
      assert.match(item, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
      return 'timestamp'
    }
    return item
  }))
  for (const action of ['save', 'apply', 'delete']) {
    await compare('POST', 'arsenal/conjuntos', { action, id: loadout, name: 'Paridade' }, 200, normalizeDates)
  }
  for (const path of ['estado', 'painel', 'progresso', 'heroi', 'missao', 'votos', 'arsenal',
    'arsenal/conjuntos', 'treinos/personalizados', 'saude/health-connect', 'saude/resumo?period=7&source=csv',
    'treinos/historico', 'conquistas']) await compare('GET', path, undefined, 200, value => normalizeDates(scrubExercise(value)))
  await compare('GET', 'extrato', undefined, 200, value => normalizeDates({
    ...value, entries: value.entries.map(({ id: _id, ...entry }) => entry),
  }))
  await compare('DELETE', 'treinos/personalizados/' + custom)
  await compare('DELETE', 'saude/peso', { dateKey: today })
  assert.equal((await send(proxy, 'GET', 'estado')).status, 401)
  assert.equal((await send(proxy, 'PUT', 'heroi', fastapiCookie, profile, 'https://untrusted.example.test')).status, 403)
  await compare('GET', 'mobile/config', undefined, 503)
  await compare('POST', 'oracle/ask', { question: 'Como está minha recuperação?', includeHealth: true })
  await compare('POST', 'oracle/ask', { question: 'Nova pergunta?' }, 429)

  process.env.BETTER_AUTH_URL = stravaOrigin
  try {
    await compare('GET', 'strava/config')
    await compare('GET', 'strava/status')
    const invalid = await compare('GET', 'strava/callback', undefined, 303)
    assert.match(invalid.headers.get('location'), /strava=error/)

    function cookie(response, name) {
      return response.headers.getSetCookie().find(value => value.startsWith(name + '=')).split(';')[0]
    }
    async function authorize(base, auth) {
      const response = await send(base, 'POST', 'strava/auth-url', auth, undefined, stravaOrigin)
      assert.equal(response.status, 200)
      const authorization = new URL((await response.json()).url)
      const state = authorization.searchParams.get('state')
      authorization.searchParams.delete('state')
      const callback = await send(base, 'GET', 'strava/callback?' + new URLSearchParams({
        state, code: 'synthetic-code', scope: 'activity:read_all',
      }), auth + '; ' + cookie(response, 'murim_strava_state'))
      assert.equal(callback.status, 303)
      assert.equal(callback.headers.get('referrer-policy'), 'no-referrer')
      assert.match(callback.headers.get('location'), /strava=connected/)
      return { authorization: authorization.href, strava: cookie(callback, 'murim_strava_session') }
    }
    const nitro = await authorize(origin, nitroCookie)
    const fastapi = await authorize(proxy, fastapiCookie)
    assert.equal(fastapi.authorization, nitro.authorization)
    paths.add('POST strava/auth-url')
    for (const [base, auth, session] of [
      [proxy, nitroCookie, nitro.strava],
      [origin, fastapiCookie, fastapi.strava],
    ]) {
      const response = await send(base, 'GET', 'strava/status', auth + '; ' + session)
      assert.equal((await response.json()).connected, true)
    }
    for (const [base, auth, session] of [
      [origin, nitroCookie, nitro.strava],
      [proxy, fastapiCookie, fastapi.strava],
    ]) {
      const combined = auth + '; ' + session
      const sync = async () => (await send(base, 'POST', 'strava/sync', combined, { days: 7 }, stravaOrigin)).json()
      assert.deepEqual(await sync(), { imported: 1, duplicates: 0, xp: 113, truncated: false })
      assert.deepEqual(await sync(), { imported: 0, duplicates: 1, xp: 0, truncated: false })
      const disconnected = await send(base, 'POST', 'strava/disconnect', combined, undefined, stravaOrigin)
      assert.deepEqual(await disconnected.json(), { disconnected: true })
      assert.equal(disconnected.headers.getSetCookie().filter(value => value.includes('Max-Age=0')).length, 2)
    }
    paths.add('POST strava/sync')
    paths.add('POST strava/disconnect')
  } finally {
    process.env.BETTER_AUTH_URL = origin
  }

  if (process.argv.includes('--browser')) {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined })
    try {
      const page = await browser.newPage()
      await page.context().addCookies(fastapiCookie.split('; ').map(pair => {
        const separator = pair.indexOf('=')
        return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: proxy }
      }))
      await page.goto(proxy + '/?tab=painel')
      await page.getByRole('heading', { name: 'Painel de controle' }).waitFor()
      assert.equal(await page.request.get(proxy + '/api/painel').then(response => response.status()), 200)
      const status = await page.evaluate(async dateKey => {
        const response = await fetch('/api/saude/peso', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateKey, kg: 76 }),
        })
        return response.status
      }, today)
      assert.equal(status, 200)
    } finally {
      await browser.close()
    }
  }
  const handlers = await readdir('web/server/api', { recursive: true })
  const missing = handlers.filter(filename => {
    const match = filename.match(/^(.*)\.(get|post|put|delete)\.ts$/)
    if (!match || ['health', 'ready'].includes(match[1])) return false
    const [_, route, method] = match
    return !paths.has(method.toUpperCase() + ' ' + route.replace('[id]', custom))
  })
  assert.deepEqual(missing, [], 'rotas de negócio sem teste de paridade')
  console.log(`Paridade Nitro/FastAPI verificada por HTTP em ${paths.size} combinações de método e rota.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  for (const child of children) child.kill()
  if (accounts.length) await db.query('DELETE FROM auth_user WHERE email = ANY($1::text[])', [accounts])
  await db.end()
}
process.exit(process.exitCode ?? 0)
