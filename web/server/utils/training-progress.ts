import { eq, sql } from 'drizzle-orm'
import { calculateLevel, createInitialGameStats, getEffectiveCurrentStreak, INITIAL_WORKOUTS } from '../../../src/utils/rpgLogic'
import { completion, progress } from '../db/schema'
import type { getDatabase } from './database'

export const workoutDay = sql<string>`timezone('America/Sao_Paulo', ${completion.createdAt})::date::text`
const workoutType = sql<string | null>`${completion.workoutSnapshot}->>'type'`
const catalogTypes = new Map(INITIAL_WORKOUTS.map(item => [item.id, item.type]))

export async function readTrainingProgress(db: ReturnType<typeof getDatabase>, userId: string, today: string) {
  const [[totals], dates, counts] = await Promise.all([
    db.select().from(progress).where(eq(progress.userId, userId)),
    db.selectDistinct({ dateKey: workoutDay }).from(completion).where(eq(completion.userId, userId)).orderBy(workoutDay),
    db.select({
      workoutId: completion.workoutId,
      type: workoutType,
      count: sql<number>`count(*)::int`,
      bosses: sql<number>`count(*) filter (where ${completion.bossDefeated})::int`,
      elapsed: sql<number>`coalesce(sum((${completion.workoutSnapshot}->>'elapsedSeconds')::double precision), 0)`,
    }).from(completion).where(eq(completion.userId, userId)).groupBy(completion.workoutId, workoutType),
  ])
  let streak = 0
  let longestStreak = 0
  let previous = 0
  for (const { dateKey } of dates) {
    const date = Date.parse(dateKey)
    streak = date - previous === 86_400_000 ? streak + 1 : 1
    longestStreak = Math.max(longestStreak, streak)
    previous = date
  }
  const lastWorkoutDate = dates.at(-1)?.dateKey ?? null
  const stats = {
    ...createInitialGameStats(userId),
    totalXp: totals?.xp ?? 0,
    level: calculateLevel(totals?.xp ?? 0),
    hunterHp: totals?.hp ?? 100,
    goldCoins: totals?.coins ?? 0,
    currentStreak: getEffectiveCurrentStreak(streak, lastWorkoutDate, today),
    longestStreak,
    lastWorkoutDate,
    totalWorkouts: counts.reduce((sum, item) => sum + item.count, 0),
    bossesDefeated: counts.reduce((sum, item) => sum + item.bosses, 0),
    totalMinutes: counts.reduce((sum, item) => sum + item.elapsed, 0) / 60,
  }
  for (const item of counts) {
    switch (item.type ?? catalogTypes.get(item.workoutId)) {
      case 'forca': stats.forcaWorkouts += item.count; break
      case 'cardio': stats.cardioWorkouts += item.count; break
      case 'hiit': stats.hiitWorkouts += item.count; break
      case 'core': stats.coreWorkouts += item.count; break
      case 'mobilidade': stats.mobilidadeWorkouts += item.count; break
      case 'corpo_inteiro': stats.corpoInteiroWorkouts += item.count; break
    }
  }
  return stats
}
