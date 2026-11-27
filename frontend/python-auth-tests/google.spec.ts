import { expect, test, type Page } from '@playwright/test'

const origin = 'http://127.0.0.1:38210'

async function login(page: Page, person: 'a' | 'b' | 'outside') {
  await page.route('https://accounts.google.com/**', async route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    const callback = new URL(url.searchParams.get('redirect_uri')!)
    expect(callback.origin).toBe(origin)
    callback.searchParams.set('state', url.searchParams.get('state')!)
    callback.searchParams.set('code', person + '.' + url.searchParams.get('nonce')!)
    await route.fulfill({ status: 302, headers: { location: callback.href } })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Entrar com Google/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveCount(0)
  await expect(page.getByText('Entrar como visitante')).toHaveCount(0)
  await page.getByRole('button', { name: /Entrar com Google/ }).click()
}

test('two authorized accounts have independent sessions without Nitro', async ({ page, browser }) => {
  const other = await browser.newContext()
  try {
    const second = await other.newPage()
    await login(page, 'a')
    await expect.poll(async () => (await (await page.request.get(origin + '/api/conta')).json()).authenticated).toBe(true)
    await expect(page).toHaveURL(origin + '/')
    await login(second, 'b')
    await expect.poll(async () => (await (await second.request.get(origin + '/api/conta')).json()).authenticated).toBe(true)
    expect((await (await page.request.get(origin + '/api/heroi')).json()).profile.name).toBe('Hero a')
    expect((await (await second.request.get(origin + '/api/heroi')).json()).profile.name).toBe('Hero b')
    const logout = await page.request.post(origin + '/api/auth/sign-out', { headers: { Origin: origin } })
    expect(logout.ok()).toBeTruthy()
    expect((await (await page.request.get(origin + '/api/conta')).json()).authenticated).toBe(false)
    expect((await (await second.request.get(origin + '/api/conta')).json()).authenticated).toBe(true)
  } finally { await other.close() }
})

test('third Google account is rejected and public registration unavailable', async ({ page }) => {
  await login(page, 'outside')
  await expect(page).toHaveURL(/\/api\/auth\/callback\/google/)
  await expect(page.locator('body')).toContainText('Conta nao autorizada')
  expect((await (await page.request.get(origin + '/api/conta')).json()).authenticated).toBe(false)
  expect((await page.request.post(origin + '/api/auth/sign-up/email', { data: {} })).status()).toBe(404)
})
