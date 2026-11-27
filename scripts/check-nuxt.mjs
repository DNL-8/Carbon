import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_EQUIPPED_GEAR, EQUIPMENT_SETS, calculateGearBonusSummary, WARRIOR_AWAKENING_PROGRAM, HYBRID_CALISTHENICS_PROGRAM } from '../src/utils/rpgLogic.ts'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { buildCsvTemplateSample, buildSamsungHealthSampleCsv, parseCsvHealthContent } from '../src/utils/healthParsers.ts'
import { chromium } from 'playwright-core'

const db = await PGlite.create()
let code = 1
try {
  await db.exec(await readFile('web/drizzle/0000_wild_shinobi_shaw.sql', 'utf8'))
  await db.exec(`
    INSERT INTO auth_user (id, name, email) VALUES ('previous', 'Previous', 'previous@example.com');
    INSERT INTO fitness_completion (user_id, id, workout_id, sets, xp, coins)
    VALUES ('previous', 'legacy', 'original', '[{"exerciseId":"squat","weightKg":30,"reps":10}]', 10, 2);
  `)
  await db.exec(await readFile('web/drizzle/0001_workout_records.sql', 'utf8'))
  await db.exec(await readFile('web/drizzle/0002_health_import.sql', 'utf8'))
  await db.exec(await readFile('web/drizzle/0003_hero_workouts_and_arsenal.sql', 'utf8'))
  await db.exec(await readFile('web/drizzle/0004_workout_bosses.sql', 'utf8'))
  await db.exec(await readFile('web/drizzle/0005_daily_weekly_missions.sql', 'utf8'))
  await db.exec(await readFile('web/drizzle/0006_vows_and_achievements.sql', 'utf8'))
  await db.exec("INSERT INTO fitness_progress (user_id, xp, coins) VALUES ('previous', 10, 2)")
  await db.exec(await readFile('web/drizzle/0007_reward_ledger_and_loadouts.sql', 'utf8'))
  const opening = await db.query("SELECT kind, total_xp, gold_coins FROM fitness_progress_ledger WHERE user_id = 'previous'")
  assert.deepEqual(opening.rows, [{ kind: 'adjustment', total_xp: 10, gold_coins: 2 }])
  const backfill = await db.query("SELECT best_weight_kg, estimated_1rm_kg FROM fitness_exercise_record WHERE user_id = 'previous'")
  assert.deepEqual(backfill.rows, [{ best_weight_kg: 30, estimated_1rm_kg: 40 }])
  await new PGLiteSocketServer({ db, port: 38169, host: '127.0.0.1', maxConnections: 8 }).start()
  const base = 'http://127.0.0.1:38168'
  // Both account fixtures and the browser share the loopback Nitro instance.
  const rateLimit = 1000
  Object.assign(process.env, {
    HOST: '127.0.0.1',
    PORT: '38168',
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:38169/postgres',
    BETTER_AUTH_URL: base,
    BETTER_AUTH_SECRET: 'local-smoke-test-only-abcdefghijklmnopqrstuvwxyz',
    RESEND_API_KEY: 'mock',
    AUTH_EMAIL_FROM: 'App <test@example.com>',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    NUXT_SECURITY_RATE_LIMITER_TOKENS_PER_INTERVAL: String(rateLimit),
    GEMINI_API_KEY: 'mock',
    GEMINI_MODEL: 'mock-local-model',
    STRAVA_CLIENT_ID: '1',
    STRAVA_CLIENT_SECRET: 'mock',
    STRAVA_SESSION_SECRET: 'strava-local-smoke-test-only-abcdefghijklmnopqrstuvwxyz',
  })
  const nativeFetch = globalThis.fetch
  let emailLink
  const oracleRequests = []
  globalThis.fetch = (input, options) => {
    if (input === 'https://api.resend.com/emails') {
      emailLink = JSON.parse(options.body).text.split('\n\n').at(-1)
      return Promise.resolve(new Response('{}', { status: 200 }))
    }
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      const body = input instanceof Request ? input.clone().json() : Promise.resolve(JSON.parse(options.body))
      return body.then(json => {
        oracleRequests.push(JSON.parse(json.contents[0].parts[0].text).context)
        return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'Resposta de teste do Oráculo.' }] } }] })
      })
    }
    if (url === 'https://www.strava.com/oauth/token') {
      return Promise.resolve(Response.json({ access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, athlete: { id: 5 } }))
    }
    if (url.startsWith('https://www.strava.com/api/v3/athlete/activities?')) {
      return Promise.resolve(Response.json([{ id: 17, name: 'Atividade Strava fictícia', type: 'Run', start_date: new Date().toISOString(), moving_time: 1800 }]))
    }
    return nativeFetch(input, options)
  }
  await import('../web/.output/server/index.mjs')
  const healthCheck = await nativeFetch(base + '/api/health')
  assert.deepEqual(await healthCheck.json(), { status: 'ok', revision: 'a'.repeat(40) })
  const readiness = await nativeFetch(base + '/api/ready')
  assert.equal(readiness.status, 200)
  assert.deepEqual(await readiness.json(), { ready: true })
  const send = (path, body, cookie, method = 'POST') => nativeFetch(base + path, {
    signal: AbortSignal.timeout(7000),
    method,
    headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  const credentials = { email: 'tester@example.com', password: 'local-only-test-password' }
  const signup = await send('/api/auth/sign-up/email', { ...credentials, name: 'Tester', callbackURL: '/' })
  console.log('Cadastro:', signup.status)
  assert.equal(signup.status, 200, await signup.text())
  assert.ok(emailLink)
  assert.equal((await nativeFetch(emailLink, { redirect: 'manual' })).status, 302)
  const login = await send('/api/auth/sign-in/email', credentials)
  assert.equal(login.status, 200, await login.text())
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const unauthorized = await nativeFetch(base + '/api/progresso')
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.headers.get('x-content-type-options'), 'nosniff')
  const catalog = await (await nativeFetch(base + '/api/catalogo')).json()
  for (const id of [WARRIOR_AWAKENING_PROGRAM.workoutAId, WARRIOR_AWAKENING_PROGRAM.workoutBId, HYBRID_CALISTHENICS_PROGRAM.workoutAId]) {
    assert.ok(catalog.some(workout => workout.id === id))
  }
  const workout = catalog[0]
  const payload = { id: crypto.randomUUID(), workoutId: workout.id, sets: [{ exerciseId: workout.exercises[0].id, reps: 10, weightKg: 5 }] }
  const first = await send('/api/treinos/concluir', payload, cookie)
  console.log('Conclusão:', first.status)
  assert.equal(first.status, 200, await first.clone().text())
  const reward = await first.json()
  const replay = await send('/api/treinos/concluir', payload, cookie)
  assert.deepEqual(await replay.json(), reward)
  const progress = await (await nativeFetch(base + '/api/progresso', { headers: { Cookie: cookie } })).json()
  assert.ok(progress.xp > 0)
  assert.equal(progress.xp, reward.earnedXp)
  const page = await nativeFetch(base, { headers: { Cookie: cookie } })
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Crie sua ficha de personagem/)
  const history = async (cookie) => (await nativeFetch(base + '/api/treinos/historico', { headers: { Cookie: cookie } })).json()
  const saved = await history(cookie)
  assert.equal(saved.history.length, 1)
  assert.equal(saved.history[0].sets[0].weightKg, 5)
  assert.equal(saved.records[0].bestWeightKg, 5)
  const lighter = await send('/api/treinos/concluir', {
    ...payload,
    id: crypto.randomUUID(),
    sets: [{ ...payload.sets[0], weightKg: 4 }],
  }, cookie)
  assert.equal(lighter.status, 200)
  assert.ok((await lighter.json()).earnedXp < reward.earnedXp)
  assert.equal((await history(cookie)).records[0].bestWeightKg, 5)
  const parsed = parseCsvHealthContent(buildCsvTemplateSample(), 'sample.csv')
  const health = { source: 'csv', activities: parsed.activities, dailyMetrics: parsed.dailyMetrics }
  const imported = await send('/api/saude/importar', health, cookie)
  assert.equal(imported.status, 200, await imported.clone().text())
  const healthResult = await imported.json()
  assert.equal(healthResult.imported, parsed.activities.length)
  assert.ok(healthResult.xp > 0)
  const reimported = await send('/api/saude/importar', health, cookie)
  assert.deepEqual(await reimported.json(), { imported: 0, duplicates: parsed.activities.length, days: parsed.dailyMetrics.length, xp: 0 })
  assert.equal((await send('/api/saude/importar', { ...health, dailyMetrics: [{ dateKey: 'abc' }] }, cookie)).status, 400)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10)
  const sync = dailyMetrics => send('/api/saude/health-connect', { source: 'health_connect', activities: [], dailyMetrics }, cookie)
  assert.equal((await sync([{ dateKey: today }])).status, 400)
  assert.equal((await sync([{ dateKey: today, steps: 800, sleepHours: 7 }, { dateKey: today, activeCalories: 200 }])).status, 200)
  const partial = await sync([{ dateKey: today, steps: 0 }, { dateKey: yesterday, sleepHours: 6 }])
  assert.deepEqual(await partial.json(), { imported: 0, duplicates: 0, days: 2, xp: 0 })
  const healthSummary = await (await nativeFetch(base + '/api/saude/resumo?source=health_connect', { headers: { Cookie: cookie } })).json()
  assert.deepEqual(healthSummary.dailyMetrics.map(row => row.data), [
    { dateKey: today, steps: 0, activeCalories: 200, sleepHours: 7 },
    { dateKey: yesterday, sleepHours: 6 },
  ])
  const secondAccount = { ...credentials, email: 'other@example.com' }
  assert.equal((await send('/api/auth/sign-up/email', { ...secondAccount, name: 'Other' })).status, 200)
  await nativeFetch(emailLink, { redirect: 'manual' })
  const secondLogin = await send('/api/auth/sign-in/email', secondAccount)
  assert.equal(secondLogin.status, 200)
  const secondCookie = secondLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const hcStatus = await nativeFetch(base + '/api/saude/health-connect', { headers: { Cookie: cookie } })
  assert.equal(hcStatus.status, 200)
  assert.match(hcStatus.headers.get('cache-control'), /no-store/)
  assert.deepEqual((await hcStatus.json()).dailyMetrics, [
    { dateKey: today, steps: 0, calories: 200, sleepHours: 7 },
    { dateKey: yesterday, steps: null, calories: null, sleepHours: 6 },
  ])
  const isolatedHcStatus = await nativeFetch(base + '/api/saude/health-connect', { headers: { Cookie: secondCookie } })
  assert.equal(isolatedHcStatus.status, 200)
  assert.deepEqual((await isolatedHcStatus.json()).dailyMetrics, [])
  assert.equal((await nativeFetch(base + '/api/saude/health-connect')).status, 401)
  const secondProgress = await (await nativeFetch(base + '/api/progresso', { headers: { Cookie: secondCookie } })).json()
  assert.equal(secondProgress.xp, 0)
  assert.deepEqual(await history(secondCookie), { history: [], records: [] })
  const read = (path, cookie) => nativeFetch(base + path, { headers: { Cookie: cookie } })
  const profile = { name: 'Herói teste', heroClass: 'Mago', objective: 'Ambos', experience: 'Iniciante' }
  assert.equal((await send('/api/heroi', profile, cookie, 'PUT')).status, 200)
  assert.deepEqual(await (await read('/api/heroi', cookie)).json(), { profile })
  assert.deepEqual(await (await read('/api/heroi', secondCookie)).json(), { profile: null })
  const customId = crypto.randomUUID()
  const customInput = {
    name: 'Treino personalizado', description: '', type: 'forca', durationMinutes: 20,
    exercises: [{ name: 'Remada', prescription: '3 séries x 12 repetições' }],
  }
  const putCustom = await send(`/api/treinos/personalizados/${customId}`, customInput, cookie, 'PUT')
  assert.equal(putCustom.status, 200, await putCustom.clone().text())
  const custom = await putCustom.json()
  assert.deepEqual(await (await read('/api/treinos/personalizados', secondCookie)).json(), [])
  const customCompletion = { id: crypto.randomUUID(), workoutId: customId, sets: [{ exerciseId: custom.exercises[0].id, reps: 10, weightKg: 15 }] }
  assert.equal((await send('/api/treinos/concluir', customCompletion, secondCookie)).status, 400)
  const completedCustom = await send('/api/treinos/concluir', customCompletion, cookie)
  assert.equal(completedCustom.status, 200)
  assert.equal((await completedCustom.json()).bossDefeated, true)
  assert.equal((await send(`/api/treinos/personalizados/${customId}`, {
    ...customInput, name: 'Treino editado', exercises: [{ name: 'Puxada', prescription: '3 séries x 8 repetições' }],
  }, cookie, 'PUT')).status, 200)
  assert.equal((await send('/api/treinos/concluir', customCompletion, cookie)).status, 200)
  assert.equal((await history(cookie)).history[0].name, customInput.name)
  const claimed = await send('/api/missao', {}, cookie)
  assert.equal(claimed.status, 200, await claimed.clone().text())
  assert.equal((await claimed.json()).claimed, true)
  const afterClaim = await (await read('/api/progresso', cookie)).json()
  assert.equal((await send('/api/missao', {}, cookie)).status, 200)
  assert.deepEqual(await (await read('/api/progresso', cookie)).json(), afterClaim)
  assert.equal((await send('/api/missao', {}, secondCookie)).status, 409)
  assert.equal((await send('/api/saude/peso', { kg: 72.4 }, cookie, 'PUT')).status, 200)
  const ownOverview = await (await read('/api/painel', cookie)).json()
  assert.equal(ownOverview.weights[0].kg, 72.4)
  assert.equal(ownOverview.days.length, 7)
  assert.equal((await (await read('/api/progresso', cookie)).json()).realm, ownOverview.dual.murim.current.name)
  assert.equal((await (await read('/api/painel', secondCookie)).json()).weights.length, 0)
  assert.equal((await nativeFetch(base + '/api/painel')).status, 401)
  assert.equal((await send('/api/saude/peso', { dateKey: ownOverview.weights[0].dateKey }, secondCookie, 'DELETE')).status, 200)
  assert.equal((await (await read('/api/painel', cookie)).json()).weights[0].kg, 72.4)
  assert.equal((await send('/api/missao', { id: 'weight_today' }, cookie)).status, 200)
  assert.equal((await send('/api/missao', { id: 'weekly_pr_1' }, cookie)).status, 200)
  const missions = await (await read('/api/missao', cookie)).json()
  assert.equal(missions.weightKg, 72.4)
  assert.equal(missions.daily.find(quest => quest.id === 'weight_today').claimed, true)
  assert.equal(missions.weekly.find(quest => quest.id === 'weekly_pr_1').claimed, true)
  assert.ok(missions.raid.damageDealt > 0)
  const achievements = await (await read('/api/conquistas', cookie)).json()
  assert.ok(achievements.find(item => item.id === 'first_blood')?.unlockedAt)
  assert.ok(achievements.find(item => item.id === 'first_pr')?.unlockedAt)
  const vowId = crypto.randomUUID()
  assert.equal((await send('/api/votos', { action: 'create', id: vowId, title: 'Alongar' }, cookie)).status, 200)
  assert.equal((await send('/api/votos', { action: 'complete', id: vowId }, secondCookie)).status, 404)
  const beforeVow = await (await read('/api/progresso', cookie)).json()
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await send('/api/votos', { action: 'complete', id: vowId }, cookie)).status, 200)
  }
  assert.equal((await (await read('/api/progresso', cookie)).json()).xp, beforeVow.xp + 15)
  assert.equal((await send('/api/votos', { action: 'violate', id: vowId }, cookie)).status, 409)
  const equipment = await (await read('/api/arsenal', cookie)).json()
  assert.equal(equipment.length, 52)
  assert.equal(EQUIPMENT_SETS.length, 10)
  const firstSet = EQUIPMENT_SETS[0].id
  const pieces = equipment.filter(item => item.setId === firstSet)
  const piecesBySlot = [...new Map(pieces.map(item => [item.slot, item.id])).entries()]
  const activeSet = size => calculateGearBonusSummary(Object.fromEntries(piecesBySlot.slice(0, size))).activeSets.find(set => set.set.id === firstSet)
  assert.equal(activeSet(1).twoPieceActive, false)
  assert.equal(activeSet(2).twoPieceActive, true)
  assert.equal(activeSet(2).fourPieceActive, false)
  assert.equal(activeSet(4).fourPieceActive, true)
  assert.ok(equipment.some(item => item.owned))
  assert.equal((await send('/api/arsenal', { id: equipment.find(item => item.owned).id, action: 'equip' }, cookie)).status, 200)
  assert.equal((await send('/api/arsenal', { id: equipment.find(item => !item.owned).id, action: 'buy' }, secondCookie)).status, 409)
  await db.query('UPDATE fitness_progress SET xp = 1000000, coins = 1000000 WHERE user_id = (SELECT id FROM auth_user WHERE email = $1)', [credentials.email])
  const stocked = await (await read('/api/arsenal', cookie)).json()
  const purchase = stocked.find(item => !item.owned && item.unlock.met && item.priceCoins > 0)
  assert.ok(purchase)
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await send('/api/arsenal', { id: purchase.id, action: 'buy' }, cookie)).status, 200)
  }
  assert.equal((await (await read('/api/progresso', cookie)).json()).coins, 1_000_000 - purchase.priceCoins)
  assert.equal((await send('/api/arsenal', { id: purchase.id, action: 'equip' }, cookie)).status, 200)
  assert.ok((await (await read('/api/arsenal', cookie)).json()).find(item => item.id === purchase.id)?.equipped)
  const loadoutId = crypto.randomUUID()
  const loadoutRoute = '/api/arsenal/conjuntos'
  assert.equal((await send(loadoutRoute, { id: loadoutId, action: 'save', name: 'Meu conjunto' }, cookie)).status, 200)
  assert.equal((await send(loadoutRoute, { id: loadoutId, action: 'apply' }, secondCookie)).status, 404)
  const loadouts = await (await read(loadoutRoute, cookie)).json()
  assert.equal(loadouts[0].gear[purchase.slot], purchase.id)
  assert.equal((await send(loadoutRoute, { id: loadoutId, action: 'apply' }, cookie)).status, 200)
  assert.equal((await send(loadoutRoute, { id: loadoutId, action: 'delete' }, cookie)).status, 200)
  assert.deepEqual(await (await read(loadoutRoute, cookie)).json(), [])
  const rewards = await (await read('/api/extrato', cookie)).json()
  assert.equal(rewards.entries.filter(entry => entry.kind === 'armory_purchase').length, 1)
  assert.equal(rewards.entries.find(entry => entry.kind === 'armory_purchase').coinDelta, -purchase.priceCoins)
  assert.equal(rewards.entries.filter(entry => entry.kind === 'vow_completed').length, 1)
  assert.deepEqual(await (await read('/api/extrato', secondCookie)).json(), { entries: [], nextCursor: null })
  const again = () => send('/api/treinos/concluir', { ...payload, id: crypto.randomUUID(), elapsedSeconds: 1200 }, cookie)
  for (let n = 0; n < 3; n++) assert.equal((await again()).status, 200)
  assert.equal((await send('/api/oracle/ask', { question: 'Como está meu treino?', includeHealth: true }, cookie)).status, 200)
  assert.ok(oracleRequests[0].training.possiblePlateaus > 0)
  assert.equal(oracleRequests[0].recovery.periodDays, 28)
  assert.equal(oracleRequests[0].health, undefined)
  assert.ok(!JSON.stringify(oracleRequests[0]).includes(credentials.email))
  assert.equal((await send('/api/oracle/ask', { question: 'Como está meu treino?' }, secondCookie)).status, 200)
  assert.equal(oracleRequests[1].training.sessionsCount, 0)
  assert.equal(oracleRequests[1].recovery, undefined)

  const healthConnect = { source: 'health_connect', activities: [{ ...parsed.activities[0], source: 'health_connect', externalId: 'health-connect-test' }], dailyMetrics: [] }
  assert.equal((await send('/api/saude/health-connect', healthConnect)).status, 401)
  const androidImport = await send('/api/saude/health-connect', healthConnect, cookie)
  assert.equal(androidImport.status, 200)
  assert.equal((await androidImport.json()).imported, 1)
  const androidReplay = await send('/api/saude/health-connect', healthConnect, cookie)
  assert.equal((await androidReplay.json()).xp, 0)
  assert.equal((await (await read('/api/saude/health-connect', secondCookie)).json()).activitiesCount, 0)

  const stravaOrigin = 'https://murim.example.test'
  function stravaPost(path, body, sessionCookie) {
    return nativeFetch(base + '/api/strava/' + path, {
      method: 'POST', headers: { Cookie: sessionCookie, Origin: stravaOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  process.env.BETTER_AUTH_URL = stravaOrigin
  try {
    const authorization = await stravaPost('auth-url', {}, cookie)
    assert.equal(authorization.status, 200)
    const redirect = new URL((await authorization.json()).url)
    const stateCookie = authorization.headers.getSetCookie().at(0).split(';')[0]
    const callback = await nativeFetch(base + '/api/strava/callback?' + new URLSearchParams({
      state: redirect.searchParams.get('state'), code: 'demo', scope: 'activity:read_all',
    }), { headers: { Cookie: cookie + '; ' + stateCookie }, redirect: 'manual' })
    assert.equal(callback.status, 303)
    assert.match(callback.headers.get('location'), /strava=connected/)
    const stravaCookie = callback.headers.getSetCookie().find(value => value.startsWith('murim_strava_session=')).split(';')[0]
    assert.equal((await stravaPost('sync', { days: 7 }, secondCookie + '; ' + stravaCookie)).status, 401)
    assert.equal((await (await stravaPost('sync', { days: 7 }, cookie + '; ' + stravaCookie)).json()).imported, 1)
    const stravaReplay = await (await stravaPost('sync', { days: 7 }, cookie + '; ' + stravaCookie)).json()
    assert.deepEqual(stravaReplay, { imported: 0, duplicates: 1, xp: 0, truncated: false })
  } finally {
    process.env.BETTER_AUTH_URL = base
  }

  console.log('Perfil, treino personalizado, missão e arsenal passaram.')
  assert.equal((await send('/api/auth/request-password-reset', {
    email: credentials.email, redirectTo: '/redefinir-senha',
  })).status, 200)
  const resetRedirect = await nativeFetch(emailLink, { redirect: 'manual' })
  assert.equal(resetRedirect.status, 302)
  const resetToken = new URL(resetRedirect.headers.get('location'), base).searchParams.get('token')
  assert.ok(resetToken)
  const newPassword = 'another-local-test-password'
  assert.equal((await send('/api/auth/reset-password', { token: resetToken, newPassword })).status, 200)
  assert.equal((await send('/api/auth/sign-in/email', { email: credentials.email, password: newPassword })).status, 200)
  if (process.argv.includes('--browser')) {
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_BIN || undefined,
    })
    try {
      async function checkLayout(page, name) {
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 880 })
          await page.evaluate(() => document.fonts.ready)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: rolagem horizontal em ${width}px`)
          if (process.env.MURIM_CAPTURE_DIR) {
            await mkdir(process.env.MURIM_CAPTURE_DIR, { recursive: true })
            await page.screenshot({ path: join(process.env.MURIM_CAPTURE_DIR, `${name}-${width}.png`), animations: 'disabled' })
          }
        }
      }
      const guest = await browser.newPage({
        viewport: { width: 390, height: 880 },
        extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.12' },
      })
      let guestSaves = 0
      guest.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/treinos/concluir')) guestSaves++
      })
      await guest.goto(base)
      await guest.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      await checkLayout(guest, 'login')
      await guest.setViewportSize({ width: 390, height: 880 })
      const loginTab = guest.getByRole('tab', { name: 'Entrar', exact: true })
      const registerTab = guest.getByRole('tab', { name: 'Criar conta', exact: true })
      await loginTab.focus()
      await guest.keyboard.press('ArrowRight')
      assert.equal(await registerTab.evaluate(element => element === document.activeElement), true)
      await guest.getByRole('tabpanel', { name: 'Criar conta' }).getByLabel('Nome do jogador').waitFor()
      await guest.keyboard.press('Home')
      assert.equal(await loginTab.getAttribute('aria-selected'), 'true')
      await guest.getByRole('button', { name: 'Entrar como visitante' }).click()
      const guestPanel = guest.getByRole('region', { name: 'Modo visitante' })
      await guestPanel.getByRole('button', { name: 'Iniciar treino' }).click()
      await guest.getByLabel('Repetições').first().fill('10')
      await guest.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
      await guest.getByRole('button', { name: 'Finalizar treino', exact: true }).click()
      await guest.getByRole('button', { name: 'Concluir treino', exact: true }).click()
      await guest.getByText('Treino concluído como visitante.', { exact: false }).waitFor()
      await guestPanel.getByText('Treinos concluídos nesta sessão: 1').waitFor()
      assert.equal(guestSaves, 0)
      await guestPanel.getByRole('button', { name: 'Voltar ao login' }).click()
      await guest.getByRole('button', { name: 'Entrar como visitante' }).waitFor()
      await guest.close()

      const desktop = await browser.newPage({
        viewport: { width: 1440, height: 880 },
        extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.10' },
      })
      desktop.on('pageerror', error => console.error('Navegador:', error.message))
      desktop.on('response', response => {
        if (response.status() >= 400 && response.url().startsWith(base + '/api/')) {
          console.log('Navegador:', response.request().method(), new URL(response.url()).pathname, response.status())
        }
      })
      await desktop.goto(base)
      await desktop.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      await desktop.getByLabel('E-mail', { exact: true }).fill(secondAccount.email)
      await desktop.getByLabel('Senha', { exact: true }).fill(secondAccount.password)
      const loginRequest = desktop.waitForResponse(response => response.url().endsWith('/api/auth/sign-in/email'))
      await desktop.getByRole('button', { name: 'Entrar com e-mail', exact: true }).click()
      assert.equal((await loginRequest).status(), 200)
      await desktop.getByRole('heading', { name: 'Crie sua ficha de personagem' }).waitFor()
      const deferredDashboardGets = new Set()
      desktop.on('request', request => {
        const url = new URL(request.url())
        if (request.method() === 'GET' && ['/api/arsenal', '/api/arsenal/conjuntos', '/api/conquistas'].includes(url.pathname)) {
          deferredDashboardGets.add(url.pathname)
        }
      })

      await desktop.getByLabel('Nome do herói').fill('Herói Murim')
      await desktop.getByRole('button', { name: 'Criar ficha', exact: true }).click()
      await desktop.getByTestId('hero-xp').waitFor()
      assert.equal(await desktop.getByTestId('hero-xp').textContent(), '0 XP')
      await desktop.getByRole('region', { name: 'Sessão recomendada' }).waitFor()
      assert.deepEqual([...deferredDashboardGets], [], 'Início deve adiar inventário, conjuntos e conquistas')
      const initialNavigation = desktop.getByRole('navigation', { name: 'Menu principal', exact: true })
      const equipmentRequests = ['/api/arsenal', '/api/arsenal/conjuntos'].map(path =>
        desktop.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'GET'),
      )
      await initialNavigation.getByRole('button', { name: 'Arsenal', exact: true }).click()
      for (const response of await Promise.all(equipmentRequests)) assert.equal(response.status(), 200)
      assert.equal(deferredDashboardGets.has('/api/conquistas'), false)
      const achievementsRequest = desktop.waitForResponse(response => new URL(response.url()).pathname === '/api/conquistas')
      await initialNavigation.getByRole('button', { name: 'Perfil', exact: true }).click()
      assert.equal((await achievementsRequest).status(), 200)

      for (const [name, tab] of Object.entries({ painel: 'painel', treino: 'treinar', arsenal: 'arsenal', perfil: 'perfil', relatorios: 'progresso', inicio: 'inicio' })) {
        await desktop.goto(base + '/?tab=' + tab)
        await desktop.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
        await checkLayout(desktop, name)
      }
      // Seed a spare cape for equipment controls without changing the test account's balance.
      await db.query(`
        INSERT INTO fitness_arsenal (user_id, owned, equipped)
        SELECT id, '["capa_pano_simples"]'::jsonb, $2::jsonb FROM auth_user WHERE email = $1
        ON CONFLICT (user_id) DO UPDATE SET owned = fitness_arsenal.owned || EXCLUDED.owned
      `, [secondAccount.email, JSON.stringify(DEFAULT_EQUIPPED_GEAR)])
      const effects = await browser.newPage({
        viewport: { width: 390, height: 880 },
        storageState: await desktop.context().storageState(),
        extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.13' },
      })
      const animationDir = process.env.MURIM_ANIMATION_DIR
      let arsenalWrites = 0
      effects.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/api/arsenal')) arsenalWrites++
      })
      await effects.goto(base + '/?tab=arsenal')
      await effects.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      const sheet = effects.locator('#arsenal-ficha')
      const avatar = sheet.locator('[data-motion]')
      const strike = sheet.getByRole('button', { name: 'Testar golpe' })
      const cape = sheet.locator('[data-slot-id="capa"]')
      const item = effects.getByRole('article').filter({ has: effects.getByRole('heading', { name: 'Manto do Viajante', exact: true }) })
      const preview = item.getByRole('button', { name: 'Visualizar' })
      const equip = item.getByRole('button', { name: 'Equipar' })
      if (animationDir) {
        await mkdir(animationDir, { recursive: true })
        await effects.screencast.start({ path: join(animationDir, 'arsenal.webm'), size: { width: 390, height: 880 } })
        await effects.reload()
        await effects.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      }

      await strike.focus()
      await effects.keyboard.press('Enter')
      await sheet.locator('[data-motion="strike"]').waitFor()
      assert.equal(await strike.getAttribute('aria-disabled'), 'true')
      assert.match(await avatar.locator('.sprite-motion').evaluate(node => getComputedStyle(node).animationName), /^strike/)
      await sheet.locator('[data-motion="idle"]').waitFor()
      await sheet.getByText('Golpe de teste concluído.', { exact: true }).waitFor({ state: 'attached' })
      assert.equal(await strike.getAttribute('aria-disabled'), 'false')
      await strike.press('Enter')
      await sheet.locator('[data-motion="strike"]').waitFor()
      await sheet.locator('[data-motion="idle"]').waitFor()
      assert.equal(arsenalWrites, 0)
      assert.equal(await avatar.getAttribute('data-motion'), 'idle')

      await cape.click()
      assert.equal(await effects.locator('#arsenal-catalogo').evaluate(node => node === document.activeElement), true)
      await preview.click()
      await sheet.getByText('Prévia: Manto do Viajante', { exact: true }).waitFor()
      await cape.getByText('Prévia', { exact: true }).waitFor()
      assert.equal(arsenalWrites, 0)
      await sheet.getByRole('button', { name: 'Limpar prévia' }).click()
      await cape.getByText('Sem peça', { exact: true }).waitFor()
      assert.equal(await preview.evaluate(node => node === document.activeElement), true)

      await preview.click()
      const failEquip = route => route.request().method() === 'POST'
        ? route.fulfill({ status: 409, json: { statusMessage: 'Equipamento indisponível' } })
        : route.continue()
      await effects.route('**/api/arsenal', failEquip)
      await equip.click()
      await effects.getByRole('alert').filter({ hasText: 'Não foi possível equipar esta peça.' }).waitFor()
      await sheet.getByText('Prévia: Manto do Viajante', { exact: true }).waitFor()
      assert.equal(await sheet.getByText('Equipado: Manto do Viajante', { exact: true }).count(), 0)
      await effects.unroute('**/api/arsenal', failEquip)
      await equip.click()
      await sheet.getByText('Equipado: Manto do Viajante', { exact: true }).waitFor()
      await cape.getByText('Equipado', { exact: true }).waitFor()
      if (animationDir) {
        await effects.waitForTimeout(700)
        await effects.screencast.stop()
      }

      await effects.getByRole('button', { name: 'Início', exact: true }).click()
      await effects.getByRole('button', { name: 'Iniciar treino', exact: true }).first().click()
      const arena = effects.getByRole('region', { name: 'Combate e tempo da sessão' })
      const heroMotion = arena.locator('.sprite-game')
      const enemyMotion = arena.locator('[data-motion]:not(.sprite-game)')
      const markSet = effects.getByRole('button', { name: 'Concluir série 1', exact: true })
      const nextExercise = effects.getByRole('button', { name: 'Próximo exercício', exact: true })
      await markSet.click()
      await arena.locator('.sprite-game[data-motion="strike"]').waitFor()
      assert.equal(await enemyMotion.getAttribute('data-motion'), 'idle')
      await arena.locator('[data-motion="hit"]').waitFor()
      await arena.locator('.sprite-game[data-motion="idle"]').waitFor()
      const exerciseCount = await effects.getByRole('heading', { name: /Lista de exercícios/ }).locator('..').getByRole('button').count()
      for (let index = 1; index < exerciseCount; index++) {
        await nextExercise.click()
        await markSet.click()
      }
      if (animationDir) {
        // Replay the winning set with the camera on the two sprites.
        await markSet.click()
        await arena.getByRole('progressbar').scrollIntoViewIfNeeded()
        await effects.screencast.start({ path: join(animationDir, 'combate.webm'), size: { width: 390, height: 880 } })
        await effects.waitForTimeout(400)
        await markSet.evaluate(button => button.click())
      }
      await arena.locator('.sprite-game[data-motion="victory"]').waitFor()
      await arena.locator('[data-motion="defeat"]').waitFor()
      assert.equal(await arena.getByRole('progressbar', { name: 'HP do chefe' }).getAttribute('value'), '0')
      if (animationDir) {
        await effects.waitForTimeout(850)
        await effects.screencast.stop()
      }
      await markSet.click()
      await arena.locator('.sprite-game[data-motion="idle"]').waitFor()
      assert.equal(await heroMotion.getAttribute('data-motion'), 'idle')
      assert.equal(await enemyMotion.getAttribute('data-motion'), 'idle')
      assert.ok(Number(await arena.getByRole('progressbar', { name: 'HP do chefe' }).getAttribute('value')) > 0)
      await effects.close()

      const mobile = await browser.newPage({
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 880 },
        storageState: await desktop.context().storageState(),
        extraHTTPHeaders: { 'X-Forwarded-For': '192.0.2.11' },
      })
      await mobile.goto(base)
      await mobile.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      const more = mobile.getByRole('button', { name: 'Mais', exact: true })
      await more.focus()
      await mobile.keyboard.press('Enter')
      const moreDialog = mobile.getByRole('dialog', { name: 'Mais opções' })
      await moreDialog.waitFor()
      await mobile.keyboard.press('Escape')
      await moreDialog.waitFor({ state: 'hidden' })
      await mobile.waitForFunction(() => document.activeElement?.textContent?.trim().endsWith('Mais'))
      await more.click()
      await moreDialog.getByRole('button', { name: 'Painel', exact: true }).click()
      await mobile.getByRole('heading', { name: 'Painel de controle' }).waitFor()
      assert.match(mobile.url(), /tab=painel/)
      await mobile.goBack()
      await mobile.getByRole('region', { name: 'Sessão recomendada' }).waitFor()
      await mobile.getByRole('button', { name: 'Relatórios', exact: true }).click()
      await mobile.getByText('Nenhuma atividade nesta combinação de período e origem.').waitFor()
      await mobile.getByRole('button', { name: 'Abrir sincronização' }).click()
      await mobile.waitForURL(/secao=sincronizacao/)
      assert.equal(await mobile.getByRole('tab', { name: 'Sincronização' }).getAttribute('aria-selected'), 'true')
      await mobile.getByRole('button', { name: 'Início', exact: true }).click()
      await mobile.getByRole('button', { name: 'Arsenal', exact: true }).click()
      const reducedSheet = mobile.locator('#arsenal-ficha')
      await reducedSheet.getByRole('button', { name: 'Testar golpe' }).click()
      await reducedSheet.locator('[data-motion="strike"]').waitFor()
      assert.equal(await reducedSheet.locator('.sprite-motion').evaluate(node => getComputedStyle(node).animationName), 'none')
      assert.equal(await reducedSheet.locator('.arena-stage').evaluate(node => getComputedStyle(node).animationName), 'none')
      await mobile.getByRole('button', { name: 'Início', exact: true }).click()
      await mobile.getByRole('button', { name: 'Iniciar treino' }).first().click()
      const bossHp = mobile.getByRole('progressbar', { name: 'HP do chefe' })
      await checkLayout(mobile, 'modo-foco')
      await mobile.setViewportSize({ width: 390, height: 880 })
      const startingHp = Number(await bossHp.getAttribute('value'))
      const reps = mobile.getByLabel('Repetições').first()
      await reps.scrollIntoViewIfNeeded()
      assert.ok(await reps.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === element
      }), 'O campo da série deve ficar acessível entre as barras fixas')
      await reps.fill('10')
      await mobile.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
      assert.ok(Number(await bossHp.getAttribute('value')) < startingHp)
      await mobile.getByRole('button', { name: 'Pausar', exact: true }).click()
      await mobile.getByRole('button', { name: 'Continuar', exact: true }).click()
      const guide = mobile.getByRole('button', { name: 'Guia técnico', exact: true })
      await mobile.context().setOffline(true)
      await guide.click()
      const dialog = mobile.getByRole('dialog')
      await dialog.getByRole('img', { name: /Demonstração anatômica/ }).waitFor()
      await dialog.getByRole('button', { name: /reproduzir/i }).waitFor()
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      await mobile.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Guia técnico')
      await mobile.getByRole('button', { name: 'Finalizar treino', exact: true }).click()
      await mobile.getByRole('button', { name: 'Concluir treino', exact: true }).click()
      await mobile.getByRole('alert').filter({ hasText: 'Envio pendente' }).waitFor()
      await mobile.context().setOffline(false)
      const retry = mobile.getByRole('button', { name: 'Reenviar treino', exact: true })
      const submitted = []
      const loseResponse = async route => {
        submitted.push(route.request().postDataJSON())
        const response = await route.fetch()
        assert.equal(response.status(), 200)
        await route.abort()
      }
      await mobile.route('**/api/treinos/concluir', loseResponse)
      const failedRequest = mobile.waitForEvent('requestfailed', request => request.url().endsWith('/api/treinos/concluir'))
      await retry.click()
      await mobile.getByRole('button', { name: 'Concluir treino', exact: true }).click()
      await failedRequest
      await mobile.getByRole('alert').filter({ hasText: 'Envio pendente' }).waitFor()
      await mobile.unroute('**/api/treinos/concluir', loseResponse)
      const finishRequest = mobile.waitForResponse(response => response.url().endsWith('/api/treinos/concluir') && response.request().method() === 'POST')
      await retry.click()
      await mobile.getByRole('button', { name: 'Concluir treino', exact: true }).click()
      const finished = await finishRequest
      assert.equal(finished.status(), 200, await finished.text())
      assert.deepEqual(finished.request().postDataJSON(), submitted[0])
      assert.equal((await history(secondCookie)).history.length, 1)
      const secondRewards = await (await read('/api/extrato', secondCookie)).json()
      assert.equal(secondRewards.entries.filter(entry => entry.kind === 'workout').length, 1)
      const receipt = mobile.getByRole('region', { name: 'Treino salvo' })
      await receipt.waitFor()
      const reward = await finished.json()
      await receipt.getByText(`+${reward.earnedXp} XP`, { exact: true }).waitFor()
      await receipt.getByRole('button', { name: 'Fechar resumo' }).click()
      await receipt.waitFor({ state: 'hidden' })
      await desktop.reload()
      await desktop.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      await desktop.getByTestId('hero-xp').waitFor()
      assert.match(await desktop.getByTestId('hero-xp').textContent(), /^[1-9][\d.]* XP$/)
      await desktop.getByText('Extrato de recompensas', { exact: true }).click()
      await desktop.getByText(/Saldo: \d+ XP e \d+ moedas/).first().waitFor()
      const desktopMenu = desktop.getByRole('navigation', { name: 'Menu principal', exact: true })
      await desktopMenu.getByRole('button', { name: 'Arsenal', exact: true }).click()
      await desktop.getByRole('heading', { name: 'Arsenal · Caçadores e Murim' }).waitFor()
      await desktop.getByLabel('Nome do conjunto').fill('Conjunto do navegador')
      await desktop.getByRole('button', { name: 'Salvar equipamento atual' }).click()
      await desktop.getByText('Conjunto do navegador', { exact: true }).and(desktop.locator(':visible')).waitFor()
      await desktopMenu.getByRole('button', { name: 'Perfil', exact: true }).click()
      await desktop.getByRole('button', { name: 'Editar', exact: true }).click()
      await desktop.getByLabel('Nome do herói').fill('Sentinela')
      await desktop.getByLabel('Altura (cm)').fill('180')
      await desktop.getByRole('dialog', { name: 'Editar ficha e zonas FC' }).getByLabel('Peso (kg)').fill('85')
      await desktop.getByRole('button', { name: 'Salvar perfil' }).click()
      await desktop.getByRole('heading', { name: 'Sentinela' }).waitFor()
      await desktop.getByText('180 cm', { exact: true }).waitFor()
      await desktop.getByText('85 kg', { exact: true }).and(desktop.locator(':visible')).waitFor()
      await desktopMenu.getByRole('button', { name: 'Início', exact: true }).click()
      await desktop.getByRole('button', { name: 'Resgatar missão' }).click()
      await desktop.getByText('Resgatada', { exact: true }).and(desktop.locator(':visible')).first().waitFor()
      await desktopMenu.getByRole('button', { name: 'Treinar', exact: true }).click()
      await desktop.getByText('Montar ou editar treino', { exact: true }).click()
      await desktop.getByLabel('Nome do treino').fill('Remada de teste')
      await desktop.getByLabel('Nome do exercício').fill('Remada')
      await desktop.getByLabel('Prescrição').fill('3 séries x 10 repetições')
      await desktop.getByRole('button', { name: 'Salvar treino' }).click()
      await desktop.getByRole('heading', { name: 'Remada de teste' }).waitFor()
      await desktopMenu.getByRole('button', { name: 'Relatórios', exact: true }).click()
      const reportOverviewTab = desktop.getByRole('tab', { name: 'Visão geral', exact: true })
      await reportOverviewTab.focus()
      await desktop.keyboard.press('End')
      const syncTab = desktop.getByRole('tab', { name: 'Sincronização' })
      assert.equal(await syncTab.getAttribute('aria-selected'), 'false')
      assert.equal(await syncTab.evaluate(element => element === document.activeElement), true)
      await desktop.keyboard.press('Enter')
      await desktop.waitForURL(/secao=sincronizacao/)
      await desktop.goBack()
      await reportOverviewTab.waitFor()
      assert.equal(await reportOverviewTab.getAttribute('aria-selected'), 'true')
      await desktop.goForward()
      await desktop.waitForURL(/secao=sincronizacao/)
      await desktop.goto(base + '/?tab=progresso&secao=invalida')
      await desktop.getByRole('tabpanel', { name: 'Visão geral' }).waitFor()
      await desktop.goto(base + '/?tab=progresso&strava=connected')
      await desktop.getByRole('tabpanel', { name: 'Sincronização' }).waitFor()
      await desktop.goto(base + '/?tab=progresso&secao=sincronizacao')
      await desktop.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__)
      const healthPanel = desktop.getByRole('region', { name: 'Health Connect', exact: true })
      await healthPanel.getByText('Entre no app Android com a mesma conta Murim', { exact: false }).waitFor()
      const importedMetrics = await send('/api/saude/health-connect', {
        source: 'health_connect', activities: [],
        dailyMetrics: [{ dateKey: today, activeCalories: 1564.5 }, { dateKey: yesterday, steps: 0, sleepHours: 7 }],
      }, secondCookie)
      assert.equal(importedMetrics.status, 200)
      await healthPanel.getByRole('button', { name: 'Atualizar dados' }).click()
      await healthPanel.getByText('1.564,5 kcal', { exact: true }).first().waitFor()
      await healthPanel.getByText('0', { exact: true }).first().waitFor()
      await healthPanel.getByText('Histórico diário', { exact: true }).click()
      await healthPanel.getByRole('table').getByRole('cell', { name: '7 h', exact: true }).waitFor()
      assert.equal(await healthPanel.getByRole('table').getByRole('row').count(), 3)
      await desktop.reload()
      await desktop.getByRole('tabpanel', { name: 'Sincronização' }).waitFor()
      const appleDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const fixtures = [
        ['csv', 'health.csv', buildCsvTemplateSample()],
        ['samsung_health', 'samsung.csv', buildSamsungHealthSampleCsv()],
        ['gpx', 'activity.gpx', '<gpx><trk><name>Corrida</name><trkseg><trkpt lat="-23.5" lon="-46.6"><time>2026-11-10T10:00:00Z</time></trkpt><trkpt lat="-23.51" lon="-46.61"><time>2026-11-10T10:15:00Z</time></trkpt></trkseg></trk></gpx>'],
        ['apple_health', 'export.xml', `<HealthData>\n<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min" startDate="${appleDate} 10:00:00 +0000" endDate="${appleDate} 10:30:00 +0000" totalDistance="4" totalDistanceUnit="km" />\n</HealthData>`],
      ]
      for (const [source, name, content] of fixtures) {
        await desktop.getByLabel('Formato').selectOption(source)
        await desktop.getByLabel('Arquivo').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) })
        await desktop.getByRole('button', { name: 'Importar', exact: true }).click()
        try {
          await desktop.getByRole('status').filter({ hasText: /^[1-9]\d* atividades novas/ }).waitFor({ timeout: 8000 })
        } catch (error) {
          throw new Error(`Falha ao importar ${source}: ${(await desktop.getByRole('status').allTextContents()).join(' ')}`, { cause: error })
        }
      }
      await desktop.getByLabel('Formato').selectOption('csv')
      await desktop.getByLabel('Arquivo').setInputFiles({
        name: 'health.csv', mimeType: 'text/csv', buffer: Buffer.from(buildCsvTemplateSample()),
      })
      await desktop.getByRole('button', { name: 'Importar', exact: true }).click()
      await desktop.getByRole('status').filter({ hasText: /^0 atividades novas, 4 duplicadas/ }).waitFor()
      await desktop.getByLabel('Arquivo').setInputFiles({
        name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('atividade,duracao\nCorrida,30'),
      })
      await desktop.getByRole('button', { name: 'Importar', exact: true }).click()
      await desktop.getByRole('status').filter({ hasText: 'A importação parou' }).waitFor()
      const bulk = ['data,atividade,tipo,duracao,distancia,calorias', ...Array.from({ length: 26 }, (_, index) =>
        `2026-10-${String(index + 1).padStart(2, '0')},Pedal em lote,Cycling,10,2,50`,
      )].join('\n')
      let requests = 0
      const interruptSecondBatch = route => ++requests === 2 ? route.abort() : route.continue()
      await desktop.route('**/api/saude/importar', interruptSecondBatch)
      await desktop.getByLabel('Arquivo').setInputFiles({ name: 'bulk.csv', mimeType: 'text/csv', buffer: Buffer.from(bulk) })
      await desktop.getByRole('button', { name: 'Importar', exact: true }).click()
      await desktop.getByRole('status').filter({ hasText: 'A importação parou após salvar 25 atividades' }).waitFor()
      await desktop.unroute('**/api/saude/importar', interruptSecondBatch)
      await desktop.getByRole('button', { name: 'Importar', exact: true }).click()
      await desktop.getByRole('status').filter({ hasText: '1 atividades novas, 25 duplicadas' }).waitFor()
      await desktop.reload()
      await desktop.getByRole('tab', { name: 'Atividades' }).click()
      const recentActivities = desktop.getByRole('heading', { name: 'Atividades recentes' })
      await recentActivities.waitFor()
      await desktop.getByText(/Apple Health · Running/).waitFor()
      await desktop.getByRole('tab', { name: 'Visão geral' }).click()
      await desktop.getByRole('img', { name: 'Minutos de atividade por dia' }).waitFor()
      await desktop.getByText('Ver dados do gráfico', { exact: true }).click()
      await desktop.getByRole('table', { name: 'Minutos de atividade por dia' }).waitFor()
      const changePeriod = desktop.waitForResponse(response => response.url().includes('/api/saude/resumo?period=90'))
      await desktop.getByRole('button', { name: '90 dias', exact: true }).click()
      assert.equal((await changePeriod).status(), 200)
      const reportRequest = '**/api/saude/resumo?period=7&*'
      const interruptReport = route => route.abort()
      await desktop.route(reportRequest, interruptReport)
      await desktop.getByRole('button', { name: '7 dias', exact: true }).click()
      const reportError = desktop.getByRole('alert').filter({ hasText: 'Falha ao carregar o resumo.' })
      await reportError.waitFor()
      await desktop.unroute(reportRequest, interruptReport)
      const retriedReport = desktop.waitForResponse(response => response.url().includes('/api/saude/resumo?period=7'))
      await desktop.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
      assert.equal((await retriedReport).status(), 200)
      await reportError.waitFor({ state: 'hidden' })
      await desktopMenu.getByRole('button', { name: 'Painel', exact: true }).click()
      await desktop.getByRole('heading', { name: 'Painel de controle' }).waitFor()
      await desktop.getByRole('tab', { name: 'Visão geral', exact: true }).focus()
      await desktop.keyboard.press('ArrowRight')
      const panelWorkouts = desktop.getByRole('tab', { name: /Treinos/ })
      assert.equal(await panelWorkouts.getAttribute('aria-selected'), 'true')
      await desktop.getByRole('tabpanel', { name: /Treinos/ }).waitFor()
      await desktop.getByLabel('Filtrar itens do painel').fill('sem-resultados-123')
      assert.equal(await desktop.getByRole('button', { name: 'Iniciar sessão', exact: true }).count(), 0)
      await desktop.getByLabel('Filtrar itens do painel').fill('')
      await desktop.getByRole('tab', { name: 'Visão geral', exact: true }).click()
      await desktopMenu.getByRole('button', { name: 'API', exact: true }).click()
      await desktop.getByRole('button', { name: 'Testar /api/health', exact: true }).click()
      await desktop.getByTestId('api-response').waitFor()
      assert.equal(JSON.parse(await desktop.getByTestId('api-response').textContent()).status, 'ok')
      await desktop.goBack()
      await desktop.getByRole('heading', { name: 'Painel de controle' }).waitFor()
      await desktopMenu.getByRole('button', { name: 'Oráculo', exact: true }).click()
      await desktop.getByRole('heading', { name: 'Oráculo · Análise de treino' }).waitFor()
      assert.equal(await desktop.getByLabel(/Autorizar envio de resumo de recuperação/).isChecked(), false)
      await mobile.getByRole('navigation', { name: 'Navegação principal mobile' }).getByRole('button', { name: 'Treinar', exact: true }).click()
      await mobile.getByRole('heading', { name: 'Catálogo de treinos' }).waitFor()
      await mobile.getByRole('textbox', { name: 'Buscar treino' }).fill('sem-resultados-123')
      await mobile.getByRole('status').filter({ hasText: /^0 de / }).waitFor()
      await mobile.getByRole('button', { name: 'Limpar filtros' }).click()
      await mobile.getByRole('status').filter({ hasText: /treinos disponíveis/ }).waitFor()
      console.log('Navegador: treino, recarga em outro dispositivo, quatro formatos de saúde e navegação passaram.')
    } finally {
      await browser.close()
    }
  }
  console.log('Isolamento entre duas contas passou.')
  let rateLimited = false
  for (let i = 0; i <= rateLimit + 1 && !rateLimited; i++) {
    const healthCheck = await nativeFetch(base + '/api/health')
    rateLimited = healthCheck.status === 429
    await healthCheck.body?.cancel()
  }
  assert.ok(rateLimited, 'Nuxt Security deve limitar requisições na mesma instância')
  console.log('Limite de requisições na instância local passou.')
  console.log('Migração em banco vazio, login, autorização, conclusão idempotente e SSR passaram.')
  code = 0
} catch (error) {
  console.error(error)
} finally {
  process.exit(code)
}
