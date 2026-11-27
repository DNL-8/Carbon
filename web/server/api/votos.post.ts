import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { applyHabitPenalty, applyVowCompletion } from '../../../src/utils/rpgLogic'
import { dailyVow, progress } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { todayInSaoPaulo } from '../utils/quests'
import { recordProgress } from '../utils/progress-ledger'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), id: z.uuid(), title: z.string().trim().min(1).max(120) }),
  z.object({ action: z.enum(['complete', 'violate', 'delete']), id: z.uuid() }),
])

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const input = await readValidatedBody(event, body => schema.parse(body))
  return getDatabase().transaction(async tx => {
    await tx.insert(progress).values({ userId }).onConflictDoNothing()
    const [balance] = await tx.select().from(progress).where(eq(progress.userId, userId)).for('update')
    const match = and(eq(dailyVow.userId, userId), eq(dailyVow.id, input.id))
    const [vow] = await tx.select().from(dailyVow).where(match)
    if (input.action === 'create') {
      if (vow) return { id: vow.id }
      const [total] = await tx.select({ value: count() }).from(dailyVow).where(eq(dailyVow.userId, userId))
      if ((total?.value ?? 0) >= 20) throw createError({ statusCode: 409, statusMessage: 'Limite de votos ativos' })
      await tx.insert(dailyVow).values({ userId, id: input.id, title: input.title })
      return { id: input.id }
    }
    if (input.action === 'delete') {
      await tx.delete(dailyVow).where(match)
      return { id: input.id }
    }
    if (!vow) throw createError({ statusCode: 404, statusMessage: 'Voto inexistente' })
    const resolvedDay = todayInSaoPaulo()
    if (vow.resolvedDay === resolvedDay) {
      if (vow.outcome === input.action) return { id: input.id }
      throw createError({ statusCode: 409, statusMessage: 'Voto ja resolvido hoje' })
    }
    const resolveVow = input.action === 'complete' ? applyVowCompletion : applyHabitPenalty
    const { newXp, newHp } = resolveVow(balance!.xp, balance!.hp)
    await tx.update(dailyVow).set({ resolvedDay, outcome: input.action }).where(match)
    await tx.update(progress).set({ xp: newXp, hp: newHp }).where(eq(progress.userId, userId))
    await recordProgress(tx, userId, input.action === 'complete' ? 'vow_completed' : 'vow_broken',
      vow.title, balance!, { xp: newXp, coins: balance!.coins })
    return { id: input.id }
  })
})
