import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LEVEL_THRESHOLDS, HUNTER_RANK_TIERS, MURIM_REALM_TIERS, MURIM_XP_CURVE_POINTS,
  recalculateHeroProgressionByXp, getHunterRankForLevel,
} from '../src/utils/progressionCurves.ts'
import { getDualProgressionStatus } from '../src/utils/rpgLogic.ts'

const constants = { LEVEL_THRESHOLDS, HUNTER_RANK_TIERS, MURIM_REALM_TIERS, MURIM_XP_CURVE_POINTS }
const snapshot = JSON.parse(readFileSync(new URL('../backend/app/data/progression.json', import.meta.url), 'utf8'))
assert.deepEqual(snapshot, constants)
const xp = new Set([-100, -0.5, 0, 0.9, 1, 100, 100000, 2147483647])
for (const { minXp } of LEVEL_THRESHOLDS) {
  for (const delta of [-1, 0, 0.5, 1]) xp.add(minXp + delta)
}
for (let n = 0; n <= 50000; n += 137) xp.add(n)
const today = '2026-11-27'
const stats = [...xp].flatMap(totalXp => [
  { totalXp, totalWorkouts: 0, bossesDefeated: 0, currentStreak: 0, longestStreak: 0, totalMinutes: 0, lastWorkoutDate: null },
  { totalXp, totalWorkouts: 170, bossesDefeated: 35, currentStreak: 8, longestStreak: 30, totalMinutes: 2400, lastWorkoutDate: '2026-11-26' },
  { totalXp, totalWorkouts: 18, bossesDefeated: 3, currentStreak: 4, longestStreak: 5, totalMinutes: 80.5, lastWorkoutDate: '2026-11-20' },
])
console.log(JSON.stringify({
  xp: [...xp].map(input => ({ input, expected: recalculateHeroProgressionByXp(input) })),
  level: Array.from({length: 34}, (_, i) => i - 2).map(input => ({ input, expected: getHunterRankForLevel(input) })),
  dual: stats.map(input => ({ input, today, expected: getDualProgressionStatus(input, today) })),
}))
