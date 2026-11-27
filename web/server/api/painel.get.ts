import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { calculateDerivedAttributes, getDualProgressionStatus } from '../../../src/utils/rpgLogic'
import { completion, healthActivity, healthMetric, heroProfile, weightCheckIn } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { todayInSaoPaulo } from '../utils/quests'
import { readTrainingProgress, workoutDay } from '../utils/training-progress'
import { assessTrainingRecovery } from '../utils/training-recovery'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const today = todayInSaoPaulo()
  const since = new Date(Date.parse(today) - 27 * 86_400_000).toISOString().slice(0, 10)
  const healthDay = sql<string>`${healthActivity.data}->>'dateKey'`
  const [workouts, imported, metrics, weights, [hero], stats, [activityCount]] = await Promise.all([
    db.select({ dateKey: workoutDay, workoutId: completion.workoutId, snapshot: completion.workoutSnapshot })
      .from(completion).where(and(eq(completion.userId, userId), gte(workoutDay, since), lte(workoutDay, today))),
    db.select({ data: healthActivity.data }).from(healthActivity).where(and(eq(healthActivity.userId, userId), gte(healthDay, since), lte(healthDay, today))),
    db.select({ data: healthMetric.data }).from(healthMetric).where(and(eq(healthMetric.userId, userId), gte(healthMetric.dateKey, since), lte(healthMetric.dateKey, today))),
    db.select({ dateKey: weightCheckIn.day, kg: weightCheckIn.kg }).from(weightCheckIn).where(eq(weightCheckIn.userId, userId)).orderBy(desc(weightCheckIn.day)).limit(90),
    db.select({ data: heroProfile.data }).from(heroProfile).where(eq(heroProfile.userId, userId)),
    readTrainingProgress(db, userId, today),
    db.select({ count: sql<number>`count(*)::int` }).from(healthActivity).where(eq(healthActivity.userId, userId)),
  ])
  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = new Date(Date.parse(today) - (6 - index) * 86_400_000).toISOString().slice(0, 10)
    return { dateKey, count: workouts.filter(item => item.dateKey === dateKey).length + imported.filter(item => item.data.dateKey === dateKey).length }
  })
  const todaySteps = metrics.filter(item => item.data.dateKey === today).flatMap(({ data }) => data.steps == null ? [] : [data.steps])
  const conditioning = assessTrainingRecovery(workouts, imported.map(item => item.data), metrics.map(item => item.data), stats, hero?.data.restingHrBaseline, today)
  return {
    today, days, weights, workoutDates: workouts.map(item => ({ dateKey: item.dateKey, workoutId: item.workoutId })),
    stepsToday: todaySteps.length ? Math.max(...todaySteps) : null,
    totalWorkouts: stats.totalWorkouts, bossesDefeated: stats.bossesDefeated, longestStreak: stats.longestStreak, currentStreak: stats.currentStreak,
    importedCount: activityCount?.count ?? 0,
    ...conditioning, dual: getDualProgressionStatus(stats, today),
    attributes: hero?.data ? calculateDerivedAttributes(stats, hero.data.heroClass) : null,
  }
})
