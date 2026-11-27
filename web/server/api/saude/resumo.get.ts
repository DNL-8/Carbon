import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { healthActivity, healthMetric } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'
import { todayInSaoPaulo } from '../../utils/quests'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const { period, source } = await getValidatedQuery(event, query => z.object({
    period: z.enum(['7', '28', '30', '90']).default('30'),
    source: z.enum(['all', 'apple_health', 'samsung_health', 'gpx', 'csv', 'strava', 'health_connect']).default('all'),
  }).parse(query))
  const today = todayInSaoPaulo()
  const since = new Date(Date.parse(today) - (Number(period) - 1) * 86_400_000).toISOString().slice(0, 10)
  const day = sql<string>`${healthActivity.data}->>'dateKey'`
  const activityFilter = and(eq(healthActivity.userId, userId), gte(day, since), lte(day, today), source === 'all' ? undefined : eq(healthActivity.source, source))
  const metricFilter = and(eq(healthMetric.userId, userId), gte(healthMetric.dateKey, since), lte(healthMetric.dateKey, today), source === 'all' ? undefined : eq(healthMetric.source, source))
  const [activities, dailyMetrics, trend, [totals]] = await Promise.all([
    db.select({ id: healthActivity.externalId, source: healthActivity.source, data: healthActivity.data })
      .from(healthActivity).where(activityFilter)
      .orderBy(desc(sql`${healthActivity.data}->>'startedAt'`), healthActivity.source, healthActivity.externalId).limit(20),
    db.select({ date: healthMetric.dateKey, source: healthMetric.source, data: healthMetric.data })
      .from(healthMetric).where(metricFilter)
      .orderBy(desc(healthMetric.dateKey), healthMetric.source).limit(20),
    db.select({
      dateKey: day,
      durationMinutes: sql<number>`sum((${healthActivity.data}->>'durationMinutes')::double precision)`,
      distanceKm: sql<number>`sum((${healthActivity.data}->>'distanceKm')::double precision)`,
      calories: sql<number>`sum((${healthActivity.data}->>'calories')::double precision)`,
    }).from(healthActivity).where(activityFilter)
      .groupBy(day).orderBy(day),
    db.select({
      count: sql<number>`count(*)::int`,
      durationMinutes: sql<number>`coalesce(sum((${healthActivity.data}->>'durationMinutes')::double precision), 0)`,
      distanceKm: sql<number>`coalesce(sum((${healthActivity.data}->>'distanceKm')::double precision), 0)`,
      calories: sql<number>`coalesce(sum((${healthActivity.data}->>'calories')::double precision), 0)`,
      avgHeartRate: sql<number | null>`avg((${healthActivity.data}->>'avgHeartRate')::double precision)`,
      z1: sql<number>`coalesce(sum((${healthActivity.data}->'zoneMinutes'->>0)::double precision), 0)`,
      z2: sql<number>`coalesce(sum((${healthActivity.data}->'zoneMinutes'->>1)::double precision), 0)`,
      z3: sql<number>`coalesce(sum((${healthActivity.data}->'zoneMinutes'->>2)::double precision), 0)`,
      z4: sql<number>`coalesce(sum((${healthActivity.data}->'zoneMinutes'->>3)::double precision), 0)`,
      z5: sql<number>`coalesce(sum((${healthActivity.data}->'zoneMinutes'->>4)::double precision), 0)`,
    }).from(healthActivity).where(activityFilter),
  ])
  return { activities, dailyMetrics, trend, totals, since, today }
})
