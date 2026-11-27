import { eq } from 'drizzle-orm'
import { progress } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { getEquipment } from '../utils/equipment'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const [totals] = await db.select().from(progress).where(eq(progress.userId, userId))
  const { items } = await getEquipment(db, userId, totals?.xp ?? 0, totals?.coins ?? 0)
  return items
})
