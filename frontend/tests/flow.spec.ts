import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { buildSamsungHealthSampleCsv } from '../../src/utils/healthParsers'

const password = 'synthetic-local-test-password'

async function validateViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function validateAccessibility(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([])
}

async function register(page: Page) {
  const email = 'murim-frontend-' + randomUUID() + '@example.test'
  const response = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://127.0.0.1:38200' },
    data: { email, password, name: 'Jogador de teste', callbackURL: '/' },
  })
  expect(response.status()).toBe(200)
  const file = fileURLToPath(new URL('../.e2e-mail/' + email, import.meta.url))
  await expect.poll(() => readFile(file, 'utf8').catch(() => '')).toMatch(/^http:\/\//)
  const verify = await readFile(file, 'utf8')
  await unlink(file)
  const confirmation = await page.request.get(verify, { maxRedirects: 0 })
  expect(confirmation.status()).toBe(302)
  return email
}

test('autentica, conclui uma vez após falha e preserva a recompensa após recarregar', async ({ page }) => {
  const email = await register(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Acessar o Murim' })).toBeVisible()
  await validateViewport(page)
  await validateAccessibility(page)
  await page.getByRole('tab', { name: 'Entrar', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Criar conta', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')

  await page.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click()
  await expect(page.getByRole('heading', { name: 'Crie sua ficha de personagem' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Nome do herói' }).fill('Herói de teste')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByRole('heading', { name: 'Seu herói' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar treino', exact: true })).toBeVisible()
  await validateViewport(page)
  await page.getByRole('link', { name: 'Treinar', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Catálogo de treinos' })).toBeVisible()
  await page.getByRole('button', { name: /^Iniciar treino:/ }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await validateViewport(page)
  await validateAccessibility(page)
  await page.getByRole('spinbutton', { name: 'Carga (kg) série 1' }).fill('25')
  await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
  const requests: unknown[] = []
  await page.route('**/api/treinos/concluir', async route => {
    requests.push(route.request().postDataJSON())
    // The server persists the first request, then the browser loses the response.
    const result = await route.fetch()
    expect(result.status()).toBe(200)
    if (requests.length === 1) await route.abort()
    else await route.fulfill({ response: result })
  })
  await page.getByRole('button', { name: 'Finalizar treino' }).click()
  await expect(page.getByRole('dialog', { name: 'Finalizar sessão?' })).toBeVisible()
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Conexão indisponível' })).toBeVisible()
  await page.getByRole('button', { name: 'Reenviar treino' }).click()
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Treino salvo' })).toBeFocused()
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  await page.getByRole('link', { name: 'Extrato', exact: true }).filter({ visible: true }).click()
  const ledger = page.getByRole('region', { name: 'Lançamentos do extrato' })
  await expect(ledger.getByRole('listitem')).toHaveCount(1)
  await expect(ledger.getByRole('listitem')).toContainText(/\+[1-9]\d* XP/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Extrato de recompensas' })).toBeVisible()
  await expect(ledger.getByRole('listitem')).toHaveCount(1)
  const total = await page.request.get('/api/progresso').then(response => response.json())
  expect(total.xp).toBeGreaterThan(0)
  await page.getByRole('link', { name: 'Painel', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('heading', { name: 'Painel de controle' })).toBeVisible()
  await expect(page.locator('.status-totals')).toContainText(total.xp + ' XP')
  await validateViewport(page)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Acessar o Murim' })).toBeVisible()
  expect((await page.request.get('/api/extrato')).status()).toBe(401)
})

test('visitante percorre um treino sem alterar o extrato', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar como visitante' }).click()
  await expect(page.getByRole('heading', { name: 'Catálogo de treinos' })).toBeVisible()
  await page.getByRole('button', { name: /^Iniciar treino:/ }).first().click()
  await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar treino' }).click()
  const writes: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/treinos/concluir')) writes.push(request.url())
  })
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Treino concluído como visitante' })).toBeVisible()
  expect(writes).toEqual([])
  await validateViewport(page)
})

test('treinos personalizados, progressão e arsenal usam os contratos reais', async ({ page }) => {
  test.setTimeout(90_000)
  const email = await register(page)
  await page.goto('/')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click()
  await page.getByRole('textbox', { name: 'Nome do herói' }).fill('Herói de RPG')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  const go = (name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).click()
  await go('Treinar')
  await page.getByText('Montar ou editar treino', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do treino' }).fill('Treino de paridade')
  await page.getByRole('textbox', { name: 'Nome do exercício' }).fill('Remada teste')
  await page.getByRole('textbox', { name: 'Prescrição' }).fill('3 séries x 10 repetições')
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByText('Treino salvo.', { exact: true })).toBeVisible()
  const getCustom = async () => (await page.request.get('/api/treinos/personalizados').then(response => response.json()))[0]
  const original = await getCustom()
  await page.getByRole('textbox', { name: 'Nome do treino' }).fill('Treino revisado')
  await page.getByRole('button', { name: 'Salvar treino' }).click()
  await expect(page.getByRole('button', { name: 'Editar Treino revisado' })).toBeVisible()
  const edited = await getCustom()
  expect(edited.id).toBe(original.id)
  expect(edited.exercises[0].id).toBe(original.exercises[0].id)
  await page.getByRole('button', { name: 'Iniciar treino: Treino revisado' }).click()
  await page.getByRole('spinbutton', { name: 'Carga (kg) série 1' }).fill('25')
  await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar treino' }).click()
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Treino salvo' })).toBeVisible()
  await page.getByText('Montar ou editar treino', { exact: true }).click()
  await page.getByRole('button', { name: 'Editar Treino revisado' }).click()
  await page.getByRole('button', { name: 'Excluir treino', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await expect(page.getByText('Treino excluído. Seu histórico foi preservado.')).toBeVisible()

  await go('Painel')
  const daily = page.getByRole('region', { name: 'Missões de hoje' })
  await expect(page.getByRole('progressbar', { name: 'HP da raid semanal' })).toBeVisible()
  const quest = daily.locator('article').filter({ hasText: 'Treino ou Atividade Diária' })
  await quest.getByRole('button', { name: /Resgatar/ }).click()
  await expect(quest.getByText('Resgatada')).toBeVisible()
  const weekly = page.locator('article').filter({ hasText: 'Caçador de Recordes' })
  await weekly.getByRole('button', { name: 'Resgatar Caçador de Recordes' }).click()
  await expect(weekly.getByText('Resgatada')).toBeVisible()
  const first = page.getByRole('region', { name: 'Conquistas' }).getByRole('listitem').filter({ hasText: 'Primeiro Sangue' })
  await expect(first).toContainText('Desbloqueada em')
  await expect(page.getByRole('heading', { name: 'Histórico de treinos' }).locator('..')).toContainText('Treino revisado')

  await daily.getByRole('textbox', { name: 'Novo compromisso' }).fill('Alongar depois do treino')
  await daily.getByRole('button', { name: 'Criar voto' }).click()
  const vow = daily.locator('article').filter({ hasText: 'Alongar depois do treino' })
  await vow.getByRole('button', { name: 'Quebrei o voto' }).click()
  await page.getByRole('dialog', { name: 'Registrar falha' }).getByRole('button', { name: 'Confirmar falha' }).click()
  await expect(vow).toContainText('Quebrado hoje')
  await expect(page.locator('.status-totals')).toContainText('85')
  await vow.getByRole('button', { name: 'Remover voto' }).click()
  await expect(vow).toHaveCount(0)
  await validateViewport(page)

  await go('Arsenal')
  await page.getByRole('textbox', { name: 'Nome do conjunto' }).fill('Equipamento de treino')
  await page.getByRole('button', { name: 'Salvar equipamento atual' }).click()
  await expect(page.getByText('Conjunto salvo.', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Buscar equipamento' }).fill('Faixa de Treino da Família Jin')
  const item = page.getByRole('article', { name: 'Faixa de Treino da Família Jin' })
  await item.getByRole('button', { name: 'Comprar por 15 moedas' }).click()
  await item.getByRole('button', { name: 'Equipar', exact: true }).click()
  await expect(item.getByText('Equipado')).toBeVisible()
  await page.getByRole('button', { name: 'Equipar conjunto' }).click()
  await expect(item.getByRole('button', { name: 'Equipar', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Excluir conjunto' }).click()
  await expect(page.getByText('Nenhum conjunto salvo.')).toBeVisible()
  await validateAccessibility(page)
  await validateViewport(page)
})

test('peso, importações, Android, Strava e consentimento no Oráculo', async ({ page }) => {
  test.setTimeout(100_000)
  const email = await register(page)
  await page.goto('/')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click()
  await page.getByRole('textbox', { name: 'Nome do herói' }).fill('Herói da saúde')
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  const go = (name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).click()
  await go('Saúde')
  await page.getByRole('tab', { name: 'Evolução' }).click()
  await page.getByRole('spinbutton', { name: 'Peso (kg)' }).fill('74.5')
  await page.getByRole('button', { name: 'Registrar peso' }).click()
  const weight = page.getByRole('region', { name: 'Peso corporal e evolução física' })
  await expect(weight).toContainText('74,5 kg')
  await weight.getByRole('button', { name: /^Excluir pesagem/ }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await expect(weight.getByText('Registre sua primeira pesagem.')).toBeVisible()
  await page.getByRole('tab', { name: 'Sincronização' }).click()
  const { today } = await page.request.get('/api/painel').then(response => response.json())
  const csv = Buffer.from('data,atividade,tipo,duracao,distancia,calorias,passos,sono\n' +
    today + ',Corrida de teste,Running,38,6.4,420,9850,7.5')
  const file = { name: 'atividades.csv', mimeType: 'text/csv', buffer: csv }
  const importButton = page.getByRole('button', { name: 'Importar dados' })
  await page.getByLabel('Arquivos de saúde').setInputFiles(file)
  await importButton.click()
  await expect(page.getByText(/1 atividades novas, 0 duplicadas/)).toBeVisible()
  await page.getByLabel('Arquivos de saúde').setInputFiles(file)
  await importButton.click()
  await expect(page.getByText(/0 atividades novas, 1 duplicadas/)).toBeVisible()
  const archives = [
    ['Apple Health', 'export.xml', `<HealthData>
<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min" startDate="${today} 10:00:00 +0000" endDate="${today} 10:30:00 +0000" totalDistance="4" totalDistanceUnit="km" />
</HealthData>`],
    ['Samsung Health', 'samsung.csv', buildSamsungHealthSampleCsv()],
    ['GPX', 'atividade.gpx', `<gpx><trk><name>Corrida GPX</name><trkseg><trkpt lat="-23.5" lon="-46.6"><time>${today}T10:00:00Z</time></trkpt><trkpt lat="-23.51" lon="-46.61"><time>${today}T10:15:00Z</time></trkpt></trkseg></trk></gpx>`],
  ]
  for (const [source, name, content] of archives) {
    await page.getByRole('combobox', { name: 'Formato do arquivo' }).click()
    await page.getByRole('option', { name: source, exact: true }).click()
    await page.getByLabel('Arquivos de saúde').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) })
    await importButton.click()
    await expect(page.getByText(/^[1-9]\d* atividades novas, 0 duplicadas/)).toBeVisible()
  }

  const android = await page.request.post('/api/saude/health-connect', {
    headers: { Origin: 'http://127.0.0.1:38200' },
    data: { source: 'health_connect', activities: [], dailyMetrics: [{ dateKey: today, steps: 6523, sleepHours: 7 }] },
  })
  expect(android.status()).toBe(200)
  const connection = page.getByRole('region', { name: 'Health Connect' })
  await connection.getByRole('button', { name: 'Atualizar dados' }).click()
  await expect(connection).toContainText('6.523')
  await validateViewport(page)

  const strava = page.getByRole('region', { name: 'Strava · OAuth' })
  await page.route(/\/api\/strava\/(?:auth-url|sync|disconnect)$/, async route => {
    // The isolated fixture advertises a public HTTPS origin while Chromium runs on loopback HTTP.
    const response = await route.fetch({ headers: { ...route.request().headers(), origin: 'https://murim.example.test' } })
    await route.fulfill({ response })
  })
  await page.route(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/, async route => {
    const url = new URL(route.request().url())
    const state = url.searchParams.get('state')
    expect(state).toBeTruthy()
    const callback = new URL('http://127.0.0.1:38200/api/strava/callback')
    callback.search = new URLSearchParams({ state: state!, code: 'synthetic-code', scope: 'activity:read_all' }).toString()
    await route.fulfill({ status: 302, headers: { Location: callback.href } })
  })
  await strava.getByRole('button', { name: 'Conectar Strava' }).click()
  await expect(strava.getByRole('alert')).toContainText('Strava conectado.')
  await strava.getByRole('button', { name: 'Sincronizar Strava' }).click()
  await expect(strava.getByText(/1 atividades novas/)).toBeVisible()
  await strava.getByRole('button', { name: 'Desconectar Strava' }).click()
  await expect(strava.getByText(/dados importados foram preservados/)).toBeVisible()

  await page.getByRole('tab', { name: 'Atividades' }).click()
  const list = page.getByRole('region', { name: 'Atividades recentes' })
  await expect(list.getByText('Corrida de teste', { exact: true })).toBeVisible()
  await expect(list.getByText('Atividade Strava de teste', { exact: true })).toBeVisible()
  await validateAccessibility(page)
  await go('Oráculo')
  const log = page.getByRole('log', { name: 'Conversa com o Oráculo' })
  const question = page.getByRole('textbox', { name: 'Pergunta ao Oráculo' })
  const consent = page.getByRole('checkbox', { name: /Autorizar o envio/ })
  await expect(consent).not.toBeChecked()
  await question.fill('Como distribuir meus treinos?')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(log).toContainText('Consulta sem resumo de recuperação.')
  await page.getByRole('button', { name: 'Enviar', exact: true }).waitFor({ timeout: 10000 })
  await consent.check()
  await question.fill('Como interpretar minha recuperação?')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(log).toContainText('Resumo de recuperação autorizado.')
  await expect(consent).not.toBeChecked()
  await validateViewport(page)
  await validateAccessibility(page)
})

test('troca e reverte o frontend na mesma origem com sessão e treinos preservados', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const origin = 'http://127.0.0.1:38200'
  const account = await register(page)
  await page.goto('/')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(account)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click()
  await page.getByRole('textbox', { name: 'Nome do herói' }).fill('Herói da reversão')
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  async function snapshot() {
    async function read(path: string) {
      const response = await page.request.get(path)
      expect(response.status()).toBe(200)
      return response.json()
    }
    const [session, hero, progress, history, ledger, state, health, ready] = await Promise.all([
      read('/api/auth/get-session'), read('/api/heroi'), read('/api/progresso'),
      read('/api/treinos/historico'), read('/api/extrato'), read('/api/estado'), read('/api/health'), read('/api/ready'),
    ])
    expect(session.user.email).toBe(account)
    expect(health.status).toBe('ok')
    expect(ready).toEqual({ ready: true })
    return { session: session.session.id, hero, progress, history, ledger, state }
  }

  async function use(frontend: 'next' | 'nuxt', path: string) {
    await page.context().addCookies([{ name: 'murim_test_frontend', value: frontend, url: origin }])
    const result = await page.goto(path)
    expect(result?.headers()['x-murim-test-frontend']).toBe(frontend)
    expect(new URL(page.url()).origin).toBe(origin)
  }

  async function finish(weightKg: string) {
    await page.getByRole('spinbutton', { name: 'Carga (kg) série 1' }).fill(weightKg)
    await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
    await page.getByRole('button', { name: 'Finalizar treino', exact: true }).click()
    const finished = page.waitForResponse(result => result.url().endsWith('/api/treinos/concluir') && result.request().method() === 'POST')
    await page.getByRole('button', { name: 'Concluir treino', exact: true }).click()
    const response = await finished
    expect(response.status()).toBe(200)
    const receipt = page.getByRole('region', { name: 'Treino salvo' })
    await expect(receipt).toBeVisible()
    if (process.env.MURIM_CAPTURE_CUTOVER === '1') {
      const frontend = response.headers()['x-murim-test-frontend']
      await receipt.screenshot({ path: testInfo.outputPath('recibo-' + frontend + '.png'), animations: 'disabled' })
    }
    return response.request().postDataJSON()
  }

  await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click()
  const first = await finish('25')
  const saved = await snapshot()
  expect(saved.history.history.map(({ id }: { id: string }) => id)).toEqual([first.id])
  expect(saved.ledger.entries).toHaveLength(1)
  expect(saved.progress.xp).toBeGreaterThan(0)

  await use('nuxt', '/')
  await expect(page.getByTestId('hero-xp')).toHaveText(saved.progress.xp + ' XP')
  await validateViewport(page)
  expect(await snapshot()).toEqual(saved)
  const replay = await page.request.post('/api/treinos/concluir', { data: first, headers: { Origin: origin } })
  expect(replay.status()).toBe(200)
  expect(await snapshot()).toEqual(saved)

  await page.getByRole('button', { name: 'Iniciar treino', exact: true }).first().click()
  const second = await finish('27')
  expect(second.id).not.toBe(first.id)
  const { today } = await page.request.get('/api/painel').then(response => response.json())
  const android = await page.request.post('/api/saude/health-connect', {
    headers: { Origin: origin },
    data: { source: 'health_connect', activities: [], dailyMetrics: [{ dateKey: today, steps: 6200 }] },
  })
  expect(android.status()).toBe(200)
  const metrics = await page.request.get('/api/saude/health-connect').then(response => response.json())
  expect(metrics.latestSteps).toBe(6200)
  const legacy = await snapshot()
  expect(legacy.session).toBe(saved.session)
  expect(legacy.history.history.map(({ id }: { id: string }) => id)).toEqual([second.id, first.id])
  expect(legacy.ledger.entries).toHaveLength(2)
  expect(legacy.progress.xp).toBeGreaterThan(saved.progress.xp)

  await use('next', '/?tab=extrato')
  await expect(page.getByRole('heading', { name: 'Extrato de recompensas' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lançamentos do extrato' }).getByRole('listitem')).toHaveCount(2)
  expect(await snapshot()).toEqual(legacy)
  expect(await page.request.get('/api/saude/health-connect').then(response => response.json())).toEqual(metrics)
  await validateViewport(page)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('heading', { name: 'Acessar o Murim' })).toBeVisible()
  await use('nuxt', '/')
  await expect(page.getByRole('heading', { name: 'Acessar o Murim' })).toBeVisible()
  expect((await page.request.get('/api/extrato')).status()).toBe(401)
})
