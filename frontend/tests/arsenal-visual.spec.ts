import { test, expect } from '@playwright/test'
import { login } from './google-login'
import { getEquipmentArt } from '../lib/equipment-art'
import { drawModel } from '../components/warrior-avatar-3d'
import { EQUIPMENT_CATALOG } from '../../src/utils/equipmentCatalog'

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
  for (const [id, label] of Object.entries({elmo: 'Cabeça', armadura: 'Vestimenta', capa: 'Manto', arma: 'Arma'})) {
    await expect(page.locator('#gear-filter-' + id)).toHaveText(label)
  }
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
    if (await canvas.getAttribute('data-avatar-renderer') === 'webgl') {
      const expected = (await avatar.getAttribute('data-equipment')) ?? ''
      await expect(canvas).toHaveAttribute('data-rendered-equipment', expected)
    }
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

// The geometry is pure and can be exercised without a GPU or authenticated page.
test('geometria 3D: 104 itens permanecem finitos e enquadrados em várias poses', () => {
  for (const item of EQUIPMENT_CATALOG) {
    const gear = [{ id: item.id, name: item.name, slot: item.slot, rarity: item.rarity, equipped: true }]
    for (const angle of [0, Math.PI/2, Math.PI, 3*Math.PI/2]) {
      for (const strike of [0, 1]) {
        const data = drawModel({size: 256, gear, look: {x: 0,y: 0}, paused: false, pulse: 0, attack: 1, levelUp: 0, victory: false, milestone: false, resting: false, lowHp: false}, 1, angle, strike, 0, 0, 0, true)
        expect(data.length, item.id).toBeGreaterThan(0)
        expect(data.length % 18, item.id).toBe(0)
        let valid = true
        for (let i=0;i<data.length;i++) {
          if (!Number.isFinite(data[i]) || (i%6<3 && Math.abs(data[i])>1)) {valid=false;break}
        }
        expect(valid, item.id+' ângulo '+angle+' golpe '+strike).toBe(true)
      }
    }
  }
})
