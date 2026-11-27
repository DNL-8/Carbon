import { z } from 'zod'
import { weightCheckIn } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'
import { todayInSaoPaulo } from '../../utils/quests'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { kg, dateKey } = await readValidatedBody(event, body => z.object({ kg: z.number().min(20).max(500), dateKey: z.iso.date().optional() }).parse(body))
  const day = dateKey ?? todayInSaoPaulo()
  if (day > todayInSaoPaulo()) throw createError({ statusCode: 400, statusMessage: 'Data futura nao permitida' })
  await getDatabase().insert(weightCheckIn).values({ userId, day, kg }).onConflictDoUpdate({
    target: [weightCheckIn.userId, weightCheckIn.day],
    set: { kg },
  })
  return { kg }
})
