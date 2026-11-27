import { and, desc, eq, count } from 'drizzle-orm'
import { healthActivity, healthMetric } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const metrics = and(eq(healthMetric.userId, userId), eq(healthMetric.source, 'health_connect'))
  const activities = and(eq(healthActivity.userId, userId), eq(healthActivity.source, 'health_connect'))
  const [[days], [sessions], recentMetrics] = await Promise.all([
    db.select({ value: count() }).from(healthMetric).where(metrics),
    db.select({ value: count() }).from(healthActivity).where(activities),
    db.select({ dateKey: healthMetric.dateKey, data: healthMetric.data }).from(healthMetric).where(metrics).orderBy(desc(healthMetric.dateKey)).limit(30),
  ])
  const latest = recentMetrics[0]
  return {
    daysCount: days?.value ?? 0,
    activitiesCount: sessions?.value ?? 0,
    latestDateKey: latest?.dateKey ?? null,
    latestSteps: latest?.data.steps ?? null,
    latestCalories: latest?.data.activeCalories ?? null,
    dailyMetrics: recentMetrics.map(({ dateKey, data }) => ({
      dateKey,
      steps: data.steps ?? null,
      calories: data.activeCalories ?? null,
      sleepHours: data.sleepHours ?? null,
    })),
  }
})
