import { requireUser } from '../../utils/authentication'
import { assertStravaOrigin, createStravaAuthorization } from '../../utils/strava'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  assertStravaOrigin(event)
  return { url: createStravaAuthorization(event, userId) }
})
