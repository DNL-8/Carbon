import { stravaConfig } from '../../utils/strava'
export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const c = stravaConfig()
  return { configured: c.configured, callbackUrl: c.callbackUrl }
})
