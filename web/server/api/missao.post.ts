import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { progress, questClaim } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getQuests } from '../utils/quests'
import { getDatabase } from '../utils/database'
import { recordProgress } from '../utils/progress-ledger'

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { id } = await readValidatedBody(event, body => z.object({
    id: z.enum(['workout_today', 'steps_6000', 'weight_today', 'weekly_workouts_3', 'weekly_volume_4000', 'weekly_pr_1']).default('workout_today'),
  }).parse(body))
  return getDatabase().transaction(async tx => {
    await tx.insert(progress).values({ userId }).onConflictDoNothing()
    const [current] = await tx.select().from(progress).where(eq(progress.userId, userId)).for('update')
    const missions = await getQuests(tx, userId)
    const quest = [...missions.daily, ...missions.weekly].find(item => item.id === id)!
    if (quest.claimed) return { claimed: true }
    if (!quest.isFulfilled) throw createError({ statusCode: 409, statusMessage: 'Missao pendente' })
    await tx.insert(questClaim).values({ userId, day: quest.period, questId: id, xp: quest.xpReward, coins: quest.coinsReward })
    const after = { xp: current!.xp + quest.xpReward, coins: current!.coins + quest.coinsReward }
    await tx.update(progress).set(after)
      .where(eq(progress.userId, userId))
    await recordProgress(tx, userId, 'daily_quest', quest.title, current!, after)
    return { claimed: true }
  })
})
