import { requireUser } from '../../utils/authentication'
import { z } from 'zod'
import { assertStravaOrigin, freshStravaSession, fetchStravaActivities } from '../../utils/strava'
import { persistHealthImport } from '../../utils/health-import'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  assertStravaOrigin(event)
  const { days } = await readValidatedBody(event, body => z.object({ days: z.union([z.literal(7), z.literal(28), z.literal(90)]).default(28) }).parse(body))
  const session = await freshStravaSession(event, userId)
  const { records, truncated } = await fetchStravaActivities(session, days)
  let imported = 0, duplicates = 0, xp = 0
  for (let offset = 0; offset < records.length; offset += 25) {
    const result = await persistHealthImport(userId, { source: 'strava', activities: records.slice(offset, offset + 25), dailyMetrics: [] })
    imported += result.imported
    duplicates += result.duplicates
    xp += result.xp
  }
  return { imported, duplicates, xp, truncated }
})
