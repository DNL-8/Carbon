import { z } from 'zod'

export const workoutTypes = ['forca', 'cardio', 'hiit', 'core', 'mobilidade', 'corpo_inteiro'] as const
export const experienceLevels = ['Iniciante', 'Intermediário', 'Avançado'] as const

export const customWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600),
  type: z.enum(workoutTypes),
  durationMinutes: z.number().int().min(1).max(300),
  exercises: z.array(z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    prescription: z.string().trim().min(1).max(120),
    restSeconds: z.number().int().min(0).max(900).optional(),
    muscleGroups: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    executionTip: z.string().trim().max(600).optional(),
    loadKg: z.number().min(0).max(2000).optional(),
    equipment: z.string().trim().max(120).optional(),
    unilateral: z.boolean().optional(),
  })).min(1).max(30),
}).refine(workout => {
  const ids = workout.exercises.flatMap(exercise => exercise.id ? [exercise.id] : [])
  return new Set(ids).size === ids.length
}, 'Cada exercício precisa ter um ID único.')

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  heroClass: z.enum(['Guerreiro', 'Arqueiro', 'Mago']),
  objective: z.enum(['Emagrecer', 'Condicionamento', 'Ambos']),
  experience: z.enum(experienceLevels),
  avatar: z.string().max(24).optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(25).max(350).nullable().optional(),
  restingHrBaseline: z.number().int().min(30).max(120).nullable().optional(),
  maxHrEstimated: z.number().int().min(120).max(220).nullable().optional(),
}).refine(profile => profile.restingHrBaseline == null || profile.maxHrEstimated == null || profile.maxHrEstimated > profile.restingHrBaseline, { message: 'FC máxima precisa ser maior que FC de repouso.' })

export type ProfileInput = z.infer<typeof profileSchema>
export type CustomWorkoutInput = z.infer<typeof customWorkoutSchema>

export const finishTrainingSchema = z.object({
  id: z.uuid(),
  workoutId: z.string().min(1).max(120),
  elapsedSeconds: z.number().int().min(0).max(28_800).default(0),
  sets: z.array(z.object({
    exerciseId: z.string().min(1).max(120),
    reps: z.number().int().min(1).max(500),
    weightKg: z.number().min(0).max(2000),
  })).min(1).max(150),
})
