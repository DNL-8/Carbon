import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { DEFAULT_EQUIPPED_GEAR, DEFAULT_OWNED_EQUIPMENT_IDS, EQUIPMENT_CATALOG } from '../../../../src/utils/rpgLogic'
import { arsenal, progress } from '../../db/schema'
import { requireUser } from '../../utils/authentication'
import { getDatabase } from '../../utils/database'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), id: z.uuid(), name: z.string().trim().min(1).max(60) }),
  z.object({ action: z.enum(['apply', 'delete']), id: z.uuid() }),
])

export default defineEventHandler(async event => {
  const userId = await requireUser(event.headers)
  const input = await readValidatedBody(event, body => schema.parse(body))
  return getDatabase().transaction(async tx => {
    await tx.insert(progress).values({ userId }).onConflictDoNothing()
    await tx.select({ userId: progress.userId }).from(progress).where(eq(progress.userId, userId)).for('update')
    const [row] = await tx.select().from(arsenal).where(eq(arsenal.userId, userId))
    let equipped = row?.equipped ?? DEFAULT_EQUIPPED_GEAR
    const owned = row?.owned ?? [...DEFAULT_OWNED_EQUIPMENT_IDS]
    let loadouts = row?.loadouts ?? []
    const selected = loadouts.find(loadout => loadout.id === input.id)
    if (input.action === 'save') {
      if (selected) return loadouts
      if (loadouts.length >= 10) throw createError({ statusCode: 409, statusMessage: 'Limite de conjuntos salvos' })
      loadouts = [...loadouts, { id: input.id, name: input.name, gear: equipped }]
    } else if (input.action === 'delete') {
      loadouts = loadouts.filter(loadout => loadout.id !== input.id)
    } else {
      if (!selected) throw createError({ statusCode: 404, statusMessage: 'Conjunto inexistente' })
      const slotsMatch = Object.entries(selected.gear).every(([slot, itemId]) =>
        itemId === null || (owned.includes(itemId) && EQUIPMENT_CATALOG.some(item => item.id === itemId && item.slot === slot)),
      )
      if (!slotsMatch) throw createError({ statusCode: 409, statusMessage: 'Conjunto contem equipamento indisponivel' })
      equipped = selected.gear
    }
    await tx.insert(arsenal).values({ userId, owned, equipped, loadouts })
      .onConflictDoUpdate({ target: arsenal.userId, set: { equipped, loadouts } })
    return loadouts
  })
})
