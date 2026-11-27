import { expect, test } from '@playwright/test'

import { login, origin } from './google-login'
test.beforeEach(async ({ request }) => { expect((await request.post('http://127.0.0.1:38212/__fixture/reset?profiles=true')).ok()).toBeTruthy() })


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
