import { eq } from 'drizzle-orm'
import { customWorkout } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const rows = await getDatabase().select({ workout: customWorkout.data }).from(customWorkout)
    .where(eq(customWorkout.userId, userId))
  return rows.map(row => row.workout)
})
