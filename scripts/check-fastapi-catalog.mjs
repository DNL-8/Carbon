import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INITIAL_WORKOUTS, ACHIEVEMENT_DEFINITIONS } from '../src/utils/rpgLogic.ts'

const root = new URL('../backend/app/data/', import.meta.url)
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'))
assert.deepEqual(read('catalog.json'), JSON.parse(JSON.stringify(INITIAL_WORKOUTS)))
assert.deepEqual(read('achievements.json'), JSON.parse(JSON.stringify(ACHIEVEMENT_DEFINITIONS)))
console.log('FastAPI static catalog and achievements match Nitro')
