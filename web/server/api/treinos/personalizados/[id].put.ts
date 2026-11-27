import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { customWorkoutSchema } from '../../../../shared/training'
import { customWorkout } from '../../../db/schema'
import { requireUser } from '../../../utils/authentication'
import { getDatabase } from '../../../utils/database'
import type { WorkoutTemplate } from '../../../../../src/types/fitness'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { id } = await getValidatedRouterParams(event, params => z.object({ id: z.uuid() }).parse(params))
  const input = await readValidatedBody(event, body => customWorkoutSchema.parse(body))
  const db = getDatabase()
  const [existing] = await db.select({ data: customWorkout.data }).from(customWorkout)
    .where(and(eq(customWorkout.userId, userId), eq(customWorkout.id, id)))
  const knownExercises = new Set(existing?.data.exercises.map(exercise => exercise.id))
  if (input.exercises.some(exercise => exercise.id && !knownExercises.has(exercise.id))) {
    throw createError({ statusCode: 400, statusMessage: 'Exercicio invalido para este treino' })
  }
  const data: WorkoutTemplate = {
    ...input, id, baseXp: 100, rank: 'F', difficulty: 'Iniciante',
    exercises: input.exercises.map(exercise => ({
      ...exercise, id: exercise.id ?? crypto.randomUUID(),
      restSeconds: exercise.restSeconds ?? 60, muscleGroups: exercise.muscleGroups ?? [], executionTip: exercise.executionTip ?? '',
    })),
  }
  await db.insert(customWorkout).values({ userId, id, data })
    .onConflictDoUpdate({ target: [customWorkout.userId, customWorkout.id], set: { data } })
  return data
})
