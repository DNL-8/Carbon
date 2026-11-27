import { requireUser } from '../../utils/authentication'
import { assertStravaOrigin, clearStravaSession } from '../../utils/strava'
export default defineEventHandler(async event => {
  await requireUser(event.headers)
  assertStravaOrigin(event)
  clearStravaSession(event)
  return { disconnected: true }
})
