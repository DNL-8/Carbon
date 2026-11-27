import { eq, sql } from 'drizzle-orm'
import { calculateActivityXp } from '../../../src/utils/rpgLogic'
import type { HealthConnectImportInput, HealthImportInput, StoredHealthMetric } from '../../shared/health'
import { healthActivity, healthMetric, ledger, progress } from '../db/schema'
import { getDatabase } from './database'

export async function persistHealthImport(userId: string, { source, activities, dailyMetrics }: HealthImportInput | HealthConnectImportInput) {
  const metricsByDate = new Map<string, StoredHealthMetric>()
  for (const metric of dailyMetrics) {
    const previous = metricsByDate.get(metric.dateKey)
    metricsByDate.set(metric.dateKey, source === 'health_connect' ? { ...previous, ...metric } : metric)
  }
  const uniqueMetrics = [...metricsByDate.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  return getDatabase().transaction(async tx => {
    let imported = 0
    let xp = 0
    if (activities.length) {
      await tx.insert(progress).values({ userId }).onConflictDoNothing()
      const [balance] = await tx.select().from(progress).where(eq(progress.userId, userId)).for('update')
      const rows = activities.map(data => ({
        userId, source, externalId: data.externalId, data: { ...data, source },
        xp: calculateActivityXp(data.durationMinutes, data.distanceKm, data.sportType),
      })).sort((a, b) => a.externalId.localeCompare(b.externalId))
      const inserted = await tx.insert(healthActivity).values(rows).onConflictDoNothing()
        .returning({ xp: healthActivity.xp, data: healthActivity.data })
      imported = inserted.length
      if (imported) {
        await tx.insert(ledger).values(inserted.map(activity => {
          xp += activity.xp
          return {
            userId, kind: 'health_activity' as const, title: activity.data.title,
            xpDelta: activity.xp, coinDelta: 0, totalXp: balance!.xp + xp, goldCoins: balance!.coins,
          }
        }))
        await tx.update(progress).set({ xp: balance!.xp + xp }).where(eq(progress.userId, userId))
      }
    }
    if (uniqueMetrics.length) {
      await tx.insert(healthMetric).values(uniqueMetrics.map(data => ({
        userId, source, dateKey: data.dateKey, data,
      }))).onConflictDoUpdate({
        target: [healthMetric.userId, healthMetric.source, healthMetric.dateKey],
        set: { data: source === 'health_connect' ? sql`${healthMetric.data} || excluded.data` : sql`excluded.data` },
      })
    }
    return { imported, duplicates: activities.length - imported, days: uniqueMetrics.length, xp }
  })
}
