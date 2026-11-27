import { expect, test } from 'vitest'
import { mapStravaActivity } from '../server/utils/strava'
import { healthConnectImportSchema, manualHealthImportSchema } from '../shared/health'
const metric = { dateKey: '2026-11-25', steps: 100, activeCalories: 0, sleepHours: 0, restingHeartRate: null, hrvMs: null, trainingLoadScore: 0, recoveryScore: 0 }
test('dedicated integration sources cannot be submitted through manual file route', () => {
  expect(manualHealthImportSchema.safeParse({ source: 'csv', activities: [], dailyMetrics: [metric] }).success).toBe(true)
  expect(manualHealthImportSchema.safeParse({ source: 'strava', activities: [], dailyMetrics: [metric] }).success).toBe(false)
  expect(healthConnectImportSchema.safeParse({ source: 'health_connect', activities: [], dailyMetrics: [metric] }).success).toBe(true)
  expect(healthConnectImportSchema.safeParse({ source: 'strava', activities: [], dailyMetrics: [metric] }).success).toBe(false)
})

test('Strava maps only actual provider measurements without invented heart rate zones', () => {
  const a = mapStravaActivity({ id: 42, name: 'Caminhada', sport_type: 'Walk', start_date: '2026-11-25T12:00:00Z', moving_time: 1800, distance: 2500 })
  expect(a).toMatchObject({ externalId: 'strava_42', source: 'strava', durationMinutes: 30, distanceKm: 2.5, avgHeartRate: null, zoneMinutes: [0,0,0,0,0] })
  expect(mapStravaActivity({ id: 42 })).toBeNull()
})
