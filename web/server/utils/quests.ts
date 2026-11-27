import { and, between, eq, inArray, sql } from 'drizzle-orm'
import {
  evaluateDailyAutoQuests, evaluateWeeklyAutoQuests, getIsoWeekDateRange, getWeeklyRaidBossState,
} from '../../../src/utils/rpgLogic'
import { completion, healthActivity, healthMetric, questClaim, weightCheckIn } from '../db/schema'
import type { getDatabase } from './database'

type Database = ReturnType<typeof getDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })

export function todayInSaoPaulo() {
  return dateFormatter.format(new Date())
}

export async function getQuests(db: Database | Transaction, userId: string) {
  const day = todayInSaoPaulo()
  const { weekKey, startDateKey, endDateKey } = getIsoWeekDateRange(day)
  const completionDay = sql<string>`timezone('America/Sao_Paulo', ${completion.createdAt})::date::text`
  const activityDay = sql<string>`${healthActivity.data}->>'dateKey'`
  const workouts = await db.select({ dateKey: completionDay, sets: completion.sets, prCount: completion.recordCount })
    .from(completion).where(and(eq(completion.userId, userId), between(completionDay, startDateKey, endDateKey)))
  const activities = await db.select({ dateKey: activityDay }).from(healthActivity)
    .where(and(eq(healthActivity.userId, userId), between(activityDay, startDateKey, endDateKey)))
  const claims = await db.select({ day: questClaim.day, quest: questClaim.questId }).from(questClaim)
    .where(and(eq(questClaim.userId, userId), inArray(questClaim.day, [day, weekKey])))
  const [steps] = await db.select({ value: sql<number>`coalesce(max((${healthMetric.data}->>'steps')::double precision), 0)` })
    .from(healthMetric).where(and(eq(healthMetric.userId, userId), eq(healthMetric.dateKey, day)))
  const [weight] = await db.select({ kg: weightCheckIn.kg }).from(weightCheckIn)
    .where(and(eq(weightCheckIn.userId, userId), eq(weightCheckIn.day, day)))
  const logs = workouts.map(({ sets, ...workout }) => ({
    ...workout,
    totalVolumeKg: sets.reduce((volume, set) => volume + Math.min(500, set.weightKg) * set.reps, 0),
  }))
  const claimed = claims.map(claim => `${claim.day}:${claim.quest}`)
  return {
    daily: evaluateDailyAutoQuests(day, { steps: steps?.value ?? 0 }, logs, activities,
      weight ? [{ dateKey: day }] : [], claimed)
      .map(quest => ({ ...quest, period: day, claimed: quest.isClaimedToday })),
    weekly: evaluateWeeklyAutoQuests(day, logs, activities, claimed)
      .map(quest => ({ ...quest, period: weekKey, claimed: quest.isClaimedThisWeek })),
    raid: getWeeklyRaidBossState(day, logs, activities),
    weightKg: weight?.kg ?? null,
  }
}
