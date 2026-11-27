import { eq } from 'drizzle-orm'
import {
  INITIAL_WORKOUTS, calculateLevel, createInitialGameStats, evaluateAchievements,
} from '../../../src/utils/rpgLogic'
import type { AchievementId, UserAchievement } from '../../../src/types/fitness'
import { achievement, completion } from '../db/schema'
import type { getDatabase } from './database'
import { getQuests } from './quests'

type Database = ReturnType<typeof getDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
const standardTypes = new Map(INITIAL_WORKOUTS.map(workout => [workout.id, workout.type]))
const timeZone = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })

export async function unlockAchievements(tx: Transaction, userId: string, xp: number) {
  const workouts = await tx.select({
    id: completion.workoutId, createdAt: completion.createdAt, snapshot: completion.workoutSnapshot, records: completion.recordCount,
  }).from(completion).where(eq(completion.userId, userId))
  const existing = await tx.select().from(achievement).where(eq(achievement.userId, userId))
  const stats = { ...createInitialGameStats(userId), totalXp: xp, level: calculateLevel(xp), totalWorkouts: workouts.length }
  let prCountTotal = 0
  const days = new Set<string>()
  for (const workout of workouts) {
    const type = workout.snapshot?.type ?? standardTypes.get(workout.id)
    if (type === 'cardio') stats.cardioWorkouts += 1
    if (type === 'forca') stats.forcaWorkouts += 1
    prCountTotal += workout.records
    days.add(timeZone.format(workout.createdAt))
  }
  let streak = 0
  let previous = 0
  for (const day of [...days].sort()) {
    const current = Date.parse(day)
    streak = current - previous === 86_400_000 ? streak + 1 : 1
    stats.longestStreak = Math.max(stats.longestStreak, streak)
    previous = current
  }
  const known: Partial<Record<AchievementId, UserAchievement>> = Object.fromEntries(existing.map(item => [
    item.id, { id: item.id, userId, unlocked: true, unlockedAt: item.unlockedAt.toISOString() },
  ]))
  const { raid } = await getQuests(tx, userId)
  const { newlyUnlocked, bonusXpTotal } = evaluateAchievements(stats, known, undefined, { prCountTotal, weeklyRaidDefeated: raid.isDefeated })
  if (newlyUnlocked.length) {
    await tx.insert(achievement).values(newlyUnlocked.map(item => ({ userId, id: item.id })))
  }
  return bonusXpTotal
}
