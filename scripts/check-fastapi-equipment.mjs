import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EQUIPMENT_CATALOG, EQUIPMENT_SETS, DEFAULT_EQUIPPED_GEAR, migrateEquipmentId, migrateEquippedGear, calculateGearBonusSummary } from '../src/utils/rpgLogic.ts'

const data = JSON.parse(readFileSync(new URL('../backend/app/data/equipment.json', import.meta.url), 'utf8'))
assert.deepEqual(data.equipment, EQUIPMENT_CATALOG)
assert.deepEqual(data.sets, EQUIPMENT_SETS)
assert.deepEqual(data.defaults, DEFAULT_EQUIPPED_GEAR)
for (const [old, id] of Object.entries(data.legacy)) assert.equal(migrateEquipmentId(old), id)
const slots = ['elmo', 'armadura', 'capa', 'arma']
const cases = [null, {}, [], DEFAULT_EQUIPPED_GEAR, { helm: 'hm-scout-hood', weapon: 'wp-wooden-blade' }, { elmo: 'unknown', arma: 'elmo_couro_novato' }]
for (const item of EQUIPMENT_CATALOG) cases.push({ [item.slot]: item.id })
for (const set of EQUIPMENT_SETS) {
  const gear = Object.fromEntries(slots.map(slot => [slot, EQUIPMENT_CATALOG.find(i => i.setId === set.id && i.slot === slot)?.id ?? null]))
  cases.push(gear, { ...gear, arma: null }, { ...gear, capa: null, arma: null })
}
const bySlot = slots.map(slot => EQUIPMENT_CATALOG.filter(i => i.slot === slot))
for (let i = 0; i < 300; i++) cases.push(Object.fromEntries(slots.map((slot, j) => [slot, bySlot[j][(i * (j + 1) + j * 7) % bySlot[j].length].id])))
console.log(JSON.stringify(cases.map(input => ({input, migrated: migrateEquippedGear(input), bonus: calculateGearBonusSummary(input)}))))
