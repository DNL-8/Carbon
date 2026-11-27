import { requireUser } from '../../utils/authentication'
import { readStravaSession, stravaConfig } from '../../utils/strava'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const c = stravaConfig()
  const session = c.configured ? readStravaSession(event, userId) : null
  return { configured: c.configured, connected: Boolean(session), callbackUrl: c.callbackUrl }
})
