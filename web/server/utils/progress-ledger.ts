import type { ProgressEntryKind } from '../../../src/types/progressLedger'
import { ledger } from '../db/schema'
import type { getDatabase } from './database'

type Database = ReturnType<typeof getDatabase>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export async function recordProgress(
  tx: Transaction,
  userId: string,
  kind: ProgressEntryKind,
  title: string,
  before: { xp: number, coins: number },
  after: { xp: number, coins: number },
) {
  await tx.insert(ledger).values({
    userId, kind, title,
    xpDelta: after.xp - before.xp, coinDelta: after.coins - before.coins,
    totalXp: after.xp, goldCoins: after.coins,
  })
}
