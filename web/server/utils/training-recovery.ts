import { computeRecoveryAssessment } from '../../../src/utils/rpgLogic'
import type { GameStats, HealthActivity } from '../../../src/types/fitness'

import type { StoredHealthMetric } from '../../shared/health'

type RecordedWorkout = { dateKey: string, snapshot: { elapsedSeconds?: number } | null }

export function assessTrainingRecovery(
  workouts: RecordedWorkout[],
  activities: Pick<HealthActivity, 'dateKey' | 'durationMinutes' | 'zoneMinutes'>[],
  metrics: Pick<StoredHealthMetric, 'dateKey' | 'sleepHours' | 'restingHeartRate' | 'hrvMs'>[],
  stats: Pick<GameStats, 'hunterHp'>,
  baseline: number | null | undefined,
  today: string,
) {
  const logs = workouts.flatMap(item => typeof item.snapshot?.elapsedSeconds === 'number'
    ? [{ dateKey: item.dateKey, durationMinutes: item.snapshot.elapsedSeconds / 60 }]
    : [])
  const completeDurations = logs.length === workouts.length
  if (!completeDurations || (!logs.some(log => log.durationMinutes > 0) && !activities.some(activity => activity.durationMinutes > 0))) {
    return { recovery: null, acwr: null, completeDurations }
  }
  const hasPhysiology = metrics.some(item => Date.parse(today) - Date.parse(item.dateKey) < 7 * 86_400_000
    && ((item.sleepHours ?? 0) > 0 || (baseline != null && (item.restingHeartRate ?? 0) > 0)))
  // A missing personal baseline must not count as a measured change in resting heart rate.
  const recoveryMetrics = metrics.map(item => ({
    dateKey: item.dateKey,
    sleepHours: item.sleepHours ?? 0,
    restingHeartRate: baseline == null ? null : item.restingHeartRate ?? null,
    hrvMs: item.hrvMs ?? null,
  }))
  const assessment = computeRecoveryAssessment(logs, activities, recoveryMetrics, stats, baseline ?? 60, today)
  return { recovery: hasPhysiology ? assessment : null, acwr: assessment.chronicWeeklyAvg28d > 0 ? assessment.acwrRatio : null, completeDurations }
}
