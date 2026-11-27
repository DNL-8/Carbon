import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { customWorkout } from '../../../db/schema'
import { requireUser } from '../../../utils/authentication'
import { getDatabase } from '../../../utils/database'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { id } = await getValidatedRouterParams(event, value => z.object({ id: z.uuid() }).parse(value))
  await getDatabase().delete(customWorkout).where(and(eq(customWorkout.userId, userId), eq(customWorkout.id, id)))
  return { deleted: true }
})
