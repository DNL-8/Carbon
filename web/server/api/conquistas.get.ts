import { eq } from 'drizzle-orm'
import { ACHIEVEMENT_DEFINITIONS } from '../../../src/utils/rpgLogic'
import { achievement } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const rows = await getDatabase().select().from(achievement).where(eq(achievement.userId, userId))
  const unlocked = new Map(rows.map(item => [item.id, item.unlockedAt]))
  return ACHIEVEMENT_DEFINITIONS.map(definition => ({
    ...definition, unlockedAt: unlocked.get(definition.id) ?? null,
  }))
})
