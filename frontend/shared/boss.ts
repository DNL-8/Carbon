import type { WorkoutTemplate } from '../../src/types/fitness'
import { calculateWorkoutBossState, getBossForWorkout, parseExercisePrescription } from '../../src/utils/rpgLogic'

export function getWorkoutCombat(
  workout: WorkoutTemplate,
  sets: readonly { exerciseId: string, reps: number }[],
  elapsedSeconds: number,
  damageBonus: number,
) {
  const boss = getBossForWorkout(workout)
  const seriesByExercise = new Map<string, number>()
  for (const set of sets) {
    if (set.reps > 0) seriesByExercise.set(set.exerciseId, (seriesByExercise.get(set.exerciseId) ?? 0) + 1)
  }
  let totalSets = 0
  let completedSets = 0
  for (const exercise of workout.exercises) {
    const target = parseExercisePrescription(exercise.prescription).setsCount
    totalSets += target
    completedSets += Math.min(target, seriesByExercise.get(exercise.id) ?? 0)
  }
  const state = calculateWorkoutBossState(boss.maxHp, seriesByExercise.size, workout.exercises.length,
    elapsedSeconds, workout.durationMinutes * 60, damageBonus, { completedSets, totalSets })
  return { boss, state, completedSets, totalSets }
}
