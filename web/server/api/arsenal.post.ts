import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { arsenal, progress } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { getEquipment } from '../utils/equipment'
import { recordProgress } from '../utils/progress-ledger'

const actionSchema = z.object({ id: z.string().min(1).max(120), action: z.enum(['buy', 'equip']) })

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const { id, action } = await readValidatedBody(event, body => actionSchema.parse(body))
  return getDatabase().transaction(async tx => {
    await tx.insert(progress).values({ userId }).onConflictDoNothing()
    const [totals] = await tx.select().from(progress).where(eq(progress.userId, userId)).for('update')
    const { owned, equipped, items } = await getEquipment(tx, userId, totals!.xp, totals!.coins)
    const item = items.find(candidate => candidate.id === id)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Equipamento inexistente' })
    if (action === 'buy' && item.owned) return { id }
    if (action === 'buy' && (!item.unlock.met || totals!.coins < item.priceCoins)) {
      throw createError({ statusCode: 409, statusMessage: 'Requisitos ou moedas insuficientes' })
    }
    if (action === 'equip' && !item.owned) {
      throw createError({ statusCode: 409, statusMessage: 'Equipamento ainda nao adquirido' })
    }
    const data = {
      owned: action === 'buy' ? [...owned, id] : owned,
      equipped: action === 'equip' ? { ...equipped, [item.slot]: id } : equipped,
    }
    await tx.insert(arsenal).values({ userId, ...data }).onConflictDoUpdate({ target: arsenal.userId, set: data })
    if (action === 'buy') {
      const after = { xp: totals!.xp, coins: totals!.coins - item.priceCoins }
      await tx.update(progress).set(after).where(eq(progress.userId, userId))
      await recordProgress(tx, userId, 'armory_purchase', item.name, totals!, after)
    }
    return { id }
  })
})
