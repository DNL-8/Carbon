import { eq } from 'drizzle-orm'
import { heroProfile } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const [row] = await getDatabase().select().from(heroProfile).where(eq(heroProfile.userId, userId))
  return { profile: row?.data ?? null }
})
