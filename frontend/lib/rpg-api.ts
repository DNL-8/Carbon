import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { components } from './api.generated'

const quest = z.object({
  id: z.enum(['workout_today', 'steps_6000', 'weight_today', 'weekly_workouts_3', 'weekly_volume_4000', 'weekly_pr_1']),
  title: z.string(), subtitle: z.string(), xpReward: z.number(), coinsReward: z.number(),
  progressText: z.string(), progressPercent: z.number().min(0).max(100), isFulfilled: z.boolean(), claimed: z.boolean(),
})

export const missionsResult = z.object({
  daily: z.array(quest), weekly: z.array(quest),
  raid: z.object({
    weekKey: z.string(), bossName: z.string(), bossSubtitle: z.string(), currentHp: z.number(), maxHp: z.number(),
    hpPercent: z.number().min(0).max(100), isDefeated: z.boolean(), workoutsThisWeek: z.number(),
    weeklyVolumeKg: z.number(), weeklyPrCount: z.number(),
  }),
})

export const vowsResult = z.array(z.object({
  id: z.string(), title: z.string(), outcome: z.enum(['complete', 'violate']).nullable(),
}))

export const achievementsResult = z.array(z.object({
  id: z.string(), title: z.string(), description: z.string(), icon: z.string(), bonusXp: z.number(),
  unlockedAt: z.string().nullable(),
}))

export const slots = { elmo: 'Elmo', armadura: 'Armadura', capa: 'Capa', arma: 'Arma' }
const slot = z.enum(['elmo', 'armadura', 'capa', 'arma'])

export const itemsResult = z.array(z.object({
  id: z.string(), name: z.string(), description: z.string(), slot, rarity: z.string(), priceCoins: z.number(),
  acquisition: z.enum(['starter', 'reward', 'purchase']).default('purchase'),
  powerBonusLabel: z.string(), setId: z.string().nullish(), owned: z.boolean(), equipped: z.boolean(),
  unlock: z.object({ met: z.boolean(), progressText: z.string() }),
}))

export const loadoutsResult = z.array(z.object({
  id: z.string(), name: z.string(), gear: z.partialRecord(slot, z.string().nullable()),
}))

export const idResult = z.object({ id: z.string() })
export type Quest = z.infer<typeof quest>
export type VowInput = components['schemas']['CreateVow'] | components['schemas']['ChangeVow']
export type ArmoryInput = components['schemas']['ArmoryAction'] | components['schemas']['SaveLoadout'] | components['schemas']['ChangeLoadout']

export function refreshRpg(client: QueryClient, ...domains: string[]) {
  return Promise.all(['progress', 'dashboard', 'ledger', ...domains].map(key => client.invalidateQueries({ queryKey: [key] })))
}
