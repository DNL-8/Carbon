import { progress } from '../db/schema'
import { getAuth } from '../utils/authentication'
import { getDatabase } from '../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    getAuth()
    await getDatabase().select({ xp: progress.xp }).from(progress).limit(0)
    return { ready: true }
  } catch {
    setResponseStatus(event, 503)
    return { ready: false }
  }
})
