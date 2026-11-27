import { requireUser } from '../utils/authentication'
import { getQuests } from '../utils/quests'
import { getDatabase } from '../utils/database'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return getQuests(getDatabase(), await requireUser(event.headers))
})
