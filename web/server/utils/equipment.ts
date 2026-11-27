import { eq, sql } from 'drizzle-orm'
import {
  DEFAULT_EQUIPPED_GEAR, DEFAULT_OWNED_EQUIPMENT_IDS, EQUIPMENT_CATALOG,
  calculateLevel, createInitialGameStats, getEquipmentRequirementProgress,
} from '../../../src/utils/rpgLogic'
import { arsenal, completion, questClaim } from '../db/schema'
import type { getDatabase } from './database'

type Database = ReturnType<typeof getDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export async function getEquipment(db: Database | Transaction, userId: string, xp: number, coins: number) {
  const [gear] = await db.select().from(arsenal).where(eq(arsenal.userId, userId))
  const workouts = await db.select({
    day: sql<string>`timezone('America/Sao_Paulo', ${completion.createdAt})::date::text`,
    coins: completion.coins,
    bossDefeated: completion.bossDefeated,
  }).from(completion).where(eq(completion.userId, userId))
  const [claims] = await db.select({ coins: sql<number>`coalesce(sum(${questClaim.coins}), 0)::int` })
    .from(questClaim).where(eq(questClaim.userId, userId))
  const days = [...new Set(workouts.map(workout => workout.day))].sort()
  let longestStreak = 0
  let streak = 0
  let previousDay = 0
  for (const day of days) {
    const currentDay = Date.parse(day)
    streak = currentDay - previousDay === 86_400_000 ? streak + 1 : 1
    longestStreak = Math.max(longestStreak, streak)
    previousDay = currentDay
  }
  const stats = {
    ...createInitialGameStats(userId), totalXp: xp, level: calculateLevel(xp), goldCoins: coins,
    totalCoinsEarned: workouts.reduce((sum, row) => sum + row.coins, claims?.coins ?? 0),
    totalWorkouts: workouts.length, longestStreak,
    bossesDefeated: workouts.filter(workout => workout.bossDefeated).length,
  }
  const owned = gear?.owned ?? [...DEFAULT_OWNED_EQUIPMENT_IDS]
  const equipped = gear?.equipped ?? DEFAULT_EQUIPPED_GEAR
  const items = EQUIPMENT_CATALOG.map(item => ({
    ...item, owned: owned.includes(item.id), equipped: equipped[item.slot] === item.id,
    unlock: getEquipmentRequirementProgress(item, stats),
  }))
  return { owned, equipped, items }
}
