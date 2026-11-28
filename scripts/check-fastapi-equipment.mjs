import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EQUIPMENT_CATALOG, EQUIPMENT_SETS, DEFAULT_EQUIPPED_GEAR, migrateEquipmentId, migrateEquippedGear, calculateGearBonusSummary } from '../src/utils/rpgLogic.ts'

const data = JSON.parse(readFileSync(new URL('../backend/app/data/equipment.json', import.meta.url), 'utf8'))
assert.deepEqual(data.equipment, EQUIPMENT_CATALOG)
assert.equal(EQUIPMENT_CATALOG.length, 104)
const rewards = EQUIPMENT_CATALOG.filter(item => item.acquisition === 'reward')
assert.equal(rewards.length, 15)
assert.equal(new Set(rewards.map(item => item.requirement.tipo + ':' + item.requirement.valor)).size, 15)
assert.equal(EQUIPMENT_CATALOG.filter(item => item.acquisition === 'purchase').length, 87)
assert.equal(EQUIPMENT_CATALOG.filter(item => item.acquisition === 'starter').length, 2)
assert.ok(EQUIPMENT_CATALOG.every(item => item.acquisition === 'purchase' ? item.priceCoins > 0 : item.priceCoins === 0))
assert.equal(new Set(EQUIPMENT_CATALOG.map(item => item.id)).size, 104)
for (const slot of ['elmo', 'armadura', 'capa', 'arma']) assert.equal(EQUIPMENT_CATALOG.filter(item => item.slot === slot).length, 26)
for (const [tipo, count] of [['rank_cacador', 51], ['reino_murim', 51], ['inicial', 2]]) assert.equal(EQUIPMENT_CATALOG.filter(item => item.requirement.tipo === tipo).length, count)
assert.deepEqual(data.sets, EQUIPMENT_SETS)
const bonusKeys = ['xpBonusPercent', 'coinBonusPercent', 'bossDamageBonusPercent']
const specialty = {"viajante":0,"familia_jin":0,"associacao_cacadores":1,"guarda_aco":2,"manto_mercador":1,"sabio_abissal":0,"presa_carmesim":2,"seita_rei_fogo":2,"monarca_eternidade":1,"espada_invisivel":0}
const maxima = EQUIPMENT_SETS.map(set => {
  const primary = specialty[set.id]
  for (const [bonus, expected] of [[set.twoPieceBonus, 4], [set.fourPieceBonus, 10]]) {
    assert.deepEqual(bonusKeys.map(key => bonus[key]), bonusKeys.map((_, i) => i === primary ? expected : 0))
  }
  return bonusKeys.map(key => ['elmo', 'armadura', 'capa', 'arma'].reduce((sum, slot) => sum + Math.max(...EQUIPMENT_CATALOG.filter(item => item.setId === set.id && item.slot === slot).map(item => item[key])), set.fourPieceBonus[key]))
})
const best = bonusKeys.map((_, i) => Math.max(...maxima.map(values => values[i])))
assert.ok(!maxima.some(values => values.every((value, i) => value === best[i])))
for (let i = 0; i < best.length; i++) assert.ok(maxima.every((values, j) => values[i] !== best[i] || specialty[EQUIPMENT_SETS[j].id] === i))
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
