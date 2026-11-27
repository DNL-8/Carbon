import { z } from 'zod'

export const manualHealthSource = z.enum(['apple_health', 'samsung_health', 'gpx', 'csv'])
export const healthSource = z.enum(['apple_health', 'samsung_health', 'gpx', 'csv', 'strava', 'health_connect'])
const nonnegative = z.number().nonnegative()
const label = z.string().trim().min(1).max(240)
const dateKey = z.iso.date()

export const healthActivitySchema = z.object({
  externalId: label,
  source: healthSource,
  title: label,
  sportType: label,
  dateKey,
  startedAt: z.iso.datetime({ offset: true }),
  durationMinutes: nonnegative,
  distanceKm: nonnegative,
  calories: nonnegative,
  elevationGainM: nonnegative,
  avgHeartRate: nonnegative.nullable(),
  maxHeartRate: nonnegative.nullable(),
  zoneMinutes: z.tuple([nonnegative, nonnegative, nonnegative, nonnegative, nonnegative]),
  hrSamplePoints: z.array(nonnegative).max(40),
})

export const healthMetricSchema = z.object({
  dateKey,
  steps: nonnegative,
  activeCalories: nonnegative,
  sleepHours: nonnegative,
  restingHeartRate: nonnegative.nullable(),
  hrvMs: nonnegative.nullable(),
  trainingLoadScore: nonnegative,
  recoveryScore: nonnegative,
})

const healthImportFields = {
  source: healthSource,
  activities: z.array(healthActivitySchema).max(25),
}

export const healthImportSchema = z.object({
  ...healthImportFields,
  dailyMetrics: z.array(healthMetricSchema).max(25),
}).refine(value => value.activities.length + value.dailyMetrics.length > 0)

export const manualHealthImportSchema = healthImportSchema.refine(value => manualHealthSource.safeParse(value.source).success && value.activities.every(item => item.source === value.source))
const healthConnectMetricSchema = healthMetricSchema.partial().required({ dateKey: true })
  .refine(({ dateKey: _dateKey, ...measurements }) => Object.values(measurements).some(value => value != null))

export const healthConnectImportSchema = z.object({
  ...healthImportFields,
  dailyMetrics: z.array(healthConnectMetricSchema).max(25),
}).refine(value => value.activities.length + value.dailyMetrics.length > 0)
  .refine(value => value.source === 'health_connect' && value.activities.every(item => item.source === 'health_connect' && item.externalId.startsWith('health-connect-') && item.sportType !== 'heart_rate_monitor'))
export type HealthConnectImportInput = z.infer<typeof healthConnectImportSchema>
export type StoredHealthMetric = HealthConnectImportInput['dailyMetrics'][number]
export type HealthImportInput = z.infer<typeof healthImportSchema>
export type HealthActivityInput = z.infer<typeof healthActivitySchema>
export type HealthMetricInput = z.infer<typeof healthMetricSchema>
