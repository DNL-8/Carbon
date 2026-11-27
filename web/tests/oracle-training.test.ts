import { expect, test } from 'vitest'
import { summarizeTraining } from '../server/utils/oracle-training'

function session(weightKg: number, reps: number) {
  return { sets: [{ exerciseId: 'test', weightKg, reps }] }
}

test('sinaliza falta de avanço apenas com três séries comparáveis de sessões distintas', () => {
  expect(summarizeTraining([session(10, 8), session(10, 8), session(10, 8)])).toEqual({
    sessionsCount: 3, comparableExercises: 1, possiblePlateaus: 1,
  })
  expect(summarizeTraining([session(10, 9), session(10, 8), session(10, 8)]).possiblePlateaus).toBe(0)
  expect(summarizeTraining([session(11, 8), session(10, 8), session(10, 8)]).possiblePlateaus).toBe(0)
  expect(summarizeTraining([session(10, 8), session(10, 8), session(0, 8)]).comparableExercises).toBe(0)
})
