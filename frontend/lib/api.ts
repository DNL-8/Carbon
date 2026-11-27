import createClient from 'openapi-fetch'
import { z } from 'zod'
import type { paths, components } from './api.generated'
import { profileSchema, workoutTypes, experienceLevels } from '../../web/shared/training'

export const api = createClient<paths>({})
export type FinishInput = components['schemas']['FinishInput']
export type ProfileInput = components['schemas']['ProfileInput']

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export function read<T>(result: { response: Response; data?: unknown; error?: unknown }, schema: z.ZodType<T>): T {
  if (!result.response.ok) {
    const error = z.object({ statusMessage: z.string().optional() }).safeParse(result.error)
    throw new ApiError(result.response.status, (error.success && error.data.statusMessage) || 'Não foi possível carregar os dados.')
  }
  return schema.parse(result.data)
}

const exercise = z.object({
  id: z.string(), name: z.string(), prescription: z.string(), restSeconds: z.number(),
  muscleGroups: z.array(z.string()), executionTip: z.string(), equipment: z.string().optional(),
  loadKg: z.number().optional(), loadNote: z.string().optional(), unilateral: z.boolean().optional(),
})
export const workoutResult = z.object({
  id: z.string(), name: z.string(), description: z.string(), type: z.enum(workoutTypes),
  durationMinutes: z.number(), baseXp: z.number(), difficulty: z.enum(experienceLevels),
  rank: z.enum(['F', 'F II', 'E', 'E II', 'D', 'D II', 'D III', 'C', 'B', 'A', 'S']), exercises: z.array(exercise),
})
export const workouts = z.array(workoutResult)
export const profileResult = z.object({ profile: profileSchema.nullable() })
export const progressResult = z.object({
  xp: z.number(), coins: z.number(), level: z.number(), rank: z.string(), realm: z.string(),
  hp: z.number(), bossDamageBonus: z.number(), currentStreak: z.number(),
})
export const dashboardResult = z.object({
  today: z.iso.date(),
  weights: z.array(z.object({ dateKey: z.iso.date(), kg: z.number() })),
  acwr: z.number().nullable(),
  recovery: z.object({
    score: z.number(), statusLabel: z.string(), avgSleepHours: z.number().nullable(),
    latestRestingHr: z.number().nullable(), recommendation: z.string(),
  }).nullable(),
  days: z.array(z.object({ dateKey: z.string(), count: z.number() })), totalWorkouts: z.number(),
  bossesDefeated: z.number(), longestStreak: z.number(), stepsToday: z.number().nullable(),
})
export const rewardResult = z.object({
  earnedXp: z.number(), earnedCoins: z.number(), xp: z.number(), coins: z.number(), bossDefeated: z.boolean(),
})
export const historyResult = z.object({
  history: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string(), xp: z.number(), coins: z.number() })),
  records: z.array(z.object({ exerciseId: z.string(), name: z.string(), bestWeightKg: z.number(), bestReps: z.number() })),
})
export const ledgerResult = z.object({
  entries: z.array(z.object({
    id: z.number(), title: z.string(), kind: z.string(), createdAt: z.string(),
    xpDelta: z.number(), coinDelta: z.number(), totalXp: z.number(), goldCoins: z.number(),
  })),
  nextCursor: z.number().nullable(),
})
export type Reward = z.infer<typeof rewardResult>
export type Progress = z.infer<typeof progressResult>
export const number = new Intl.NumberFormat('pt-BR')
export const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' })
