import { desc, eq } from 'drizzle-orm'
import { INITIAL_WORKOUTS } from '../../../../src/utils/rpgLogic'
import { completion, customWorkout, exerciseRecord } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'

const workoutNames = new Map(INITIAL_WORKOUTS.map(workout => [workout.id, workout.name]))
const exerciseNames = new Map(INITIAL_WORKOUTS.flatMap(workout => (
  workout.exercises.map(exercise => [exercise.id, exercise.name] as const)
)))

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const [history, records, custom] = await Promise.all([
    db.select({
      id: completion.id, workoutId: completion.workoutId, sets: completion.sets,
      xp: completion.xp, coins: completion.coins, createdAt: completion.createdAt,
      snapshot: completion.workoutSnapshot,
    }).from(completion).where(eq(completion.userId, userId))
      .orderBy(desc(completion.createdAt), desc(completion.id)).limit(30),
    db.select({
      exerciseId: exerciseRecord.exerciseId, bestWeightKg: exerciseRecord.bestWeightKg,
      bestReps: exerciseRecord.bestReps, bestVolumeKg: exerciseRecord.bestVolumeKg,
      estimated1RmKg: exerciseRecord.estimated1RmKg,
    }).from(exerciseRecord).where(eq(exerciseRecord.userId, userId)),
    db.select({ workout: customWorkout.data }).from(customWorkout).where(eq(customWorkout.userId, userId)),
  ])
  const personalNames = new Map(custom.flatMap(row => row.workout.exercises.map(exercise => [exercise.id, exercise.name] as const)))
  for (const row of history) {
    for (const [id, name] of Object.entries(row.snapshot?.exercises ?? {})) {
      if (!personalNames.has(id)) personalNames.set(id, name)
    }
  }
  return {
    history: history.map(({ snapshot, ...workout }) => ({
      ...workout,
      name: snapshot?.name ?? workoutNames.get(workout.workoutId) ?? workout.workoutId,
      sets: workout.sets.map(set => ({ ...set, name: snapshot?.exercises[set.exerciseId] ?? exerciseNames.get(set.exerciseId) ?? set.exerciseId })),
    })),
    records: records.map(record => ({
      ...record, name: exerciseNames.get(record.exerciseId) ?? personalNames.get(record.exerciseId) ?? record.exerciseId,
    })).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
  }
})
