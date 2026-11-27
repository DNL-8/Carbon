import { z } from 'zod'
import { healthSource, manualHealthSource } from '../shared/health'

export type Period = '7' | '28' | '90'
export type Source = 'all' | z.infer<typeof healthSource>
export type ManualSource = z.infer<typeof manualHealthSource>

export const sources: Record<Source, string> = {
  all: 'Todas as fontes', apple_health: 'Apple Health', samsung_health: 'Samsung Health',
  gpx: 'GPX', csv: 'CSV', strava: 'Strava', health_connect: 'Health Connect',
}
const values = z.object({ durationMinutes: z.number(), distanceKm: z.number(), calories: z.number() })
const metric = z.object({
  steps: z.number().nullish(), activeCalories: z.number().nullish(), sleepHours: z.number().nullish(),
  restingHeartRate: z.number().nullish(), hrvMs: z.number().nullish(),
})
export const summaryResult = z.object({
  activities: z.array(z.object({
    id: z.string(), source: healthSource,
    data: values.extend({ title: z.string(), dateKey: z.iso.date(), avgHeartRate: z.number().nullish() }),
  })),
  dailyMetrics: z.array(z.object({ date: z.iso.date(), source: healthSource, data: metric })),
  trend: z.array(values.extend({ dateKey: z.iso.date() })),
  totals: values.extend({
    count: z.number(), avgHeartRate: z.number().nullable(),
    z1: z.number(), z2: z.number(), z3: z.number(), z4: z.number(), z5: z.number(),
  }),
  since: z.iso.date(), today: z.iso.date(),
})

export const connectResult = z.object({
  daysCount: z.number(), activitiesCount: z.number(),
  dailyMetrics: z.array(z.object({
    dateKey: z.iso.date(), steps: z.number().nullable(), calories: z.number().nullable(), sleepHours: z.number().nullable(),
  })),
})

export const importResult = z.object({ imported: z.number(), duplicates: z.number(), days: z.number(), xp: z.number() })
export const stravaSyncResult = importResult.omit({ days: true }).extend({ truncated: z.boolean() })
export const stravaStatusResult = z.object({ configured: z.boolean(), connected: z.boolean(), callbackUrl: z.string().nullable() })
export const localDay = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
export const formatDay = (day: string) => localDay.format(new Date(day + 'T12:00:00Z'))
const metricNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
export const formatMetric = (value: number | null | undefined, unit = '') =>
  value == null ? '—' : metricNumber.format(value) + (unit ? ' ' + unit : '')
