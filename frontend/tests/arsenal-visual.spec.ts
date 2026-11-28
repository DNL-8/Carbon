import { test, expect } from '@playwright/test'
import { login } from './google-login'
import { getEquipmentArt } from '../lib/equipment-art'

test('homologação visual: as 104 peças possuem prévia no encaixe correto', async ({ page, request }, info) => {
  test.setTimeout(240_000)
  expect((await request.post('http://127.0.0.1:38212/__fixture/reset?profiles=false')).ok()).toBeTruthy()
  await login(page, 'a')
  await page.getByRole('textbox', { name: 'Nome do herói' }).fill('Herói de homologação')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await page.getByRole('link', { name: 'Arsenal', exact: true }).filter({ visible: true }).click()
  await expect(page.getByText('104 de 104 equipamentos', { exact: true })).toBeVisible()
  const response = await page.request.get('/api/arsenal')
  expect(response.ok()).toBeTruthy()
  const items = await response.json() as { id: string; name: string; slot: string; owned: boolean; equipped: boolean }[]
  expect(items).toHaveLength(104)
  const original = items.filter(item => item.equipped).map(item => item.id).sort()
  const avatar = page.locator('.active-gear .warrior-avatar')
  const canvas = avatar.locator('canvas[data-avatar-renderer]')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toHaveAttribute('data-avatar-renderer', /^(webgl|fallback)$/)
  const search = page.getByRole('textbox', { name: 'Buscar equipamento' })
  const captured = new Set<string>()
  for (const item of items) {
    const art = getEquipmentArt(item.id)
    expect(art, item.id).not.toBeNull()
    if (!art) throw new Error('Arte ausente: ' + item.id)
    await search.fill(item.name)
    const card = page.getByRole('article', { name: item.name, exact: true })
    await expect(card.locator('[data-equipment-art]')).toHaveAttribute('data-family', art.family)
    await card.getByRole('button', { name: 'Visualizar' }).click()
    const layer = avatar.locator('[data-avatar-slot="' + item.slot + '"]')
    await expect(layer).toHaveAttribute('data-avatar-item', item.id)
    await expect(layer).toHaveAttribute('data-avatar-family', art.family)
    if (!captured.has(art.family)) {
      await avatar.screenshot({ path: info.outputPath('homologacao-familia-' + art.family + '.png'), animations: 'disabled' })
      captured.add(art.family)
    }
    await page.getByRole('button', { name: 'Limpar prévia' }).click()
    await expect(avatar).toHaveAttribute('data-equipment', original.join(','))
  }
  expect(captured.size).toBe(33)
  const after = await page.request.get('/api/arsenal')
  expect(after.ok()).toBeTruthy()
  const persisted = await after.json() as typeof items
  expect(persisted.filter(item => item.equipped).map(item => item.id).sort()).toEqual(original)
  expect(persisted.filter(item => item.owned).map(item => item.id).sort()).toEqual(items.filter(item => item.owned).map(item => item.id).sort())
})
