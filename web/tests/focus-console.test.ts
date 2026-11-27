import { expect, test } from 'vitest'
import { consoleOperations, consolePath } from '../shared/console'
import { initialFocusSets, completedFocusSets } from '../shared/focus'
import { INITIAL_WORKOUTS } from '../../src/utils/rpgLogic'

test('console exposes fixed same-origin routes and rejects path injection', () => {
  expect(new Set(consoleOperations.map(item => item.id)).size).toBe(consoleOperations.length)
  expect(consoleOperations.every(item => item.path.startsWith('/api/') && !item.path.includes('/auth/'))).toBe(true)
  const operation = consoleOperations.find(item => item.param)!
  expect(() => consolePath(operation, '../../auth/get-session')).toThrow()
  expect(consolePath(operation, '00000000-0000-4000-8000-000000000000')).toContain('/00000000-0000-4000-8000-000000000000')
})
test('prescribed focus sets are not counted until explicitly completed', () => {
  const workout = INITIAL_WORKOUTS[0]!
  const sets = initialFocusSets(workout)
  expect(sets.length).toBeGreaterThan(0)
  expect(completedFocusSets(sets)).toEqual([])
  sets[0]!.completed = true
  expect(completedFocusSets(sets)).toEqual([{ exerciseId: sets[0]!.exerciseId, reps: sets[0]!.reps, weightKg: sets[0]!.weightKg }])
})
