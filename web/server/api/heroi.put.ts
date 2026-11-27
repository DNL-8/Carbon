import { heroProfile } from '../db/schema'
import { profileSchema } from '../../shared/training'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const data = await readValidatedBody(event, body => profileSchema.parse(body))
  await getDatabase().insert(heroProfile).values({ userId, data })
    .onConflictDoUpdate({ target: heroProfile.userId, set: { data } })
  return { profile: data }
})
