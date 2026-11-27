import { eq } from 'drizzle-orm'
import { dailyVow } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { todayInSaoPaulo } from '../utils/quests'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const day = todayInSaoPaulo()
  const rows = await getDatabase().select({
    id: dailyVow.id, title: dailyVow.title, resolvedDay: dailyVow.resolvedDay, outcome: dailyVow.outcome,
  }).from(dailyVow).where(eq(dailyVow.userId, userId)).orderBy(dailyVow.title)
  return rows.map(({ resolvedDay, outcome, ...vow }) => ({ ...vow, outcome: resolvedDay === day ? outcome : null }))
})
