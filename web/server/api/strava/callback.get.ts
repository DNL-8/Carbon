import { requireUser } from '../../utils/authentication'
import { finishStravaAuthorization } from '../../utils/strava'
export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  const userId = await requireUser(event.headers)
  try {
    await finishStravaAuthorization(event, userId, getQuery(event))
    return sendRedirect(event, '/?tab=progresso&strava=connected', 303)
  } catch {
    return sendRedirect(event, '/?tab=progresso&strava=error', 303)
  }
})
