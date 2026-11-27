import { z } from 'zod'
import { workoutResult } from './api'
import { listPendingWorkouts } from './pending-workouts'

const schema = z.object({
  version: z.literal(1), owner: z.string(), id: z.uuid(), workout: workoutResult,
  sets: z.array(z.object({
    exerciseId: z.string(), reps: z.number().finite(), weightKg: z.number().finite(), completed: z.boolean(),
  })).min(1).max(150),
  index: z.number().int().nonnegative(), elapsedSeconds: z.number().int().min(0).max(28800),
}).refine(value => value.index < value.workout.exercises.length &&
  value.sets.every(set => value.workout.exercises.some(exercise => exercise.id === set.exerciseId) &&
    (!set.completed || (Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 500 && set.weightKg >= 0 && set.weightKg <= 2000))))

export type WorkoutDraft = z.infer<typeof schema>
const key = (owner: string) => 'murim-draft-v1:' + encodeURIComponent(owner)

export function loadDraft(owner: string): WorkoutDraft | null {
  try {
    const value = schema.safeParse(JSON.parse(localStorage.getItem(key(owner)) ?? 'null'))
    if (!value.success || value.data.owner !== owner) return null
    // The confirmed submission queue takes precedence over a stale draft.
    if (listPendingWorkouts(owner).some(entry => entry.body.id === value.data.id)) return null
    return value.data
  } catch { return null }
}

export function saveDraft(owner: string, draft: WorkoutDraft): boolean {
  try {
    if (draft.owner !== owner) return false
    const current = loadDraft(owner)
    if (current && current.id !== draft.id) return false
    localStorage.setItem(key(owner), JSON.stringify(schema.parse(draft)))
    return true
  } catch { return false }
}

export function removeDraft(owner: string, id: string) {
  try {
    const raw = schema.safeParse(JSON.parse(localStorage.getItem(key(owner)) ?? 'null'))
    if (raw.success && raw.data.owner === owner && raw.data.id === id) localStorage.removeItem(key(owner))
  } catch { /* Storage may be disabled. */ }
}
