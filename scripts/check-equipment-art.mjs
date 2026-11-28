import assert from 'node:assert/strict'
import { EQUIPMENT_CATALOG } from '../src/utils/equipmentCatalog.ts'
import { equipmentArt, equipmentShapes } from '../frontend/lib/equipment-art.ts'

assert.equal(Object.keys(equipmentArt).length, 104)
assert.deepEqual(Object.keys(equipmentArt).sort(), EQUIPMENT_CATALOG.map(item => item.id).sort())
for (const slot of ['elmo', 'armadura', 'capa', 'arma']) {
  const variants = EQUIPMENT_CATALOG.filter(item => item.slot === slot).map(item => equipmentArt[item.id])
  assert.equal(variants.length, 26)
  assert.equal(new Set(variants.map(art => art.detail)).size, 26)
  assert.ok(new Set(variants.map(art => art.family)).size >= 6)
  assert.ok(variants.every(art => equipmentShapes[art.family].every(path => path.startsWith('M'))))
}
console.log('104 equipment illustrations mapped to reusable families')
