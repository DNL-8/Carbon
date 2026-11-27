import { eq } from 'drizzle-orm'
import { arsenal } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const [row] = await getDatabase().select({ loadouts: arsenal.loadouts }).from(arsenal)
    .where(eq(arsenal.userId, userId))
  return row?.loadouts ?? []
})
