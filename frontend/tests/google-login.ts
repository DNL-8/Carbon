import { expect, type Page } from '@playwright/test'
export const origin = 'http://127.0.0.1:38200'
export async function login(page: Page, person: 'a' | 'b' | 'outside') {
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
