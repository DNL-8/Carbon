import type { WorkoutTemplate } from '../../src/types/fitness'
import { parseExercisePrescription } from '../../src/utils/rpgLogic'
export interface FocusSet { exerciseId: string, reps: number, weightKg: number, completed: boolean }
export function initialFocusSets(workout: WorkoutTemplate): FocusSet[] {
  const rows: FocusSet[] = []
  for (const exercise of workout.exercises) {
    const { setsCount, targetReps } = parseExercisePrescription(exercise.prescription)
    rows.push(...Array.from({ length: Math.min(setsCount, Math.max(1, 150 - rows.length - (workout.exercises.length - 1 - workout.exercises.indexOf(exercise)))) }, () => ({
      exerciseId: exercise.id, reps: targetReps, weightKg: Math.max(0, Math.min(2000, exercise.loadKg ?? 0)), completed: false,
    })))
  }
  return rows
}
export const completedFocusSets = (sets: readonly FocusSet[]) => sets.filter(s => s.completed).map(({ exerciseId, reps, weightKg }) => ({ exerciseId, reps, weightKg }))
