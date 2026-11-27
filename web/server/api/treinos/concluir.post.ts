import { and, eq, inArray } from 'drizzle-orm'
import {
  DEFAULT_EQUIPPED_GEAR, INITIAL_WORKOUTS, calculateCoinsForWorkout, calculateGearBonusSummary, calculateProportionalXp,
  calculateSessionPrBonus, evaluateExercisePrUpdate,
} from '../../../../src/utils/rpgLogic'
import { finishTrainingSchema } from '../../../shared/training'
import { getWorkoutCombat } from '../../../shared/boss'
import { arsenal, completion, customWorkout, exerciseRecord, progress } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'
import { unlockAchievements } from '../../utils/achievements'
import { recordProgress } from '../../utils/progress-ledger'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const { id, workoutId, sets, elapsedSeconds } = await readValidatedBody(event, body => finishTrainingSchema.parse(body))
  const completedExercises = new Set(sets.map(set => set.exerciseId))

  return getDatabase().transaction(async tx => {
    await tx.insert(progress).values({ userId }).onConflictDoNothing()
    const [current] = await tx.select().from(progress).where(eq(progress.userId, userId)).for('update')
    const [existing] = await tx.select().from(completion)
      .where(and(eq(completion.userId, userId), eq(completion.id, id)))
    if (existing) {
      if (existing.workoutId !== workoutId || JSON.stringify(finishTrainingSchema.shape.sets.parse(existing.sets)) !== JSON.stringify(sets)) {
        throw createError({ statusCode: 409, statusMessage: 'Treino ja registrado com outros dados' })
      }
      return { earnedXp: existing.xp, earnedCoins: existing.coins, xp: current!.xp, coins: current!.coins, bossDefeated: existing.bossDefeated }
    }
    const [custom] = await tx.select({ data: customWorkout.data }).from(customWorkout)
      .where(and(eq(customWorkout.userId, userId), eq(customWorkout.id, workoutId)))
    const workout = INITIAL_WORKOUTS.find(item => item.id === workoutId) ?? custom?.data
    if (!workout || [...completedExercises].some(key => !workout.exercises.some(item => item.id === key))) {
      throw createError({ statusCode: 400, statusMessage: 'Treino ou exercicio invalido' })
    }

    const previousRecords = await tx.select().from(exerciseRecord).where(and(
      eq(exerciseRecord.userId, userId),
      inArray(exerciseRecord.exerciseId, [...completedExercises]),
    ))
    const previousByExercise = new Map(previousRecords.map(record => [record.exerciseId, record]))
    let totalRecords = 0
    for (const exerciseId of completedExercises) {
      const exerciseSets = sets.filter(set => set.exerciseId === exerciseId)
        .map((set, index) => ({ ...set, completed: true, setIndex: index + 1 }))
      const evaluation = evaluateExercisePrUpdate(exerciseSets, previousByExercise.get(exerciseId))
      if (evaluation.hasPr) totalRecords += 1
      const metrics = {
        bestWeightKg: evaluation.nextBestWeightKg,
        bestReps: evaluation.nextBestReps,
        bestVolumeKg: evaluation.nextBestVolumeKg,
        estimated1RmKg: evaluation.nextEstimated1RmKg,
      }
      await tx.insert(exerciseRecord).values({ userId, exerciseId, ...metrics }).onConflictDoUpdate({
        target: [exerciseRecord.userId, exerciseRecord.exerciseId],
        set: metrics,
      })
    }

    const { prXpBonus, prCoinsBonus } = calculateSessionPrBonus(totalRecords)
    const [gear] = await tx.select().from(arsenal).where(eq(arsenal.userId, userId))
    const bonuses = calculateGearBonusSummary(gear?.equipped ?? DEFAULT_EQUIPPED_GEAR)
    const { state: { bossDefeated } } = getWorkoutCombat(workout, sets, elapsedSeconds, bonuses.bossDamageBonusPercent)
    const baseXp = calculateProportionalXp(workout.baseXp, completedExercises.size, workout.exercises.length, bonuses.xpBonusPercent) + prXpBonus
    const coins = calculateCoinsForWorkout(workout.baseXp, completedExercises.size, workout.exercises.length, bossDefeated, bonuses.coinBonusPercent) + prCoinsBonus
    await tx.insert(completion).values({
      id, userId, workoutId, sets, xp: baseXp, coins, bossDefeated, recordCount: totalRecords,
      workoutSnapshot: {
        name: workout.name,
        type: workout.type,
        elapsedSeconds,
        exercises: Object.fromEntries(workout.exercises.map(exercise => [exercise.id, exercise.name])),
      },
    })
    const achievementXp = await unlockAchievements(tx, userId, current!.xp + baseXp)
    const xp = baseXp + achievementXp
    if (achievementXp) {
      await tx.update(completion).set({ xp }).where(and(eq(completion.userId, userId), eq(completion.id, id)))
    }
    const [updated] = await tx.update(progress)
      .set({ xp: current!.xp + xp, coins: current!.coins + coins })
      .where(eq(progress.userId, userId)).returning()
    await recordProgress(tx, userId, 'workout', workout.name, current!, updated!)
    return { earnedXp: xp, earnedCoins: coins, xp: updated!.xp, coins: updated!.coins, bossDefeated }
  })
})
