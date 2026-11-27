import { useMemo } from 'react';
import type { HealthConnectReadStatus } from '../../services/api';
import type { AppAuthUser } from '../../types/auth';
import type { DailyHealthMetric, HealthActivity } from '../../types/fitness';
import { projectHealthConnect } from '../../utils/healthConnect';

export function useHealthReports(
  user: AppAuthUser,
  enabled: boolean,
  activities: HealthActivity[],
  metrics: DailyHealthMetric[]
) {
  const { uid } = user;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const healthConnectStatus: HealthConnectReadStatus | 'loading' = enabled ? 'available' : 'loading';

  const healthReports = useMemo(
    () => (enabled ? projectHealthConnect([], activities, metrics, uid, timezone) : null),
    [enabled, activities, metrics, uid, timezone]
  );

  return { healthConnectStatus, healthReports };
}
