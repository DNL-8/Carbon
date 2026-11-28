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
  const webglAvailable = await page.evaluate(() => {
    const context = document.createElement('canvas').getContext('webgl')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  })
  if (webglAvailable) await expect(canvas).toHaveAttribute('data-avatar-renderer', 'webgl')
  for (const [id, label] of Object.entries({elmo: 'Cabeça', armadura: 'Vestimenta', capa: 'Manto', arma: 'Arma'})) {
    await expect(page.locator('#gear-filter-' + id)).toHaveText(label)
  }
  const settings = page.locator('.arsenal-stage').getByRole('button', { name: 'Personalizar personagem' })
  await settings.click()
  const dialog = page.getByRole('dialog', { name: 'Personalizar personagem' })
  await dialog.getByRole('radio', { name: 'Murim · artista marcial' }).check()
  await dialog.getByRole('switch', { name: 'Visualizar sem elmo' }).check()
  const editorAvatar = dialog.locator('.warrior-avatar')
  await expect(editorAvatar).toHaveAttribute('data-character', 'murim')
  await expect(editorAvatar.locator('[data-avatar-slot="elmo"]')).toHaveCount(0)
  if (webglAvailable) {
    await dialog.getByRole('button', { name: 'Girar personagem à direita' }).click()
    await expect(editorAvatar.locator('canvas')).toHaveAttribute('data-camera-yaw', String(Math.PI/4))
    await dialog.getByRole('button', { name: 'Aproximar rosto' }).click()
    await expect(editorAvatar.locator('canvas')).toHaveAttribute('data-camera-zoom', '1.65')
    await dialog.getByRole('button', { name: 'Restaurar câmera' }).click()
    await expect(editorAvatar.locator('canvas')).toHaveAttribute('data-camera-zoom', '1')
  }
  await dialog.getByRole('switch', { name: 'Equipamentos dos dois mundos' }).uncheck()
  await dialog.getByRole('button', { name: 'Concluir' }).click()
  await expect(avatar).toHaveAttribute('data-character', 'murim')
  await expect(page.getByText('53 de 104 equipamentos', { exact: true })).toBeVisible()
  await expect(avatar).toHaveAttribute('data-equipment', original.join(','))
  await settings.click()
  await dialog.getByRole('radio', { name: 'Caçador · guerreiro tático' }).check()
  await dialog.getByRole('switch', { name: 'Equipamentos dos dois mundos' }).check()
  await dialog.getByRole('button', { name: 'Concluir' }).click()
  await expect(avatar).toHaveAttribute('data-character', 'cacador')
  await expect(page.getByText('104 de 104 equipamentos', { exact: true })).toBeVisible()
  await page.reload()
  await expect(avatar).toHaveAttribute('data-character', 'cacador')
  const synchronized = await page.request.get('/api/heroi')
  expect(synchronized.ok()).toBeTruthy()
  expect((await synchronized.json()).profile.avatar).toMatch(/^c2:/)
  await settings.click()
  await dialog.getByRole('radio', { name: 'Murim · artista marcial' }).check()
  await dialog.getByRole('button', { name: 'Concluir' }).click()
  await expect(avatar).toHaveAttribute('data-character', 'murim')
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
  await settings.click()
  await dialog.getByRole('radio', { name: 'Automático · pelo equipamento' }).check()
  await dialog.getByRole('button', { name: 'Concluir' }).click()
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

// Full sets exercise the shared joints together rather than just one piece at a time.
test('geometria 3D: dez conjuntos completos em rotação e ataque', () => {
  const sets = new Set(EQUIPMENT_CATALOG.map(item => item.setId).filter(id => id !== null))
  expect(sets.size).toBe(10)
  for (const id of sets) {
    const pieces = new Map(EQUIPMENT_CATALOG.filter(item => item.setId === id).map(item => [item.slot, item]))
    expect(pieces.size, id).toBe(4)
    const gear = [...pieces.values()].map(item => ({id:item.id,name:item.name,slot:item.slot,rarity:item.rarity,equipped:true}))
    for (const angle of [0, Math.PI/2, Math.PI, 3*Math.PI/2]) {
      const data = drawModel({size:256,gear,look:{x:0,y:0},paused:false,pulse:0,attack:1,levelUp:0,victory:false,milestone:false,resting:false,lowHp:false},1,angle,1,0,0,0,true)
      expect(data.length % 18).toBe(0)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every((value,i)=>Number.isFinite(value)&&(i%6>=3||Math.abs(value)<=1)),id).toBe(true)
    }
  }
})

// Both characters share sockets, but their silhouette and attack pose must differ.
test('geometria 3D: identidade dos personagens e câmera', () => {
  const props = {size: 256, gear: [], look: {x:0,y:0}, paused: false, pulse: 0, attack: 1, levelUp: 0, victory: false, milestone: false, resting: false, lowHp: false}
  const martial = drawModel({...props, avatarStyle:'murim'}, 1, 0, 1, 0, 0, 0, true)
  const hunter = drawModel({...props, avatarStyle:'cacador'}, 1, 0, 1, 0, 0, 0, true)
  expect(Array.from(martial)).not.toEqual(Array.from(hunter))
  const rotated = drawModel({...props, avatarStyle:'murim', cameraYaw: Math.PI/2}, 1, 0, 1, 0, 0, 0, true)
  expect(Array.from(rotated)).not.toEqual(Array.from(martial))
  const zoomed = drawModel({...props, avatarStyle:'murim', cameraZoom:1.65}, 1, 0, 1, 0, 0, 0, true)
  expect(zoomed.every(Number.isFinite)).toBe(true)
})
