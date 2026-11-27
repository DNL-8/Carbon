import { and, desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { ledger } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'

const pageSize = 20

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(event.headers)
  const { cursor } = await getValidatedQuery(event, query => z.object({
    cursor: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  }).parse(query))
  const rows = await getDatabase().select({
    id: ledger.id, kind: ledger.kind, title: ledger.title, createdAt: ledger.createdAt,
    xpDelta: ledger.xpDelta, coinDelta: ledger.coinDelta, totalXp: ledger.totalXp, goldCoins: ledger.goldCoins,
  }).from(ledger)
    .where(and(eq(ledger.userId, userId), cursor ? lt(ledger.id, cursor) : undefined))
    .orderBy(desc(ledger.id)).limit(pageSize + 1)
  const entries = rows.slice(0, pageSize)
  return { entries, nextCursor: rows.length > pageSize ? entries.at(-1)!.id : null }
})
