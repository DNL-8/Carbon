import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { weightCheckIn } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { dateKey } = await readValidatedBody(event, value => z.object({ dateKey: z.iso.date() }).parse(value))
  await getDatabase().delete(weightCheckIn).where(and(eq(weightCheckIn.userId, userId), eq(weightCheckIn.day, dateKey)))
  return { deleted: true }
})
