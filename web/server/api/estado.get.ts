import { eq } from 'drizzle-orm'
import { arsenal, customWorkout, dailyVow, heroProfile, progress } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { getQuests } from '../utils/quests'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const db = getDatabase()
  const [[hero], [stats], [gear], workouts, vows, missions] = await Promise.all([
    db.select({ profile: heroProfile.data }).from(heroProfile).where(eq(heroProfile.userId, userId)),
    db.select({ xp: progress.xp, coins: progress.coins, hp: progress.hp }).from(progress).where(eq(progress.userId, userId)),
    db.select({ equipped: arsenal.equipped, owned: arsenal.owned, loadouts: arsenal.loadouts }).from(arsenal).where(eq(arsenal.userId, userId)),
    db.select({ data: customWorkout.data }).from(customWorkout).where(eq(customWorkout.userId, userId)),
    db.select({ id: dailyVow.id, title: dailyVow.title, resolvedDay: dailyVow.resolvedDay, outcome: dailyVow.outcome }).from(dailyVow).where(eq(dailyVow.userId, userId)),
    getQuests(db, userId),
  ])
  return { profile: hero?.profile ?? null, stats: stats ?? { xp: 0, coins: 0, hp: 100 }, arsenal: gear ?? null, workouts: workouts.map(row => row.data), vows, missions }
})
