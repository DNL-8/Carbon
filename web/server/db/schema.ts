import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import type { HealthActivityInput, StoredHealthMetric } from '../../shared/health'
import type { ProfileInput } from '../../shared/training'
import type { EquippedGear, GearLoadoutPreset, WorkoutTemplate, WorkoutType } from '../../../src/types/fitness'
import type { ProgressEntryKind } from '../../../src/types/progressLedger'

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const user = pgTable('auth_user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().unique().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text(),
  ...timestamps(),
})

const owner = () => text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
const expiresAt = () => timestamp('expires_at', { withTimezone: true }).notNull()

export const session = pgTable('auth_session', {
  id: text().primaryKey(),
  userId: owner(),
  token: text().unique().notNull(),
  expiresAt: expiresAt(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  ...timestamps(),
})

export const account = pgTable('auth_account', {
  id: text().primaryKey(),
  userId: owner(),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text(),
  password: text(),
  ...timestamps(),
})

export const verification = pgTable('auth_verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: expiresAt(),
  ...timestamps(),
})

export const progress = pgTable('fitness_progress', {
  userId: owner().primaryKey(),
  xp: integer().default(0).notNull(),
  coins: integer().default(0).notNull(),
  hp: integer().default(100).notNull(),
})

export const completion = pgTable('fitness_completion', {
  userId: owner(),
  id: text().notNull(),
  workoutId: text('workout_id').notNull(),
  workoutSnapshot: jsonb('workout_snapshot').$type<{ name: string, exercises: Record<string, string>, type?: WorkoutType, elapsedSeconds?: number }>(),
  bossDefeated: boolean('boss_defeated').default(false).notNull(),
  recordCount: integer('record_count').default(0).notNull(),
  sets: jsonb().$type<{ exerciseId: string, reps: number, weightKg: number }[]>().notNull(),
  xp: integer().notNull(),
  coins: integer().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.id] }),
  index('fitness_completion_owner_recent_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
])

export const exerciseRecord = pgTable('fitness_exercise_record', {
  userId: owner(),
  exerciseId: text('exercise_id').notNull(),
  bestWeightKg: doublePrecision('best_weight_kg').notNull(),
  bestReps: integer('best_reps').notNull(),
  bestVolumeKg: doublePrecision('best_volume_kg').notNull(),
  estimated1RmKg: doublePrecision('estimated_1rm_kg').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.exerciseId] })])

export const healthActivity = pgTable('fitness_health_activity', {
  userId: owner(),
  source: text().notNull(),
  externalId: text('external_id').notNull(),
  data: jsonb().$type<HealthActivityInput>().notNull(),
  xp: integer().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.source, table.externalId] })])

export const healthMetric = pgTable('fitness_health_metric', {
  userId: owner(),
  source: text().notNull(),
  dateKey: text('date_key').notNull(),
  data: jsonb().$type<StoredHealthMetric>().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.source, table.dateKey] })])

export const heroProfile = pgTable('fitness_hero_profile', {
  userId: owner().primaryKey(),
  data: jsonb().$type<ProfileInput>().notNull(),
})

export const customWorkout = pgTable('fitness_custom_workout', {
  userId: owner(),
  id: text().notNull(),
  data: jsonb().$type<WorkoutTemplate>().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] })])

export const arsenal = pgTable('fitness_arsenal', {
  userId: owner().primaryKey(),
  owned: jsonb().$type<string[]>().notNull(),
  equipped: jsonb().$type<EquippedGear>().notNull(),
  loadouts: jsonb().$type<GearLoadoutPreset[]>().default([]).notNull(),
})

export const ledger = pgTable('fitness_progress_ledger', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: owner(),
  kind: text().$type<ProgressEntryKind>().notNull(),
  title: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  xpDelta: integer('xp_delta').notNull(),
  coinDelta: integer('coin_delta').notNull(),
  totalXp: integer('total_xp').notNull(),
  goldCoins: integer('gold_coins').notNull(),
}, table => [index('fitness_ledger_owner_recent_idx').on(table.userId, table.id.desc())])

export const questClaim = pgTable('fitness_quest_claim', {
  userId: owner(),
  day: text().notNull(),
  questId: text('quest_id').default('workout_today').notNull(),
  xp: integer().notNull(),
  coins: integer().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.day, table.questId] })])

export const weightCheckIn = pgTable('fitness_weight_check_in', {
  userId: owner(),
  day: text().notNull(),
  kg: doublePrecision().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.day] })])

export const dailyVow = pgTable('fitness_daily_vow', {
  userId: owner(),
  id: text().notNull(),
  title: text().notNull(),
  resolvedDay: text('resolved_day'),
  outcome: text().$type<'complete' | 'violate'>(),
}, table => [primaryKey({ columns: [table.userId, table.id] })])

export const achievement = pgTable('fitness_achievement', {
  userId: owner(),
  id: text().notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [primaryKey({ columns: [table.userId, table.id] })])
