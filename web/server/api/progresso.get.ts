import { eq } from 'drizzle-orm'
import { DEFAULT_EQUIPPED_GEAR, calculateGearBonusSummary, getDualProgressionStatus } from '../../../src/utils/rpgLogic'
import { arsenal } from '../db/schema'
import { requireUser } from '../utils/authentication'
import { getDatabase } from '../utils/database'
import { todayInSaoPaulo } from '../utils/quests'
import { readTrainingProgress } from '../utils/training-progress'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const userId = await requireUser(toWebRequest(event).headers)
  const db = getDatabase()
  const today = todayInSaoPaulo()
  const [stats, [gear]] = await Promise.all([
    readTrainingProgress(db, userId, today),
    db.select({ equipped: arsenal.equipped }).from(arsenal).where(eq(arsenal.userId, userId)),
  ])
  const equippedGear = gear?.equipped ?? DEFAULT_EQUIPPED_GEAR
  const dual = getDualProgressionStatus(stats, today)
  return {
    xp: stats.totalXp, currentStreak: stats.currentStreak, equippedGear, coins: stats.goldCoins,
    rank: dual.hunter.current.rank, level: dual.hunter.level, realm: dual.murim.current.name, hp: stats.hunterHp,
    bossDamageBonus: calculateGearBonusSummary(equippedGear).bossDamageBonusPercent,
    dual,
  }
})
