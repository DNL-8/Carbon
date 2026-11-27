import type { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { AppAuthUser } from '../types/auth';
import type {
  AchievementId,
  AnyAutoQuestId,
  ChatMessage,
  DailyHealthMetric,
  DailyVow,
  EquipmentSlot,
  EquippedGear,
  ExerciseItem,
  ExercisePrRecord,
  GameStats,
  GearLoadoutPreset,
  HealthActivity,
  HealthSource,
  HeroClass,
  HeroExperience,
  HeroObjective,
  HeroProfile,
  PerformedExerciseRecord,
  PerformedSetEntry,
  SessionRewardSummary,
  UserAchievement,
  WeightLog,
  WorkoutLog,
  WorkoutTemplate,
  WorkoutType,
} from '../types/fitness';
import type { ProgressEntryKind, ProgressLedgerEntry, ProgressLedgerPage } from '../types/progressLedger';
import type { WorkspaceSnapshot } from '../types/workspace';
import { projectHealthConnect } from '../utils/healthConnect';
import {
  ACHIEVEMENT_DEFINITIONS,
  ARSENAL_CONFIG,
  BASE_HUNTER_RANK,
  EQUIPMENT_CATALOG,
  EXAMPLE_LOADOUT_PRESETS,
  INITIAL_WORKOUTS,
  MAX_BOSSES_DEFEATED,
  MAX_CLAIMED_AUTO_QUEST_KEYS,
  MAX_GOLD_COINS,
  MAX_HR_SAMPLE_POINTS,
  MAX_HUNTER_HP,
  MAX_OWNED_EQUIPMENT_IDS,
  MAX_TOTAL_COINS_EARNED,
  MAX_TOTAL_XP,
  applyHabitPenalty,
  applyVowCompletion,
  buildZoneTotals,
  calculateActivityXp,
  calculateCoinsForWorkout,
  calculateDerivedAttributes,
  calculateGearBonusSummary,
  calculateLevel,
  calculateNextStreak,
  calculateProportionalXp,
  calculateSessionPrBonus,
  computeBmiSummary,
  computeRecoveryAssessment,
  createInitialGameStats,
  evaluateAchievements,
  evaluateDailyAutoQuests,
  evaluateExercisePrUpdate,
  evaluateWeeklyAutoQuests,
  getBossForWorkout,
  getDualProgressionStatus,
  getLevelProgress,
  getLocalDateKey,
  getWeeklyRaidBossState,
  isEquipmentMilestoneUnlocked,
  isValidHunterRank,
  isVowResolvedToday,
  isWeeklyAutoQuestId,
  mapSportToWorkoutType,
  mergeWithInitialWorkouts,
  migrateEquipmentId,
  migrateEquippedGear,
  normalizeGameStats,
} from '../utils/rpgLogic';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const VALID_WORKOUT_TYPES: ReadonlyArray<WorkoutType> = [
  'cardio',
  'forca',
  'hiit',
  'core',
  'mobilidade',
  'corpo_inteiro',
];
const VALID_DIFFICULTIES: ReadonlyArray<HeroExperience> = [
  'Iniciante',
  'Intermediário',
  'Avançado',
];
const VALID_HERO_CLASSES: ReadonlyArray<HeroClass> = ['Guerreiro', 'Arqueiro', 'Mago'];
const VALID_HERO_OBJECTIVES: ReadonlyArray<HeroObjective> = [
  'Emagrecer',
  'Condicionamento',
  'Ambos',
];
const VALID_HEALTH_SOURCES: ReadonlyArray<HealthSource> = [
  'strava',
  'apple_health',
  'samsung_health',
  'gpx',
  'csv',
  'health_connect',
];

const STARTER_VOWS = [
  'Beber pelo menos 2L de água hoje',
  'Evitar açúcar refinado e ultraprocessados',
  'Dormir 7h+ e respeitar o horário de descanso',
];

export class WorkspaceValidationError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'WorkspaceValidationError';
    this.status = status;
    this.code = code;
  }
}

export function tsToIso(value: unknown, fallback: string = new Date().toISOString()): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}

function isFirestorePermissionOrRuleError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  return (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code === 'failed-precondition' ||
    code.startsWith('firestore/')
  );
}

function assertAuthenticatedVerifiedUid(user?: AppAuthUser | null): string {
  const current = auth.currentUser;
  const uid = user?.uid || current?.uid;
  if (!uid || !current || current.uid !== uid) {
    throw new WorkspaceValidationError(
      401,
      'Usuário não autenticado. Faça login novamente para continuar.',
      'unauthenticated'
    );
  }
  if (!current.emailVerified && user?.emailVerified !== true) {
    throw new WorkspaceValidationError(
      403,
      'Verifique seu e-mail antes de acessar ou modificar os dados.',
      'email_not_verified'
    );
  }
  return uid;
}

function assertValidId(value: unknown, fieldName: string = 'id'): string {
  if (typeof value !== 'string' || !VALID_ID_REGEX.test(value.trim())) {
    throw new WorkspaceValidationError(
      400,
      `Campo "${fieldName}" inválido. Use apenas letras, números, "_" ou "-" (1 a 128 caracteres).`,
      'invalid_id'
    );
  }
  return value.trim();
}

function assertValidDateKey(value: unknown, fallbackToday: boolean = true): string {
  if ((value === undefined || value === null || value === '') && fallbackToday) {
    return getLocalDateKey();
  }
  const dateKey = typeof value === 'string' ? value.trim() : '';
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (
    !VALID_DATE_KEY_REGEX.test(dateKey) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateKey
  ) {
    throw new WorkspaceValidationError(
      400,
      'Formato de data inválido. Utilize YYYY-MM-DD.',
      'invalid_date_key'
    );
  }
  return dateKey;
}

function resolveProviderTag(firebaseUser: FirebaseUser): 'google' | 'password' {
  const hasGoogle = firebaseUser.providerData.some((p) => p.providerId === 'google.com');
  return hasGoogle ? 'google' : 'password';
}

export async function ensureUserDocument(firebaseUser: FirebaseUser | null = auth.currentUser): Promise<void> {
  if (!firebaseUser || !firebaseUser.emailVerified) return;
  const uid = firebaseUser.uid;
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const provider = resolveProviderTag(firebaseUser);
  const displayName = (
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'Caçador'
  ).slice(0, 100);
  const email = firebaseUser.email ? firebaseUser.email.slice(0, 254) : null;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        userId: uid,
        email,
        displayName,
        provider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const existing = snap.data();
    if (
      existing.email !== email ||
      existing.displayName !== displayName ||
      existing.provider !== provider
    ) {
      await updateDoc(userRef, {
        email,
        displayName,
        provider,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function mapHeroProfileDoc(data: DocumentData, uid: string): HeroProfile {
  return {
    userId: typeof data.userId === 'string' ? data.userId : uid,
    name: String(data.name ?? 'Caçador'),
    avatar: String(data.avatar ?? '⚔️'),
    heroClass: (data.heroClass ?? 'Guerreiro') as HeroClass,
    objective: (data.objective ?? 'Condicionamento') as HeroObjective,
    experience: (data.experience ?? 'Iniciante') as HeroExperience,
    heightCm: typeof data.heightCm === 'number' ? data.heightCm : null,
    weightKg: typeof data.weightKg === 'number' ? data.weightKg : null,
    restingHrBaseline:
      typeof data.restingHrBaseline === 'number' ? data.restingHrBaseline : undefined,
    maxHrEstimated: typeof data.maxHrEstimated === 'number' ? data.maxHrEstimated : undefined,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export function mapGameStatsDoc(data: DocumentData, uid: string) {
  return normalizeGameStats({
    ...(data as GameStats),
    userId: typeof data.userId === 'string' ? data.userId : uid,
    updatedAt: tsToIso(data.updatedAt),
  });
}

export function mapWorkoutTemplateDoc(data: DocumentData, id: string, uid: string): WorkoutTemplate {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: (data.type ?? 'forca') as WorkoutType,
    difficulty: (data.difficulty ?? 'Iniciante') as HeroExperience,
    durationMinutes: Number(data.durationMinutes ?? 30),
    baseXp: Number(data.baseXp ?? 100),
    rank: (data.rank ?? 'F') as WorkoutTemplate['rank'],
    exercises: Array.isArray(data.exercises) ? (data.exercises as ExerciseItem[]) : [],
  };
}

export function mapWorkoutLogDoc(data: DocumentData, id: string, uid: string): WorkoutLog {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    workoutId: String(data.workoutId ?? ''),
    workoutName: String(data.workoutName ?? ''),
    workoutType: (data.workoutType ?? 'forca') as WorkoutType,
    difficulty: (data.difficulty ?? 'Iniciante') as HeroExperience,
    completedExercises: Number(data.completedExercises ?? 0),
    totalExercises: Number(data.totalExercises ?? 1),
    durationMinutes: Number(data.durationMinutes ?? 0),
    xpEarned: Number(data.xpEarned ?? 0),
    bonusXpEarned: Number(data.bonusXpEarned ?? 0),
    ...(Array.isArray(data.performedExercises)
      ? { performedExercises: data.performedExercises as PerformedExerciseRecord[] }
      : {}),
    ...(typeof data.totalVolumeKg === 'number' ? { totalVolumeKg: data.totalVolumeKg } : {}),
    ...(typeof data.prCount === 'number' ? { prCount: data.prCount } : {}),
    dateKey: String(data.dateKey ?? getLocalDateKey()),
    completedAt: tsToIso(data.completedAt),
  };
}

export function mapExercisePrDoc(data: DocumentData, id: string, uid: string): ExercisePrRecord {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    exerciseId: String(data.exerciseId ?? id),
    exerciseName: String(data.exerciseName ?? id),
    bestWeightKg: Number(data.bestWeightKg ?? 0),
    bestReps: Number(data.bestReps ?? 1),
    bestVolumeKg: Number(data.bestVolumeKg ?? 0),
    estimated1RmKg: Number(data.estimated1RmKg ?? 0),
    updatedAt: tsToIso(data.updatedAt),
    workoutLogId: String(data.workoutLogId ?? ''),
    dateKey: String(data.dateKey ?? getLocalDateKey()),
  };
}

export function mapDailyVowDoc(data: DocumentData, id: string, uid: string): DailyVow {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    title: String(data.title ?? ''),
    xpReward: Number(data.xpReward ?? 15),
    penaltyXp: Number(data.penaltyXp ?? 15),
    completedDateKey: typeof data.completedDateKey === 'string' ? data.completedDateKey : null,
    violatedDateKey: typeof data.violatedDateKey === 'string' ? data.violatedDateKey : null,
    createdAt: tsToIso(data.createdAt),
  };
}

export function mapHealthActivityDoc(data: DocumentData, id: string, uid: string): HealthActivity {
  const zones = Array.isArray(data.zoneMinutes) && data.zoneMinutes.length === 5
    ? ([
        Number(data.zoneMinutes[0]) || 0,
        Number(data.zoneMinutes[1]) || 0,
        Number(data.zoneMinutes[2]) || 0,
        Number(data.zoneMinutes[3]) || 0,
        Number(data.zoneMinutes[4]) || 0,
      ] as [number, number, number, number, number])
    : ([0, 0, 0, 0, 0] as [number, number, number, number, number]);

  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    externalId: String(data.externalId ?? id),
    source: (data.source ?? 'strava') as HealthSource,
    title: String(data.title ?? ''),
    sportType: String(data.sportType ?? 'Run'),
    dateKey: String(data.dateKey ?? getLocalDateKey()),
    startedAt: tsToIso(data.startedAt),
    durationMinutes: Number(data.durationMinutes ?? 0),
    distanceKm: Number(data.distanceKm ?? 0),
    calories: Number(data.calories ?? 0),
    elevationGainM: Number(data.elevationGainM ?? 0),
    avgHeartRate: typeof data.avgHeartRate === 'number' ? data.avgHeartRate : null,
    maxHeartRate: typeof data.maxHeartRate === 'number' ? data.maxHeartRate : null,
    zoneMinutes: zones,
    hrSamplePoints: Array.isArray(data.hrSamplePoints) ? data.hrSamplePoints.map(Number) : [],
    xpAwarded: Number(data.xpAwarded ?? 0),
    createdAt: tsToIso(data.createdAt),
  };
}

export function mapDailyHealthMetricDoc(
  data: DocumentData,
  id: string,
  uid: string
): DailyHealthMetric {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    dateKey: String(data.dateKey ?? id),
    steps: Number(data.steps ?? 0),
    activeCalories: Number(data.activeCalories ?? 0),
    sleepHours: Number(data.sleepHours ?? 0),
    restingHeartRate: typeof data.restingHeartRate === 'number' ? data.restingHeartRate : null,
    hrvMs: typeof data.hrvMs === 'number' ? data.hrvMs : null,
    trainingLoadScore: Number(data.trainingLoadScore ?? 0),
    recoveryScore: Number(data.recoveryScore ?? 50),
    sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
    updatedAt: tsToIso(data.updatedAt),
  };
}

export function mapWeightLogDoc(data: DocumentData, id: string, uid: string): WeightLog {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    weightKg: Number(data.weightKg ?? 0),
    dateKey: String(data.dateKey ?? id),
    note: typeof data.note === 'string' ? data.note : null,
    recordedAt: tsToIso(data.recordedAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export function mapAchievementDoc(data: DocumentData, id: string, uid: string): UserAchievement {
  return {
    id: (typeof data.id === 'string' ? data.id : id) as AchievementId,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    unlocked: Boolean(data.unlocked),
    unlockedAt: typeof data.unlockedAt === 'string' ? data.unlockedAt : null,
  };
}

export function mapChatMessageDoc(data: DocumentData, id: string, uid: string): ChatMessage {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    role: data.role === 'oracle' ? 'oracle' : 'user',
    content: String(data.content ?? ''),
    createdAt: tsToIso(data.createdAt),
  };
}

export function mapProgressLedgerDoc(
  data: DocumentData,
  id: string,
  uid: string
): ProgressLedgerEntry {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    userId: typeof data.userId === 'string' ? data.userId : uid,
    kind: (data.kind ?? 'adjustment') as ProgressEntryKind,
    title: String(data.title ?? ''),
    createdAt: tsToIso(data.createdAt),
    xpDelta: Number(data.xpDelta ?? 0),
    coinDelta: Number(data.coinDelta ?? 0),
    totalXp: Number(data.totalXp ?? 0),
    goldCoins: Number(data.goldCoins ?? 0),
  };
}

function buildGameStatsPayload(stats: GameStats, uid: string) {
  const normalized = normalizeGameStats({ ...stats, userId: uid });
  const cleanEquipped: EquippedGear = {
    elmo: normalized.equippedGear.elmo ?? null,
    armadura: normalized.equippedGear.armadura ?? null,
    capa: normalized.equippedGear.capa ?? null,
    arma: normalized.equippedGear.arma ?? null,
  };
  const cleanLoadouts: GearLoadoutPreset[] = normalized.gearLoadouts
    .slice(0, ARSENAL_CONFIG.maxPresets)
    .map((p, idx) => ({
      id: VALID_ID_REGEX.test(p.id) ? p.id : `preset_${idx + 1}`,
      name: String(p.name || `Loadout ${idx + 1}`).trim().slice(0, 28) || `Loadout ${idx + 1}`,
      gear: {
        elmo: p.gear.elmo ?? null,
        armadura: p.gear.armadura ?? null,
        capa: p.gear.capa ?? null,
        arma: p.gear.arma ?? null,
      },
    }));

  return {
    userId: uid,
    totalXp: Math.min(MAX_TOTAL_XP, Math.max(0, Math.round(normalized.totalXp))),
    level: Math.min(50, Math.max(1, calculateLevel(normalized.totalXp))),
    hunterHp: Math.min(MAX_HUNTER_HP, Math.max(0, Math.round(normalized.hunterHp ?? MAX_HUNTER_HP))),
    goldCoins: Math.min(MAX_GOLD_COINS, Math.max(0, Math.round(normalized.goldCoins))),
    totalCoinsEarned: Math.min(MAX_TOTAL_COINS_EARNED, Math.max(0, Math.round(normalized.totalCoinsEarned))),
    bossesDefeated: Math.min(MAX_BOSSES_DEFEATED, Math.max(0, Math.round(normalized.bossesDefeated))),
    ownedEquipmentIds: normalized.ownedEquipmentIds.slice(0, MAX_OWNED_EQUIPMENT_IDS),
    equippedGear: cleanEquipped,
    gearLoadouts: cleanLoadouts,
    claimedAutoQuestKeys: normalized.claimedAutoQuestKeys.slice(-MAX_CLAIMED_AUTO_QUEST_KEYS),
    currentStreak: Math.min(5000, Math.max(0, Math.round(normalized.currentStreak))),
    longestStreak: Math.min(5000, Math.max(0, Math.round(normalized.longestStreak))),
    lastWorkoutDate: normalized.lastWorkoutDate ?? null,
    totalWorkouts: Math.max(0, Math.round(normalized.totalWorkouts)),
    totalMinutes: Math.max(0, Math.round(normalized.totalMinutes)),
    cardioWorkouts: Math.max(0, Math.round(normalized.cardioWorkouts)),
    forcaWorkouts: Math.max(0, Math.round(normalized.forcaWorkouts)),
    hiitWorkouts: Math.max(0, Math.round(normalized.hiitWorkouts)),
    coreWorkouts: Math.max(0, Math.round(normalized.coreWorkouts)),
    mobilidadeWorkouts: Math.max(0, Math.round(normalized.mobilidadeWorkouts)),
    corpoInteiroWorkouts: Math.max(0, Math.round(normalized.corpoInteiroWorkouts)),
    updatedAt: serverTimestamp(),
  };
}

function buildLedgerEntryData(
  uid: string,
  prev: GameStats,
  next: GameStats,
  kind: ProgressEntryKind,
  title: string
) {
  const id = `led-${crypto.randomUUID()}`;
  return {
    id,
    data: {
      id,
      userId: uid,
      kind,
      title: (title.trim() || 'Atualização').slice(0, 140),
      createdAt: serverTimestamp(),
      xpDelta: Math.round(next.totalXp - prev.totalXp),
      coinDelta: Math.round((next.goldCoins ?? 0) - (prev.goldCoins ?? 0)),
      totalXp: Math.round(next.totalXp),
      goldCoins: Math.round(next.goldCoins ?? 0),
    },
  };
}

async function queryUserSubcollection<T>(
  uid: string,
  colName: string,
  mapper: (data: DocumentData, id: string, uid: string) => T,
  maxDocs = 400
): Promise<T[]> {
  const path = `users/${uid}/${colName}`;
  try {
    const q = query(collection(db, 'users', uid, colName), where('userId', '==', uid), limit(maxDocs));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapper(d.data(), d.id, uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function getWorkspaceSnapshotFs(user?: AppAuthUser | null): Promise<WorkspaceSnapshot> {
  const uid = assertAuthenticatedVerifiedUid(user);
  const heroPath = `users/${uid}/heroProfiles/main`;
  const statsPath = `users/${uid}/gameStats/main`;

  let heroSnap;
  let statsSnap;
  try {
    [heroSnap, statsSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'heroProfiles', 'main')),
      getDoc(doc(db, 'users', uid, 'gameStats', 'main')),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, heroPath);
  }

  const [
    workouts,
    healthActivities,
    dailyHealthMetrics,
    achievements,
    chatMessages,
    dailyVows,
    weightLogs,
    exercisePrs,
  ] = await Promise.all([
    queryUserSubcollection(uid, 'workouts', mapWorkoutTemplateDoc, 120),
    queryUserSubcollection(uid, 'healthActivities', mapHealthActivityDoc, 400),
    queryUserSubcollection(uid, 'dailyHealthMetrics', mapDailyHealthMetricDoc, 250),
    queryUserSubcollection(uid, 'achievements', mapAchievementDoc, 50),
    queryUserSubcollection(uid, 'chatMessages', mapChatMessageDoc, 150),
    queryUserSubcollection(uid, 'dailyVows', mapDailyVowDoc, 100),
    queryUserSubcollection(uid, 'weightLogs', mapWeightLogDoc, 400),
    queryUserSubcollection(uid, 'exercisePrs', mapExercisePrDoc, 200),
  ]);

  return {
    hero: heroSnap.exists() ? mapHeroProfileDoc(heroSnap.data(), uid) : null,
    stats: statsSnap.exists() ? mapGameStatsDoc(statsSnap.data(), uid) : null,
    workouts,
    healthActivities,
    dailyHealthMetrics,
    achievements,
    chatMessages,
    dailyVows,
    weightLogs,
    exercisePrs,
  };
}

export async function getFullSystemStateFs(user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  const [snapshot, workoutLogs] = await Promise.all([
    getWorkspaceSnapshotFs(user),
    queryUserSubcollection(uid, 'workoutLogs', mapWorkoutLogDoc, 400),
  ]);

  const rawStats = snapshot.stats ?? createInitialGameStats(uid);
  const normalizedStats = normalizeGameStats(rawStats);
  const todayKey = getLocalDateKey();
  const { metrics: dailyMetrics, activities: healthActivities } = projectHealthConnect(
    [],
    snapshot.healthActivities,
    snapshot.dailyHealthMetrics,
    uid,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  );

  const gearBonuses = calculateGearBonusSummary(normalizedStats.equippedGear);
  const levelProgress = getLevelProgress(normalizedStats.totalXp);
  const todayMetric = dailyMetrics.find((m) => m.dateKey === todayKey) ?? null;
  const autoQuests = evaluateDailyAutoQuests(
    todayKey,
    todayMetric,
    workoutLogs,
    healthActivities,
    snapshot.weightLogs,
    normalizedStats.claimedAutoQuestKeys
  );
  const weeklyAutoQuests = evaluateWeeklyAutoQuests(
    todayKey,
    workoutLogs,
    healthActivities,
    normalizedStats.claimedAutoQuestKeys
  );
  const weeklyRaidBoss = getWeeklyRaidBossState(todayKey, workoutLogs, healthActivities);
  const derivedAttributes = snapshot.hero
    ? calculateDerivedAttributes(normalizedStats, snapshot.hero.heroClass)
    : null;
  const recovery = computeRecoveryAssessment(
    workoutLogs,
    healthActivities,
    dailyMetrics,
    normalizedStats,
    snapshot.hero?.restingHrBaseline ?? 60,
    todayKey
  );

  const mergedWorkouts = mergeWithInitialWorkouts(snapshot.workouts, uid);
  const sortedVows = [...snapshot.dailyVows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sortedWeightLogs = [...snapshot.weightLogs].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const sortedLogs = [...workoutLogs].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const dualProgression = getDualProgressionStatus(normalizedStats, todayKey);

  return {
    uid,
    todayKey,
    hero: snapshot.hero,
    stats: normalizedStats,
    levelProgress,
    dualProgression,
    gearBonuses,
    derivedAttributes,
    recovery,
    autoQuests,
    weeklyAutoQuests,
    weeklyRaidBoss,
    workoutsCount: mergedWorkouts.length,
    workouts: mergedWorkouts,
    workoutLogs: sortedLogs,
    exercisePrs: snapshot.exercisePrs,
    dailyVows: sortedVows,
    weightLogs: sortedWeightLogs,
    dailyMetrics,
    healthActivities,
    achievements: snapshot.achievements,
    healthConnectStatus: 'available' as const,
  };
}

export async function createWorkspaceHeroFs(
  heroInput: HeroProfile,
  user?: AppAuthUser | null
): Promise<{ hero: HeroProfile }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);

  const name = heroInput.name.trim().slice(0, 24);
  if (name.length < 2) {
    throw new WorkspaceValidationError(400, 'O nome do herói deve ter pelo menos 2 caracteres.', 'invalid_hero_name');
  }
  const avatar = (heroInput.avatar || '⚔️').trim().slice(0, 16) || '⚔️';
  const heroPath = `users/${uid}/heroProfiles/main`;
  const statsPath = `users/${uid}/gameStats/main`;

  try {
    const batch = writeBatch(db);
    const existingStats = await getDoc(doc(db, 'users', uid, 'gameStats', 'main'));

    const heroDocData: Record<string, unknown> = {
      userId: uid,
      name,
      avatar,
      heroClass: heroInput.heroClass,
      objective: heroInput.objective,
      experience: heroInput.experience,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (heroInput.heightCm !== undefined && heroInput.heightCm !== null) {
      heroDocData.heightCm = Math.round(heroInput.heightCm);
    }
    if (heroInput.weightKg !== undefined && heroInput.weightKg !== null) {
      heroDocData.weightKg = Math.round(heroInput.weightKg * 10) / 10;
    }
    if (heroInput.restingHrBaseline !== undefined) {
      heroDocData.restingHrBaseline = Math.round(heroInput.restingHrBaseline);
    }
    if (heroInput.maxHrEstimated !== undefined) {
      heroDocData.maxHrEstimated = Math.round(heroInput.maxHrEstimated);
    }

    batch.set(doc(db, 'users', uid, 'heroProfiles', 'main'), heroDocData);

    if (!existingStats.exists()) {
      batch.set(
        doc(db, 'users', uid, 'gameStats', 'main'),
        buildGameStatsPayload(createInitialGameStats(uid), uid)
      );
    }

    for (const workout of INITIAL_WORKOUTS) {
      batch.set(doc(db, 'users', uid, 'workouts', workout.id), {
        id: workout.id,
        userId: uid,
        name: workout.name,
        description: workout.description,
        type: workout.type,
        difficulty: workout.difficulty,
        durationMinutes: Math.round(workout.durationMinutes),
        baseXp: Math.round(workout.baseXp),
        rank: workout.rank,
        exercises: workout.exercises,
        updatedAt: serverTimestamp(),
      });
    }

    for (const { id } of ACHIEVEMENT_DEFINITIONS) {
      batch.set(doc(db, 'users', uid, 'achievements', id), {
        id,
        userId: uid,
        unlocked: false,
        unlockedAt: null,
        updatedAt: serverTimestamp(),
      });
    }

    STARTER_VOWS.forEach((title, idx) => {
      const id = `vow-starter-${idx + 1}`;
      batch.set(doc(db, 'users', uid, 'dailyVows', id), {
        id,
        userId: uid,
        title,
        xpReward: 15,
        penaltyXp: 15,
        completedDateKey: null,
        violatedDateKey: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();

    const createdHeroSnap = await getDoc(doc(db, 'users', uid, 'heroProfiles', 'main'));
    if (createdHeroSnap.exists()) {
      return { hero: mapHeroProfileDoc(createdHeroSnap.data(), uid) };
    }
    const nowIso = new Date().toISOString();
    return {
      hero: {
        ...heroInput,
        userId: uid,
        name,
        avatar,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    };
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, `${heroPath} | ${statsPath}`);
  }
}

export async function updateHeroProfileFs(
  patch: Partial<{
    name: string;
    avatar: string;
    heroClass: HeroClass;
    objective: HeroObjective;
    experience: HeroExperience;
    heightCm: number | null;
    weightKg: number | null;
    restingHrBaseline: number;
    maxHrEstimated: number;
  }>,
  user?: AppAuthUser | null
): Promise<{ hero: HeroProfile; bmi: { bmi: number; label: string } | null }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const path = `users/${uid}/heroProfiles/main`;
  const heroRef = doc(db, 'users', uid, 'heroProfiles', 'main');

  try {
    const updatedHero = await runTransaction(db, async (tx) => {
      const snap = await tx.get(heroRef);
      if (!snap.exists()) {
        throw new WorkspaceValidationError(404, 'Perfil do herói não encontrado.', 'hero_not_found');
      }
      const existing = mapHeroProfileDoc(snap.data(), uid);
      const nextName = typeof patch.name === 'string' ? patch.name.trim() : existing.name;
      if (nextName.length < 2 || nextName.length > 24) {
        throw new WorkspaceValidationError(
          400,
          'O nome do herói deve ter entre 2 e 24 caracteres.',
          'invalid_hero_name'
        );
      }
      const nextAvatar =
        typeof patch.avatar === 'string' && patch.avatar.trim()
          ? patch.avatar.trim().slice(0, 16)
          : existing.avatar;
      const nextClass = (patch.heroClass ?? existing.heroClass) as HeroClass;
      if (!VALID_HERO_CLASSES.includes(nextClass)) {
        throw new WorkspaceValidationError(400, 'Classe de herói inválida.', 'invalid_hero_class');
      }
      const nextObjective = (patch.objective ?? existing.objective) as HeroObjective;
      if (!VALID_HERO_OBJECTIVES.includes(nextObjective)) {
        throw new WorkspaceValidationError(400, 'Objetivo inválido.', 'invalid_hero_objective');
      }
      const nextExperience = (patch.experience ?? existing.experience) as HeroExperience;
      if (!VALID_DIFFICULTIES.includes(nextExperience)) {
        throw new WorkspaceValidationError(400, 'Experiência inválida.', 'invalid_hero_experience');
      }

      const updateFields: Record<string, unknown> = {
        name: nextName,
        avatar: nextAvatar,
        heroClass: nextClass,
        objective: nextObjective,
        experience: nextExperience,
        updatedAt: serverTimestamp(),
      };

      let nextHeight = existing.heightCm ?? null;
      if (patch.heightCm !== undefined) {
        if (patch.heightCm === null) {
          nextHeight = null;
        } else {
          const h = Number(patch.heightCm);
          if (!Number.isFinite(h) || h < 100 || h > 250) {
            throw new WorkspaceValidationError(400, 'heightCm deve estar entre 100 e 250 cm.', 'invalid_height');
          }
          nextHeight = Math.round(h);
        }
        updateFields.heightCm = nextHeight;
      }

      let nextWeight = existing.weightKg ?? null;
      if (patch.weightKg !== undefined) {
        if (patch.weightKg === null) {
          nextWeight = null;
        } else {
          const w = Number(patch.weightKg);
          if (!Number.isFinite(w) || w < 25 || w > 350) {
            throw new WorkspaceValidationError(400, 'weightKg deve estar entre 25 e 350 kg.', 'invalid_weight');
          }
          nextWeight = Math.round(w * 10) / 10;
        }
        updateFields.weightKg = nextWeight;
      }

      let nextResting = existing.restingHrBaseline;
      if (patch.restingHrBaseline !== undefined) {
        const r = Number(patch.restingHrBaseline);
        if (!Number.isFinite(r) || r < 30 || r > 120) {
          throw new WorkspaceValidationError(400, 'restingHrBaseline deve estar entre 30 e 120 bpm.', 'invalid_rhr');
        }
        nextResting = Math.round(r);
        updateFields.restingHrBaseline = nextResting;
      }

      let nextMaxHr = existing.maxHrEstimated;
      if (patch.maxHrEstimated !== undefined) {
        const m = Number(patch.maxHrEstimated);
        if (!Number.isFinite(m) || m < 120 || m > 230) {
          throw new WorkspaceValidationError(400, 'maxHrEstimated deve estar entre 120 e 230 bpm.', 'invalid_max_hr');
        }
        nextMaxHr = Math.round(m);
        updateFields.maxHrEstimated = nextMaxHr;
      }

      tx.update(heroRef, updateFields);

      return {
        ...existing,
        name: nextName,
        avatar: nextAvatar,
        heroClass: nextClass,
        objective: nextObjective,
        experience: nextExperience,
        heightCm: nextHeight,
        weightKg: nextWeight,
        restingHrBaseline: nextResting,
        maxHrEstimated: nextMaxHr,
        updatedAt: new Date().toISOString(),
      } satisfies HeroProfile;
    });

    return {
      hero: updatedHero,
      bmi: computeBmiSummary(updatedHero.heightCm, updatedHero.weightKg),
    };
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveChatMessageFs(
  role: 'user' | 'oracle',
  content: string,
  user?: AppAuthUser | null
): Promise<{ record: ChatMessage }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanContent = content.trim().slice(0, 4000);
  if (!cleanContent) {
    throw new WorkspaceValidationError(400, 'A mensagem não pode estar vazia.', 'empty_chat_message');
  }
  const id = `msg-${crypto.randomUUID()}-${role}`;
  const path = `users/${uid}/chatMessages/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'chatMessages', id), {
      id,
      userId: uid,
      role,
      content: cleanContent,
      createdAt: serverTimestamp(),
    });
    return {
      record: {
        id,
        userId: uid,
        role,
        content: cleanContent,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function resetWorkspaceProgressFs(user?: AppAuthUser | null): Promise<{ reset: boolean }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const collectionsToClear = [
    'workoutLogs',
    'exercisePrs',
    'healthActivities',
    'dailyHealthMetrics',
    'weightLogs',
    'chatMessages',
    'progressLedger',
  ];

  try {
    const deleteRefs = [];
    for (const colName of collectionsToClear) {
      const snap = await getDocs(query(collection(db, 'users', uid, colName), where('userId', '==', uid)));
      for (const d of snap.docs) {
        deleteRefs.push(d.ref);
      }
    }

    const vowsSnap = await getDocs(
      query(collection(db, 'users', uid, 'dailyVows'), where('userId', '==', uid))
    );

    const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
    ops.push((batch) =>
      batch.set(
        doc(db, 'users', uid, 'gameStats', 'main'),
        buildGameStatsPayload(createInitialGameStats(uid), uid)
      )
    );
    for (const { id } of ACHIEVEMENT_DEFINITIONS) {
      ops.push((batch) =>
        batch.set(doc(db, 'users', uid, 'achievements', id), {
          id,
          userId: uid,
          unlocked: false,
          unlockedAt: null,
          updatedAt: serverTimestamp(),
        })
      );
    }
    for (const vowDoc of vowsSnap.docs) {
      ops.push((batch) =>
        batch.update(vowDoc.ref, {
          completedDateKey: null,
          violatedDateKey: null,
          updatedAt: serverTimestamp(),
        })
      );
    }
    for (const ref of deleteRefs) {
      ops.push((batch) => batch.delete(ref));
    }

    const CHUNK = 400;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const fn of ops.slice(i, i + CHUNK)) {
        fn(batch);
      }
      await batch.commit();
    }

    return { reset: true };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/resetProgress`);
  }
}

function sanitizeWorkoutTemplateForWrite(
  raw: Record<string, unknown>,
  uid: string,
  forcedId?: string
): WorkoutTemplate {
  const id = forcedId
    ? assertValidId(forcedId, 'id')
    : typeof raw.id === 'string' && raw.id.trim()
      ? assertValidId(raw.id, 'id')
      : `w-custom-${crypto.randomUUID()}`;

  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : '';
  if (name.length < 2) {
    throw new WorkspaceValidationError(
      400,
      'O nome do treino precisa ter pelo menos 2 caracteres.',
      'invalid_name'
    );
  }

  const description =
    typeof raw.description === 'string'
      ? raw.description.trim().slice(0, 500)
      : 'Treino personalizado.';

  const type = raw.type as WorkoutType;
  if (!VALID_WORKOUT_TYPES.includes(type)) {
    throw new WorkspaceValidationError(400, 'Tipo de treino inválido.', 'invalid_workout_type');
  }

  const difficulty = (raw.difficulty ?? 'Intermediário') as HeroExperience;
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    throw new WorkspaceValidationError(400, 'Dificuldade inválida.', 'invalid_difficulty');
  }

  const rawRank = raw.rank ?? BASE_HUNTER_RANK;
  if (!isValidHunterRank(rawRank)) {
    throw new WorkspaceValidationError(400, 'Rank inválido.', 'invalid_rank');
  }

  const durationMinutes = Number(raw.durationMinutes ?? 30);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
    throw new WorkspaceValidationError(400, 'durationMinutes deve estar entre 1 e 600.', 'invalid_duration');
  }

  const baseXp = Number(raw.baseXp ?? 150);
  if (!Number.isFinite(baseXp) || baseXp < 10 || baseXp > 5000) {
    throw new WorkspaceValidationError(400, 'baseXp deve estar entre 10 e 5000.', 'invalid_base_xp');
  }

  if (!Array.isArray(raw.exercises) || raw.exercises.length < 1 || raw.exercises.length > 20) {
    throw new WorkspaceValidationError(
      400,
      'O treino precisa conter entre 1 e 20 exercícios.',
      'invalid_exercises'
    );
  }

  const exercises: ExerciseItem[] = raw.exercises.map((item, idx) => {
    const ex = (item ?? {}) as Record<string, unknown>;
    const exId =
      typeof ex.id === 'string' && ex.id.trim()
        ? ex.id.trim().slice(0, 64)
        : `ex-${crypto.randomUUID().slice(0, 12)}-${idx + 1}`;
    const exName = typeof ex.name === 'string' ? ex.name.trim().slice(0, 120) : '';
    if (!exName) {
      throw new WorkspaceValidationError(
        400,
        `Nome do exercício ${idx + 1} é obrigatório.`,
        'invalid_exercise_name'
      );
    }
    const cleanEx: ExerciseItem = {
      id: exId,
      name: exName,
      prescription:
        typeof ex.prescription === 'string' && ex.prescription.trim()
          ? ex.prescription.trim().slice(0, 100)
          : '3 séries x 12 repetições',
      restSeconds: Number.isFinite(Number(ex.restSeconds))
        ? Math.min(300, Math.max(10, Math.round(Number(ex.restSeconds))))
        : 45,
      muscleGroups: Array.isArray(ex.muscleGroups)
        ? ex.muscleGroups
            .map((m) => String(m || '').trim())
            .filter(Boolean)
            .slice(0, 8)
        : ['Corpo Inteiro'],
      executionTip:
        typeof ex.executionTip === 'string' && ex.executionTip.trim()
          ? ex.executionTip.trim().slice(0, 300)
          : 'Execute com controle técnico e respiração constante.',
    };
    if (cleanEx.muscleGroups.length === 0) cleanEx.muscleGroups = ['Corpo Inteiro'];
    if (typeof ex.equipment === 'string' && ex.equipment.trim()) {
      cleanEx.equipment = ex.equipment.trim().slice(0, 80);
    }
    if (typeof ex.loadKg === 'number' && Number.isFinite(ex.loadKg)) {
      cleanEx.loadKg = Math.min(400, Math.max(0, Math.round(ex.loadKg * 2) / 2));
    }
    if (typeof ex.loadNote === 'string' && ex.loadNote.trim()) {
      cleanEx.loadNote = ex.loadNote.trim().slice(0, 140);
    }
    if (typeof ex.unilateral === 'boolean') {
      cleanEx.unilateral = ex.unilateral;
    }
    return cleanEx;
  });

  return {
    id,
    userId: uid,
    name,
    description,
    type,
    difficulty,
    durationMinutes: Math.round(durationMinutes),
    baseXp: Math.round(baseXp),
    rank: rawRank,
    exercises,
  };
}

export async function createWorkoutFs(
  body: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{ workout: WorkoutTemplate }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const workout = sanitizeWorkoutTemplateForWrite(body, uid);
  const path = `users/${uid}/workouts/${workout.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'workouts', workout.id), {
      ...workout,
      updatedAt: serverTimestamp(),
    });
    return { workout };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateWorkoutFs(
  workoutId: string,
  body: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{ workout: WorkoutTemplate }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = assertValidId(workoutId, 'workoutId');
  const path = `users/${uid}/workouts/${cleanId}`;
  const ref = doc(db, 'users', uid, 'workouts', cleanId);

  try {
    const snap = await getDoc(ref);
    const existing = snap.exists()
      ? mapWorkoutTemplateDoc(snap.data(), cleanId, uid)
      : INITIAL_WORKOUTS.find((w) => w.id === cleanId);

    if (!existing) {
      throw new WorkspaceValidationError(404, `Treino "${cleanId}" não encontrado.`, 'workout_not_found');
    }

    let nextExercises = existing.exercises;
    if (body.exercises !== undefined) {
      nextExercises = body.exercises as ExerciseItem[];
    } else if (body.exerciseLoadUpdates && Array.isArray(body.exerciseLoadUpdates)) {
      const loadMap = new Map<string, number>();
      const exerciseIds = new Set(existing.exercises.map((exercise) => exercise.id));
      for (const upd of body.exerciseLoadUpdates as Array<{ exerciseId?: unknown; loadKg?: unknown }>) {
        if (typeof upd?.exerciseId === 'string' && Number.isFinite(Number(upd.loadKg))) {
          if (!exerciseIds.has(upd.exerciseId)) {
            throw new WorkspaceValidationError(
              400,
              'O ajuste referencia um exercício que não faz parte do treino.',
              'exercise_not_in_workout'
            );
          }
          loadMap.set(
            upd.exerciseId,
            Math.min(400, Math.max(0, Math.round(Number(upd.loadKg) * 2) / 2))
          );
        }
      }
      nextExercises = existing.exercises.map((ex) =>
        loadMap.has(ex.id) ? { ...ex, loadKg: loadMap.get(ex.id) } : ex
      );
    }

    const merged = sanitizeWorkoutTemplateForWrite(
      { ...existing, ...body, id: cleanId, exercises: nextExercises },
      uid,
      cleanId
    );

    await setDoc(ref, { ...merged, updatedAt: serverTimestamp() });
    return { workout: merged };
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteWorkoutFs(
  workoutId: string,
  user?: AppAuthUser | null
): Promise<{ deleted: boolean; workoutId: string }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  const cleanId = assertValidId(workoutId, 'workoutId');
  const path = `users/${uid}/workouts/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'workouts', cleanId));
    return { deleted: true, workoutId: cleanId };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function normalizePerformedInputs(
  raw: unknown
): Array<{ exerciseId: string; exerciseName?: string; sets: PerformedSetEntry[] }> | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new WorkspaceValidationError(400, 'performedExercises deve ser uma lista.', 'invalid_workout_completion');
  }
  return raw
    .slice(0, 25)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const exerciseId = assertValidId(entry.exerciseId, 'performedExercises.exerciseId');
      const rawSets = Array.isArray(entry.sets) ? entry.sets : [];
      const sets: PerformedSetEntry[] = rawSets.slice(0, 20).map((s, idx) => {
        const setObj = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
        const weightKg = Number(setObj.weightKg ?? 0);
        const reps = Number(setObj.reps ?? 0);
        return {
          setIndex: Number.isFinite(Number(setObj.setIndex))
            ? Math.min(20, Math.max(1, Math.round(Number(setObj.setIndex))))
            : idx + 1,
          weightKg: Number.isFinite(weightKg) ? Number(Math.min(500, Math.max(0, weightKg)).toFixed(1)) : 0,
          reps: Number.isFinite(reps) ? Math.min(500, Math.max(0, Math.round(reps))) : 0,
          completed: Boolean(setObj.completed),
        };
      });
      return {
        exerciseId,
        exerciseName:
          typeof entry.exerciseName === 'string' && entry.exerciseName.trim()
            ? entry.exerciseName.trim().slice(0, 120)
            : undefined,
        sets,
      };
    })
    .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}

function buildReplaySummary(log: WorkoutLog, stats: GameStats): {
  log: WorkoutLog;
  stats: GameStats;
  duplicate: boolean;
  rewardSummary: SessionRewardSummary;
} {
  return {
    log,
    stats,
    duplicate: true,
    rewardSummary: {
      workoutName: log.workoutName,
      xpFromWorkout: log.xpEarned,
      baseXpFromWorkout: log.xpEarned,
      gearXpBonus: 0,
      gearBonusPercentXp: 0,
      bonusXp: log.bonusXpEarned,
      totalXpGained: log.xpEarned + log.bonusXpEarned,
      coinsEarned: 0,
      baseCoinsEarned: 0,
      gearCoinsBonus: 0,
      gearBonusPercentCoins: 0,
      bossName: '',
      bossDefeated: false,
      totalVolumeKg: log.totalVolumeKg ?? 0,
      prCount: log.prCount ?? 0,
      prXpBonus: 0,
      prCoinsBonus: 0,
      prExerciseNames: [],
      previousLevel: stats.level,
      newLevel: stats.level,
      leveledUp: false,
      isNowMaster: stats.level >= 5,
      unlockedAchievements: [],
      completedExercises: log.completedExercises,
      totalExercises: log.totalExercises,
      durationMinutes: log.durationMinutes,
    },
  };
}

export async function completeWorkoutFs(
  workoutId: string,
  body: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{
  log: WorkoutLog;
  stats: GameStats;
  duplicate: boolean;
  updatedExercisePrs?: ExercisePrRecord[];
  rewardSummary: SessionRewardSummary;
}> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = assertValidId(workoutId, 'workoutId');
  const key = assertValidId(body.idempotencyKey ?? crypto.randomUUID(), 'idempotencyKey');

  const exerciseIds = Array.isArray(body.completedExerciseIds)
    ? [...new Set<string>(body.completedExerciseIds.filter((id): id is string => typeof id === 'string'))].sort()
    : undefined;
  const requestedCount =
    exerciseIds === undefined && body.completedExercises !== undefined
      ? Number(body.completedExercises)
      : undefined;
  const explicitMinutes = body.durationMinutes !== undefined ? Number(body.durationMinutes) : undefined;
  const elapsedSeconds = body.elapsedSeconds !== undefined ? Number(body.elapsedSeconds) : undefined;
  const rawMinutes = explicitMinutes ?? (elapsedSeconds !== undefined ? elapsedSeconds / 60 : undefined);
  const requestedDuration =
    rawMinutes !== undefined && Number.isFinite(rawMinutes)
      ? Math.min(600, Math.max(1, Math.round(rawMinutes)))
      : undefined;
  const requestedBoss = typeof body.bossDefeated === 'boolean' ? body.bossDefeated : undefined;
  const requestedDate =
    body.dateKey === undefined || body.dateKey === null || body.dateKey === ''
      ? undefined
      : assertValidDateKey(body.dateKey, false);
  const normalizedPerformedInputs = normalizePerformedInputs(body.performedExercises);

  const fingerprint = await sha256Hex(
    JSON.stringify([
      cleanId,
      exerciseIds,
      requestedCount,
      requestedDuration,
      requestedBoss,
      requestedDate,
      normalizedPerformedInputs,
    ])
  );
  const keyHash = await sha256Hex(key);
  const logId = `log_v2_${keyHash}_${fingerprint}`;
  const path = `users/${uid}/workoutLogs/${logId}`;

  try {
    const [existingAchs, existingPrs, existingLogs, existingActivities] = await Promise.all([
      queryUserSubcollection(uid, 'achievements', mapAchievementDoc, 50),
      queryUserSubcollection(uid, 'exercisePrs', mapExercisePrDoc, 200),
      queryUserSubcollection(uid, 'workoutLogs', mapWorkoutLogDoc, 400),
      queryUserSubcollection(uid, 'healthActivities', mapHealthActivityDoc, 400),
    ]);

    return await runTransaction(db, async (tx) => {
      const statsRef = doc(db, 'users', uid, 'gameStats', 'main');
      const logRef = doc(db, 'users', uid, 'workoutLogs', logId);
      const workoutRef = doc(db, 'users', uid, 'workouts', cleanId);

      const [statsSnap, existingLogSnap, workoutSnap] = await Promise.all([
        tx.get(statsRef),
        tx.get(logRef),
        tx.get(workoutRef),
      ]);

      const currentStats = statsSnap.exists()
        ? mapGameStatsDoc(statsSnap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      if (existingLogSnap.exists()) {
        return buildReplaySummary(mapWorkoutLogDoc(existingLogSnap.data(), logId, uid), currentStats);
      }

      const workout = workoutSnap.exists()
        ? mapWorkoutTemplateDoc(workoutSnap.data(), cleanId, uid)
        : INITIAL_WORKOUTS.find((w) => w.id === cleanId) ?? null;
      if (!workout) {
        throw new WorkspaceValidationError(404, `Treino "${cleanId}" não encontrado.`, 'workout_not_found');
      }

      const totalExercises = Math.max(1, workout.exercises.length);
      let completedCount = totalExercises;
      if (exerciseIds) {
        const validIds = new Set(workout.exercises.map((e) => e.id));
        const matched = exerciseIds.filter((id) => validIds.has(id));
        completedCount = matched.length > 0 ? matched.length : exerciseIds.length;
      } else if (requestedCount !== undefined && Number.isFinite(requestedCount)) {
        completedCount = Math.round(requestedCount);
      }
      if (completedCount < 1) {
        throw new WorkspaceValidationError(
          400,
          'Conclua pelo menos 1 exercício para registrar o treino.',
          'invalid_completed_count'
        );
      }
      completedCount = Math.min(totalExercises, completedCount);

      const durationMinutes = requestedDuration ?? workout.durationMinutes;
      const bossDefeated = requestedBoss ?? completedCount >= totalExercises;
      const nowIso = new Date().toISOString();
      const todayKey = requestedDate ?? getLocalDateKey();

      const existingPrMap = new Map<string, ExercisePrRecord>();
      for (const pr of existingPrs) {
        existingPrMap.set(pr.exerciseId, pr);
      }
      const workoutExerciseById = new Map<string, ExerciseItem>();
      for (const ex of workout.exercises) {
        workoutExerciseById.set(ex.id, ex);
      }

      const performedRecords: PerformedExerciseRecord[] = [];
      const prUpsertCandidates: ExercisePrRecord[] = [];
      let totalVolumeKg = 0;
      let prCount = 0;
      const prExerciseNames: string[] = [];

      if (normalizedPerformedInputs && normalizedPerformedInputs.length > 0) {
        for (const item of normalizedPerformedInputs) {
          const exTemplate = workoutExerciseById.get(item.exerciseId);
          const exName = (item.exerciseName ?? exTemplate?.name ?? item.exerciseId).slice(0, 120);
          const prevPr = existingPrMap.get(item.exerciseId) ?? null;
          const evaluation = evaluateExercisePrUpdate(item.sets, prevPr);

          performedRecords.push({
            exerciseId: item.exerciseId,
            exerciseName: exName,
            sets: evaluation.annotatedSets,
            volumeKg: evaluation.volumeKg,
            hasPr: evaluation.hasPr,
            bestWeightKg: evaluation.bestWeightKg,
            bestSetVolumeKg: evaluation.bestSetVolumeKg,
            bestEstimated1RmKg: evaluation.bestEstimated1RmKg,
          });

          totalVolumeKg += evaluation.volumeKg;

          if (evaluation.hasPr && evaluation.bestReps >= 1) {
            prCount += 1;
            prExerciseNames.push(exName);
            const nextPr: ExercisePrRecord = {
              id: item.exerciseId,
              userId: uid,
              exerciseId: item.exerciseId,
              exerciseName: exName,
              bestWeightKg: evaluation.nextBestWeightKg,
              bestReps: Math.max(1, evaluation.nextBestReps),
              bestVolumeKg: evaluation.nextBestVolumeKg,
              estimated1RmKg: evaluation.nextEstimated1RmKg,
              updatedAt: nowIso,
              workoutLogId: logId,
              dateKey: todayKey,
            };
            prUpsertCandidates.push(nextPr);
            existingPrMap.set(item.exerciseId, nextPr);
          }
        }
      }

      totalVolumeKg = Number(totalVolumeKg.toFixed(1));
      const { prXpBonus, prCoinsBonus } = calculateSessionPrBonus(prCount);
      const gearBonusSummary = calculateGearBonusSummary(currentStats.equippedGear);

      const baseXpFromWorkout = calculateProportionalXp(
        workout.baseXp,
        completedCount,
        totalExercises,
        0
      );
      const xpFromWorkout = calculateProportionalXp(
        workout.baseXp,
        completedCount,
        totalExercises,
        gearBonusSummary.xpBonusPercent
      );
      const gearXpBonus = Math.max(0, xpFromWorkout - baseXpFromWorkout);

      const baseCoinsEarned = calculateCoinsForWorkout(
        workout.baseXp,
        completedCount,
        totalExercises,
        bossDefeated,
        0
      );
      const workoutCoinsEarned = calculateCoinsForWorkout(
        workout.baseXp,
        completedCount,
        totalExercises,
        bossDefeated,
        gearBonusSummary.coinBonusPercent
      );
      const gearCoinsBonus = Math.max(0, workoutCoinsEarned - baseCoinsEarned);
      const coinsEarned = workoutCoinsEarned + prCoinsBonus;

      const boss = getBossForWorkout(workout);
      const nextStreakInfo = calculateNextStreak(
        currentStats.currentStreak,
        currentStats.longestStreak,
        currentStats.lastWorkoutDate,
        todayKey
      );

      const newLog: WorkoutLog = {
        id: logId,
        userId: uid,
        workoutId: workout.id,
        workoutName: workout.name.slice(0, 100),
        workoutType: workout.type,
        difficulty: workout.difficulty,
        completedExercises: completedCount,
        totalExercises,
        durationMinutes,
        xpEarned: xpFromWorkout,
        bonusXpEarned: prXpBonus,
        ...(performedRecords.length > 0 ? { performedExercises: performedRecords } : {}),
        totalVolumeKg,
        prCount,
        dateKey: todayKey,
        completedAt: nowIso,
      };

      const weeklyRaidAfterWorkout = getWeeklyRaidBossState(
        todayKey,
        [...existingLogs, newLog],
        existingActivities
      );

      const previousLevel = currentStats.level;
      const xpAfterWorkoutAndPr = currentStats.totalXp + xpFromWorkout + prXpBonus;

      const provisionalStats = normalizeGameStats({
        ...currentStats,
        totalXp: xpAfterWorkoutAndPr,
        level: calculateLevel(xpAfterWorkoutAndPr),
        goldCoins: (currentStats.goldCoins ?? 0) + coinsEarned,
        totalCoinsEarned: (currentStats.totalCoinsEarned ?? 0) + coinsEarned,
        bossesDefeated: (currentStats.bossesDefeated ?? 0) + (bossDefeated ? 1 : 0),
        currentStreak: nextStreakInfo.currentStreak,
        longestStreak: nextStreakInfo.longestStreak,
        lastWorkoutDate:
          !currentStats.lastWorkoutDate || todayKey > currentStats.lastWorkoutDate
            ? todayKey
            : currentStats.lastWorkoutDate,
        totalWorkouts: currentStats.totalWorkouts + 1,
        totalMinutes: currentStats.totalMinutes + durationMinutes,
        cardioWorkouts: currentStats.cardioWorkouts + (workout.type === 'cardio' ? 1 : 0),
        forcaWorkouts: currentStats.forcaWorkouts + (workout.type === 'forca' ? 1 : 0),
        hiitWorkouts: currentStats.hiitWorkouts + (workout.type === 'hiit' ? 1 : 0),
        coreWorkouts: currentStats.coreWorkouts + (workout.type === 'core' ? 1 : 0),
        mobilidadeWorkouts: currentStats.mobilidadeWorkouts + (workout.type === 'mobilidade' ? 1 : 0),
        corpoInteiroWorkouts:
          currentStats.corpoInteiroWorkouts + (workout.type === 'corpo_inteiro' ? 1 : 0),
        updatedAt: nowIso,
      });

      const existingAchMap: Partial<Record<AchievementId, UserAchievement>> = {};
      for (const a of existingAchs) existingAchMap[a.id] = a;

      const achContext = {
        prCountTotal: existingPrMap.size,
        weeklyRaidDefeated: weeklyRaidAfterWorkout.isDefeated,
      };

      const firstAchPass = evaluateAchievements(provisionalStats, existingAchMap, nowIso, achContext);
      const statsAfterFirst = normalizeGameStats({
        ...provisionalStats,
        totalXp: xpAfterWorkoutAndPr + firstAchPass.bonusXpTotal,
        level: calculateLevel(xpAfterWorkoutAndPr + firstAchPass.bonusXpTotal),
      });
      const achMapAfterFirst: Partial<Record<AchievementId, UserAchievement>> = {};
      for (const ach of firstAchPass.updatedAchievements) achMapAfterFirst[ach.id] = ach;

      const finalAchPass = evaluateAchievements(statsAfterFirst, achMapAfterFirst, nowIso, achContext);
      const achBonusXp = firstAchPass.bonusXpTotal + finalAchPass.bonusXpTotal;
      const totalBonusXp = prXpBonus + achBonusXp;
      newLog.bonusXpEarned = totalBonusXp;

      const finalStats = normalizeGameStats({
        ...statsAfterFirst,
        totalXp: xpAfterWorkoutAndPr + achBonusXp,
        level: calculateLevel(xpAfterWorkoutAndPr + achBonusXp),
        hunterHp: Math.min(100, (currentStats.hunterHp ?? 100) + 10),
      });

      const unlockedChanges = finalAchPass.updatedAchievements.filter((achievement) => {
        const previous = existingAchMap[achievement.id];
        return achievement.unlocked && (!previous?.unlocked || previous.unlockedAt !== achievement.unlockedAt);
      });

      tx.set(statsRef, buildGameStatsPayload(finalStats, uid));
      tx.set(logRef, {
        ...newLog,
        createdAt: serverTimestamp(),
      });

      for (const ach of unlockedChanges) {
        tx.set(doc(db, 'users', uid, 'achievements', ach.id), {
          id: ach.id,
          userId: uid,
          unlocked: ach.unlocked,
          unlockedAt: ach.unlockedAt,
          updatedAt: serverTimestamp(),
        });
      }

      for (const pr of prUpsertCandidates) {
        tx.set(doc(db, 'users', uid, 'exercisePrs', pr.exerciseId), {
          id: pr.id,
          userId: uid,
          exerciseId: pr.exerciseId,
          exerciseName: pr.exerciseName,
          bestWeightKg: pr.bestWeightKg,
          bestReps: pr.bestReps,
          bestVolumeKg: pr.bestVolumeKg,
          estimated1RmKg: pr.estimated1RmKg,
          workoutLogId: pr.workoutLogId,
          dateKey: pr.dateKey,
          updatedAt: serverTimestamp(),
        });
      }

      if (finalStats.totalXp !== currentStats.totalXp || finalStats.goldCoins !== currentStats.goldCoins) {
        const ledger = buildLedgerEntryData(uid, currentStats, finalStats, 'workout', workout.name);
        tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);
      }

      return {
        log: newLog,
        stats: finalStats,
        duplicate: false,
        updatedExercisePrs: prUpsertCandidates,
        rewardSummary: {
          workoutName: workout.name,
          xpFromWorkout,
          baseXpFromWorkout,
          gearXpBonus,
          gearBonusPercentXp: gearBonusSummary.xpBonusPercent,
          bonusXp: totalBonusXp,
          totalXpGained: xpFromWorkout + totalBonusXp,
          coinsEarned,
          baseCoinsEarned,
          gearCoinsBonus,
          gearBonusPercentCoins: gearBonusSummary.coinBonusPercent,
          bossName: boss.name,
          bossDefeated,
          totalVolumeKg,
          prCount,
          prXpBonus,
          prCoinsBonus,
          prExerciseNames,
          previousLevel,
          newLevel: finalStats.level,
          leveledUp: finalStats.level > previousLevel,
          isNowMaster: finalStats.level >= 5,
          unlockedAchievements: [...firstAchPass.newlyUnlocked, ...finalAchPass.newlyUnlocked],
          completedExercises: completedCount,
          totalExercises,
          durationMinutes,
        },
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function listWorkoutLogsFs(limitCount = 50, user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  const logs = await queryUserSubcollection(uid, 'workoutLogs', mapWorkoutLogDoc, Math.max(limitCount, 200));
  logs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return {
    logs: logs.slice(0, limitCount),
    nextCursor: null,
    order: 'completedAt' as const,
  };
}

export async function getProgressLedgerFs(
  user?: AppAuthUser | null,
  cursor?: string
): Promise<ProgressLedgerPage> {
  const uid = assertAuthenticatedVerifiedUid(user);
  const entries = await queryUserSubcollection(uid, 'progressLedger', mapProgressLedgerDoc, 300);
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pageSize = 25;
  const startIndex = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const slice = entries.slice(startIndex, startIndex + pageSize);
  const nextCursor = startIndex + pageSize < entries.length ? String(startIndex + pageSize) : null;

  return {
    available: true,
    entries: slice,
    nextCursor,
  };
}

export async function grantStatsFs(
  delta: { xpDelta?: number; coinsDelta?: number; hpDelta?: number; bossesDelta?: number },
  user?: AppAuthUser | null
) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const xpDelta = Number(delta.xpDelta ?? 0);
  const coinsDelta = Number(delta.coinsDelta ?? 0);
  const hpDelta = Number(delta.hpDelta ?? 0);
  const bossesDelta = Number(delta.bossesDelta ?? 0);

  if (![xpDelta, coinsDelta, hpDelta, bossesDelta].every((n) => Number.isFinite(n))) {
    throw new WorkspaceValidationError(400, 'Valores de ajuste inválidos.', 'invalid_stats_delta');
  }
  if (xpDelta === 0 && coinsDelta === 0 && hpDelta === 0 && bossesDelta === 0) {
    throw new WorkspaceValidationError(400, 'Informe ao menos um ajuste.', 'empty_stats_delta');
  }

  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      const previousLevel = current.level;
      const nextXp = Math.min(MAX_TOTAL_XP, Math.max(0, Math.round(current.totalXp + xpDelta)));
      const nextCoins = Math.min(MAX_GOLD_COINS, Math.max(0, Math.round((current.goldCoins ?? 0) + coinsDelta)));
      const nextTotalCoinsEarned =
        coinsDelta > 0
          ? Math.min(MAX_TOTAL_COINS_EARNED, (current.totalCoinsEarned ?? 0) + Math.round(coinsDelta))
          : current.totalCoinsEarned ?? 0;
      const nextHp = Math.min(MAX_HUNTER_HP, Math.max(0, Math.round((current.hunterHp ?? MAX_HUNTER_HP) + hpDelta)));
      const nextBosses = Math.min(MAX_BOSSES_DEFEATED, Math.max(0, Math.round((current.bossesDefeated ?? 0) + bossesDelta)));

      const updated = normalizeGameStats({
        ...current,
        totalXp: nextXp,
        level: calculateLevel(nextXp),
        goldCoins: nextCoins,
        totalCoinsEarned: nextTotalCoinsEarned,
        hunterHp: nextHp,
        bossesDefeated: nextBosses,
        updatedAt: new Date().toISOString(),
      });

      tx.set(statsRef, buildGameStatsPayload(updated, uid));
      const ledger = buildLedgerEntryData(uid, current, updated, 'adjustment', 'Ajuste de XP e moedas');
      tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);

      return {
        previousLevel,
        newLevel: updated.level,
        leveledUp: updated.level > previousLevel,
        stats: updated,
        levelProgress: getLevelProgress(updated.totalXp),
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function getArmoryStateFs(user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  const snap = await getDoc(doc(db, 'users', uid, 'gameStats', 'main')).catch((err) =>
    handleFirestoreError(err, OperationType.GET, `users/${uid}/gameStats/main`)
  );
  const stats = snap.exists() ? mapGameStatsDoc(snap.data(), uid) : normalizeGameStats(createInitialGameStats(uid));
  return {
    goldCoins: stats.goldCoins,
    totalCoinsEarned: stats.totalCoinsEarned,
    ownedEquipmentIds: stats.ownedEquipmentIds,
    equippedGear: stats.equippedGear,
    gearLoadouts: stats.gearLoadouts,
    exampleLoadouts: EXAMPLE_LOADOUT_PRESETS,
    gearBonuses: calculateGearBonusSummary(stats.equippedGear),
  };
}

export async function purchaseGearFs(
  itemId: string,
  equipAfterPurchase: boolean = true,
  user?: AppAuthUser | null
) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = itemId.trim();
  const item = EQUIPMENT_CATALOG.find((e) => e.id === cleanId);
  if (!item) {
    throw new WorkspaceValidationError(404, `Equipamento "${cleanId}" não encontrado.`, 'equipment_not_found');
  }

  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      if (!isEquipmentMilestoneUnlocked(item, current)) {
        throw new WorkspaceValidationError(
          400,
          `Requisito pendente para "${item.name}": ${item.unlockRequirementLabel}.`,
          'milestone_locked'
        );
      }

      const alreadyOwned = current.ownedEquipmentIds.includes(item.id);
      if (!alreadyOwned && current.goldCoins < item.priceCoins) {
        throw new WorkspaceValidationError(
          400,
          `Moedas insuficientes (${current.goldCoins}/${item.priceCoins}).`,
          'insufficient_coins'
        );
      }
      if (!alreadyOwned && current.ownedEquipmentIds.length >= MAX_OWNED_EQUIPMENT_IDS) {
        throw new WorkspaceValidationError(409, 'O Arsenal atingiu o limite de itens.', 'inventory_full');
      }

      const goldCoins = alreadyOwned ? current.goldCoins : current.goldCoins - item.priceCoins;
      const equippedGear = equipAfterPurchase
        ? { ...current.equippedGear, [item.slot]: item.id }
        : current.equippedGear;
      const ownedEquipmentIds = alreadyOwned
        ? current.ownedEquipmentIds
        : [...current.ownedEquipmentIds, item.id];

      const nextStats = normalizeGameStats({
        ...current,
        goldCoins,
        ownedEquipmentIds,
        equippedGear,
        updatedAt: new Date().toISOString(),
      });

      if (snap.exists()) {
        const changes: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (!alreadyOwned) {
          changes.ownedEquipmentIds = nextStats.ownedEquipmentIds;
          changes.goldCoins = nextStats.goldCoins;
        }
        if (equipAfterPurchase) changes.equippedGear = nextStats.equippedGear;
        tx.update(statsRef, changes);
      } else {
        tx.set(statsRef, buildGameStatsPayload(nextStats, uid));
      }

      if (!alreadyOwned && item.priceCoins > 0) {
        const ledger = buildLedgerEntryData(uid, current, nextStats, 'armory_purchase', item.name);
        tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);
      }

      return {
        purchasedItem: item,
        equipped: equipAfterPurchase,
        goldCoins: nextStats.goldCoins,
        ownedEquipmentIds: nextStats.ownedEquipmentIds,
        equippedGear: nextStats.equippedGear,
        updatedAt: nextStats.updatedAt,
        gearBonuses: calculateGearBonusSummary(nextStats.equippedGear),
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function equipGearFs(
  payload: { slot: EquipmentSlot; itemId: string | null } | { gear: EquippedGear },
  user?: AppAuthUser | null
) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));
      const ownedSet = new Set(current.ownedEquipmentIds);
      let nextGear: EquippedGear = { ...current.equippedGear };

      if ('slot' in payload) {
        const itemId = payload.itemId === null ? null : String(payload.itemId || '').trim();
        if (itemId) {
          const item = EQUIPMENT_CATALOG.find((e) => e.id === itemId);
          if (!item || item.slot !== payload.slot) {
            throw new WorkspaceValidationError(400, `Item "${itemId}" não pertence ao slot "${payload.slot}".`, 'slot_mismatch');
          }
          if (!ownedSet.has(itemId)) {
            throw new WorkspaceValidationError(403, `Você ainda não possui "${item.name}".`, 'item_not_owned');
          }
        }
        nextGear = { ...nextGear, [payload.slot]: itemId || null };
      } else {
        const candidate = migrateEquippedGear(payload.gear);
        for (const s of ['elmo', 'armadura', 'capa', 'arma'] as EquipmentSlot[]) {
          const id = candidate[s];
          if (id && !ownedSet.has(id)) {
            throw new WorkspaceValidationError(403, `Você ainda não desbloqueou "${id}".`, 'item_not_owned');
          }
        }
        nextGear = candidate;
      }

      const nowIso = new Date().toISOString();
      if (snap.exists()) {
        tx.update(statsRef, { equippedGear: nextGear, updatedAt: serverTimestamp() });
      } else {
        tx.set(statsRef, buildGameStatsPayload({ ...current, equippedGear: nextGear }, uid));
      }

      return {
        equippedGear: nextGear,
        updatedAt: nowIso,
        gearBonuses: calculateGearBonusSummary(nextGear),
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function saveLoadoutFs(
  name: string,
  gearInput?: EquippedGear,
  user?: AppAuthUser | null
) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanName = name.trim().slice(0, 28);
  if (cleanName.length < 2) {
    throw new WorkspaceValidationError(400, 'Nome do loadout deve ter entre 2 e 28 caracteres.', 'invalid_loadout_name');
  }

  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));
      if (current.gearLoadouts.length >= ARSENAL_CONFIG.maxPresets) {
        throw new WorkspaceValidationError(
          400,
          `Limite máximo de ${ARSENAL_CONFIG.maxPresets} loadouts salvos atingido.`,
          'max_loadouts_reached'
        );
      }

      const preset: GearLoadoutPreset = {
        id: `preset-${crypto.randomUUID().slice(0, 16)}`,
        name: cleanName,
        gear: gearInput ? migrateEquippedGear(gearInput) : current.equippedGear,
      };
      const gearLoadouts = [...current.gearLoadouts, preset];
      if (snap.exists()) {
        tx.update(statsRef, { gearLoadouts, updatedAt: serverTimestamp() });
      } else {
        tx.set(statsRef, buildGameStatsPayload({ ...current, gearLoadouts }, uid));
      }
      return { preset, gearLoadouts };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function applyLoadoutFs(loadoutId: string, user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = assertValidId(loadoutId, 'loadoutId');
  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      const target =
        current.gearLoadouts.find((p) => p.id === cleanId) ??
        EXAMPLE_LOADOUT_PRESETS.find((p) => p.id === cleanId);

      if (!target) {
        throw new WorkspaceValidationError(404, `Loadout "${cleanId}" não encontrado.`, 'loadout_not_found');
      }

      const owned = new Set(current.ownedEquipmentIds);
      const sanitizedGear: EquippedGear = {
        elmo: target.gear.elmo && owned.has(target.gear.elmo) ? target.gear.elmo : null,
        armadura: target.gear.armadura && owned.has(target.gear.armadura) ? target.gear.armadura : null,
        capa: target.gear.capa && owned.has(target.gear.capa) ? target.gear.capa : null,
        arma: target.gear.arma && owned.has(target.gear.arma) ? target.gear.arma : null,
      };

      if (snap.exists()) {
        tx.update(statsRef, { equippedGear: sanitizedGear, updatedAt: serverTimestamp() });
      } else {
        tx.set(statsRef, buildGameStatsPayload({ ...current, equippedGear: sanitizedGear }, uid));
      }

      return {
        appliedLoadout: target.name,
        equippedGear: sanitizedGear,
        gearBonuses: calculateGearBonusSummary(sanitizedGear),
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function deleteLoadoutFs(loadoutId: string, user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = assertValidId(loadoutId, 'loadoutId');
  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const current = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));
      const gearLoadouts = current.gearLoadouts.filter((p) => p.id !== cleanId);
      if (snap.exists()) {
        tx.update(statsRef, { gearLoadouts, updatedAt: serverTimestamp() });
      } else {
        tx.set(statsRef, buildGameStatsPayload({ ...current, gearLoadouts }, uid));
      }
      return { deleted: true, loadoutId: cleanId, gearLoadouts };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function createVowFs(
  payload: { title: string; xpReward?: number; penaltyXp?: number },
  user?: AppAuthUser | null
): Promise<{ vow: DailyVow }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const title = payload.title.trim().slice(0, 80);
  if (title.length < 3) {
    throw new WorkspaceValidationError(
      400,
      'O título do voto deve ter entre 3 e 80 caracteres.',
      'invalid_vow_title'
    );
  }
  const xpReward = Math.min(100, Math.max(5, Math.round(Number(payload.xpReward ?? 15))));
  const penaltyXp = Math.min(100, Math.max(5, Math.round(Number(payload.penaltyXp ?? 15))));
  const id = `vow-${crypto.randomUUID()}`;
  const path = `users/${uid}/dailyVows/${id}`;

  try {
    await setDoc(doc(db, 'users', uid, 'dailyVows', id), {
      id,
      userId: uid,
      title,
      xpReward,
      penaltyXp,
      completedDateKey: null,
      violatedDateKey: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      vow: {
        id,
        userId: uid,
        title,
        xpReward,
        penaltyXp,
        completedDateKey: null,
        violatedDateKey: null,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function resolveVowFs(
  vowId: string,
  mode: 'complete' | 'violate',
  dateKeyRaw?: string,
  user?: AppAuthUser | null
): Promise<{ vow: DailyVow; stats: GameStats }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const cleanId = assertValidId(vowId, 'vowId');
  const todayKey = assertValidDateKey(dateKeyRaw, true);
  const vowRef = doc(db, 'users', uid, 'dailyVows', cleanId);
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');
  const path = `users/${uid}/dailyVows/${cleanId}`;

  try {
    return await runTransaction(db, async (tx) => {
      const [vowSnap, statsSnap] = await Promise.all([tx.get(vowRef), tx.get(statsRef)]);
      if (!vowSnap.exists()) {
        throw new WorkspaceValidationError(404, `Voto "${cleanId}" não encontrado.`, 'vow_not_found');
      }
      const vow = mapDailyVowDoc(vowSnap.data(), cleanId, uid);
      if (isVowResolvedToday(vow, todayKey)) {
        throw new WorkspaceValidationError(409, 'Este voto diário já foi resolvido hoje.', 'vow_already_resolved');
      }
      const currentStats = statsSnap.exists()
        ? mapGameStatsDoc(statsSnap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      let updatedVow: DailyVow;
      let updatedStats: GameStats;

      if (mode === 'complete') {
        const res = applyVowCompletion(
          currentStats.totalXp,
          currentStats.hunterHp ?? 100,
          vow.xpReward,
          5
        );
        updatedVow = { ...vow, completedDateKey: todayKey, violatedDateKey: null };
        updatedStats = normalizeGameStats({
          ...currentStats,
          totalXp: res.newXp,
          level: res.newLevel,
          hunterHp: res.newHp,
          goldCoins: (currentStats.goldCoins ?? 0) + 10,
          totalCoinsEarned: (currentStats.totalCoinsEarned ?? 0) + 10,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const res = applyHabitPenalty(
          currentStats.totalXp,
          currentStats.hunterHp ?? 100,
          vow.penaltyXp,
          15
        );
        updatedVow = { ...vow, violatedDateKey: todayKey, completedDateKey: null };
        updatedStats = normalizeGameStats({
          ...currentStats,
          totalXp: res.newXp,
          level: res.newLevel,
          hunterHp: res.newHp,
          updatedAt: new Date().toISOString(),
        });
      }

      tx.update(vowRef, {
        completedDateKey: updatedVow.completedDateKey,
        violatedDateKey: updatedVow.violatedDateKey,
        updatedAt: serverTimestamp(),
      });
      if (statsSnap.exists()) {
        tx.update(statsRef, {
          totalXp: updatedStats.totalXp,
          level: updatedStats.level,
          hunterHp: updatedStats.hunterHp,
          goldCoins: updatedStats.goldCoins,
          totalCoinsEarned: updatedStats.totalCoinsEarned,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(statsRef, buildGameStatsPayload(updatedStats, uid));
      }

      const ledger = buildLedgerEntryData(
        uid,
        currentStats,
        updatedStats,
        mode === 'complete' ? 'vow_completed' : 'vow_broken',
        vow.title
      );
      tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);

      return { vow: updatedVow, stats: updatedStats };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteVowFs(
  vowId: string,
  user?: AppAuthUser | null
): Promise<{ deleted: boolean; vowId: string }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  const cleanId = assertValidId(vowId, 'vowId');
  const path = `users/${uid}/dailyVows/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'dailyVows', cleanId));
    return { deleted: true, vowId: cleanId };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function getDailyQuestsFs(dateKeyRaw?: string, user?: AppAuthUser | null) {
  const uid = assertAuthenticatedVerifiedUid(user);
  const todayKey = assertValidDateKey(dateKeyRaw, true);
  const [statsSnap, metrics, logs, activities, weightLogs] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'gameStats', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `users/${uid}/gameStats/main`)
    ),
    queryUserSubcollection(uid, 'dailyHealthMetrics', mapDailyHealthMetricDoc, 250),
    queryUserSubcollection(uid, 'workoutLogs', mapWorkoutLogDoc, 400),
    queryUserSubcollection(uid, 'healthActivities', mapHealthActivityDoc, 400),
    queryUserSubcollection(uid, 'weightLogs', mapWeightLogDoc, 400),
  ]);

  const normalizedStats = statsSnap.exists()
    ? mapGameStatsDoc(statsSnap.data(), uid)
    : normalizeGameStats(createInitialGameStats(uid));
  const todayMetric = metrics.find((m) => m.dateKey === todayKey) ?? null;

  return {
    dateKey: todayKey,
    quests: evaluateDailyAutoQuests(
      todayKey,
      todayMetric,
      logs,
      activities,
      weightLogs,
      normalizedStats.claimedAutoQuestKeys
    ),
    weeklyQuests: evaluateWeeklyAutoQuests(
      todayKey,
      logs,
      activities,
      normalizedStats.claimedAutoQuestKeys
    ),
    weeklyRaidBoss: getWeeklyRaidBossState(todayKey, logs, activities),
  };
}

export async function claimDailyQuestFs(
  questId: AnyAutoQuestId,
  dateKeyRaw?: string,
  user?: AppAuthUser | null
) {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const isWeekly = isWeeklyAutoQuestId(questId);
  if (!isWeekly && !['steps_6000', 'workout_today', 'weight_today'].includes(questId)) {
    throw new WorkspaceValidationError(400, 'questId inválido.', 'invalid_quest_id');
  }
  const dateKey = assertValidDateKey(dateKeyRaw, true);
  const statsPath = `users/${uid}/gameStats/main`;
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    const [metrics, logs, activities, weightLogs] = await Promise.all([
      queryUserSubcollection(uid, 'dailyHealthMetrics', mapDailyHealthMetricDoc, 250),
      queryUserSubcollection(uid, 'workoutLogs', mapWorkoutLogDoc, 400),
      queryUserSubcollection(uid, 'healthActivities', mapHealthActivityDoc, 400),
      queryUserSubcollection(uid, 'weightLogs', mapWeightLogDoc, 400),
    ]);

    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(statsRef);
      const currentStats = snap.exists()
        ? mapGameStatsDoc(snap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      let targetTitle = '';
      let xpReward = 0;
      let coinsReward = 0;
      let progressText = '';
      let isFulfilled = false;
      let isClaimed = false;
      let claimKey = `${dateKey}:${questId}`;
      let claimedQuestPayload: ReturnType<typeof evaluateDailyAutoQuests>[number] | ReturnType<typeof evaluateWeeklyAutoQuests>[number];

      if (isWeekly) {
        const weeklyTarget = evaluateWeeklyAutoQuests(
          dateKey,
          logs,
          activities,
          currentStats.claimedAutoQuestKeys
        ).find((q) => q.id === questId);
        if (!weeklyTarget) {
          throw new WorkspaceValidationError(404, 'Missão semanal não encontrada.', 'quest_not_found');
        }
        targetTitle = weeklyTarget.title;
        xpReward = weeklyTarget.xpReward;
        coinsReward = weeklyTarget.coinsReward;
        progressText = weeklyTarget.progressText;
        isFulfilled = weeklyTarget.isFulfilled;
        isClaimed = weeklyTarget.isClaimedThisWeek;
        claimKey = `${weeklyTarget.weekKey}:${questId}`;
        claimedQuestPayload = { ...weeklyTarget, isClaimedThisWeek: true };
      } else {
        const todayMetric = metrics.find((m) => m.dateKey === dateKey) ?? null;
        const dailyTarget = evaluateDailyAutoQuests(
          dateKey,
          todayMetric,
          logs,
          activities,
          weightLogs,
          currentStats.claimedAutoQuestKeys
        ).find((q) => q.id === questId);
        if (!dailyTarget) {
          throw new WorkspaceValidationError(404, 'Missão automática não encontrada.', 'quest_not_found');
        }
        targetTitle = dailyTarget.title;
        xpReward = dailyTarget.xpReward;
        coinsReward = dailyTarget.coinsReward;
        progressText = dailyTarget.progressText;
        isFulfilled = dailyTarget.isFulfilled;
        isClaimed = dailyTarget.isClaimedToday;
        claimKey = `${dateKey}:${questId}`;
        claimedQuestPayload = { ...dailyTarget, isClaimedToday: true };
      }

      if (!isFulfilled) {
        throw new WorkspaceValidationError(
          400,
          `A meta "${targetTitle}" ainda não foi atingida (${progressText}).`,
          'quest_not_fulfilled'
        );
      }
      if (isClaimed) {
        throw new WorkspaceValidationError(
          409,
          isWeekly
            ? 'Esta missão semanal já foi resgatada nesta semana.'
            : 'Esta missão automática já foi resgatada hoje.',
          'quest_already_claimed'
        );
      }

      const nextXp = Math.min(MAX_TOTAL_XP, currentStats.totalXp + xpReward);
      const nextCoins = Math.min(MAX_GOLD_COINS, (currentStats.goldCoins ?? 0) + coinsReward);
      const nextClaimed = [...currentStats.claimedAutoQuestKeys, claimKey].slice(-MAX_CLAIMED_AUTO_QUEST_KEYS);

      const updated = normalizeGameStats({
        ...currentStats,
        totalXp: nextXp,
        level: calculateLevel(nextXp),
        goldCoins: nextCoins,
        totalCoinsEarned: (currentStats.totalCoinsEarned ?? 0) + coinsReward,
        claimedAutoQuestKeys: nextClaimed,
        updatedAt: new Date().toISOString(),
      });

      if (snap.exists()) {
        tx.update(statsRef, {
          totalXp: updated.totalXp,
          level: updated.level,
          goldCoins: updated.goldCoins,
          totalCoinsEarned: updated.totalCoinsEarned,
          claimedAutoQuestKeys: updated.claimedAutoQuestKeys,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(statsRef, buildGameStatsPayload(updated, uid));
      }

      const ledger = buildLedgerEntryData(uid, currentStats, updated, 'daily_quest', targetTitle);
      tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);

      return { claimedQuest: claimedQuestPayload, stats: updated };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, statsPath);
  }
}

export async function getHealthSummaryFs(user?: AppAuthUser | null) {
  const state = await getFullSystemStateFs(user);
  const weightLogs = [...state.weightLogs].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const dailyMetrics = [...state.dailyMetrics].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const activities = [...state.healthActivities].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const maxHr = state.hero?.maxHrEstimated ?? 190;
  const hrZones = buildZoneTotals(activities, state.workoutLogs, maxHr);
  const bmi = computeBmiSummary(state.hero?.heightCm, latestWeight?.weightKg ?? state.hero?.weightKg);
  const projected = projectHealthConnect(
    [],
    activities,
    dailyMetrics,
    state.uid,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  );

  return {
    latestWeight,
    bmi,
    recovery: state.recovery,
    hrZones,
    healthConnect: {
      status: 'available' as const,
      days: projected.days,
      latestHeartRate: projected.latestHeartRate,
    },
    weightLogs,
    dailyMetrics,
    activities,
  };
}

export async function logWeightFs(
  payload: { weightKg: number; dateKey?: string; note?: string | null },
  user?: AppAuthUser | null
): Promise<{ weightLog: WeightLog; bmi: { bmi: number; label: string } | null }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const weightKg = Number(payload.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 350) {
    throw new WorkspaceValidationError(400, 'weightKg deve estar entre 25 e 350 kg.', 'invalid_weight');
  }
  const dateKey = assertValidDateKey(payload.dateKey, true);
  const roundedWeight = Math.round(weightKg * 10) / 10;
  const note =
    typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim().slice(0, 140) : null;
  const nowIso = new Date().toISOString();

  const weightPath = `users/${uid}/weightLogs/${dateKey}`;
  const weightRef = doc(db, 'users', uid, 'weightLogs', dateKey);
  const heroRef = doc(db, 'users', uid, 'heroProfiles', 'main');

  try {
    const allWeights = await queryUserSubcollection(uid, 'weightLogs', mapWeightLogDoc, 400);
    const latestExisting = [...allWeights].sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0];

    return await runTransaction(db, async (tx) => {
      const [existingSnap, heroSnap] = await Promise.all([tx.get(weightRef), tx.get(heroRef)]);
      const recordedAt = existingSnap.exists()
        ? tsToIso(existingSnap.data().recordedAt, nowIso)
        : nowIso;

      const weightRecord: WeightLog = {
        id: dateKey,
        userId: uid,
        weightKg: roundedWeight,
        dateKey,
        note,
        recordedAt,
        updatedAt: nowIso,
      };

      if (existingSnap.exists()) {
        tx.update(weightRef, {
          weightKg: roundedWeight,
          note,
          recordedAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(weightRef, {
          id: dateKey,
          userId: uid,
          weightKg: roundedWeight,
          dateKey,
          note,
          recordedAt,
          updatedAt: serverTimestamp(),
        });
      }

      let heroHeight: number | null | undefined;
      if (heroSnap.exists()) {
        const hero = mapHeroProfileDoc(heroSnap.data(), uid);
        heroHeight = hero.heightCm;
        if (!latestExisting || dateKey >= latestExisting.dateKey) {
          tx.update(heroRef, {
            weightKg: roundedWeight,
            updatedAt: serverTimestamp(),
          });
        }
      }

      return {
        weightLog: weightRecord,
        bmi: computeBmiSummary(heroHeight, roundedWeight),
      };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, weightPath);
  }
}

export async function deleteWeightLogFs(
  dateKeyRaw: string,
  user?: AppAuthUser | null
): Promise<{ deleted: boolean }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  const dateKey = assertValidDateKey(dateKeyRaw, false);
  const weightPath = `users/${uid}/weightLogs/${dateKey}`;
  const weightRef = doc(db, 'users', uid, 'weightLogs', dateKey);
  const heroRef = doc(db, 'users', uid, 'heroProfiles', 'main');

  try {
    const allWeights = await queryUserSubcollection(uid, 'weightLogs', mapWeightLogDoc, 400);
    const sorted = [...allWeights].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return await runTransaction(db, async (tx) => {
      const [existingSnap, heroSnap] = await Promise.all([tx.get(weightRef), tx.get(heroRef)]);
      if (!existingSnap.exists()) return { deleted: false };
      tx.delete(weightRef);
      if (heroSnap.exists() && sorted[0]?.dateKey === dateKey && sorted[1]) {
        tx.update(heroRef, {
          weightKg: sorted[1].weightKg,
          updatedAt: serverTimestamp(),
        });
      }
      return { deleted: true };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.DELETE, weightPath);
  }
}

export async function logHealthMetricsFs(
  payload: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{ dailyMetric: DailyHealthMetric }> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const dateKey = assertValidDateKey(payload.dateKey, true);
  const path = `users/${uid}/dailyHealthMetrics/${dateKey}`;
  const ref = doc(db, 'users', uid, 'dailyHealthMetrics', dateKey);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists() ? mapDailyHealthMetricDoc(snap.data(), dateKey, uid) : undefined;

      const steps =
        payload.steps !== undefined
          ? Math.min(200000, Math.max(0, Math.round(Number(payload.steps))))
          : existing?.steps ?? 0;
      const activeCalories =
        payload.activeCalories !== undefined
          ? Math.min(25000, Math.max(0, Math.round(Number(payload.activeCalories))))
          : existing?.activeCalories ?? 0;
      const sleepHours =
        payload.sleepHours !== undefined
          ? Math.min(24, Math.max(0, Number(Number(payload.sleepHours).toFixed(1))))
          : existing?.sleepHours ?? 0;

      let restingHeartRate = existing?.restingHeartRate ?? null;
      if (payload.restingHeartRate !== undefined) {
        restingHeartRate =
          payload.restingHeartRate === null
            ? null
            : Math.min(200, Math.max(25, Math.round(Number(payload.restingHeartRate))));
      }

      let hrvMs = existing?.hrvMs ?? null;
      if (payload.hrvMs !== undefined) {
        hrvMs =
          payload.hrvMs === null
            ? null
            : Math.min(500, Math.max(0, Math.round(Number(payload.hrvMs))));
      }

      const trainingLoadScore =
        payload.trainingLoadScore !== undefined
          ? Math.min(2000, Math.max(0, Math.round(Number(payload.trainingLoadScore))))
          : existing?.trainingLoadScore ?? Math.round(steps / 120 + activeCalories / 15);

      const recoveryScore =
        payload.recoveryScore !== undefined
          ? Math.min(100, Math.max(0, Math.round(Number(payload.recoveryScore))))
          : existing?.recoveryScore ?? Math.min(100, Math.max(35, Math.round(60 + sleepHours * 4)));

      const incomingSources = Array.isArray(payload.sources)
        ? payload.sources.map((s) => String(s || '').trim()).filter(Boolean)
        : ['api'];
      const mergedSources = Array.from(
        new Set([...(existing?.sources ?? []), ...incomingSources])
      ).slice(0, 10);

      const nowIso = new Date().toISOString();
      const record: DailyHealthMetric = {
        id: dateKey,
        userId: uid,
        dateKey,
        steps,
        activeCalories,
        sleepHours,
        restingHeartRate,
        hrvMs,
        trainingLoadScore,
        recoveryScore,
        sources: mergedSources.length > 0 ? mergedSources : ['api'],
        updatedAt: nowIso,
      };

      if (snap.exists()) {
        tx.update(ref, {
          steps,
          activeCalories,
          sleepHours,
          restingHeartRate,
          hrvMs,
          trainingLoadScore,
          recoveryScore,
          sources: record.sources,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(ref, {
          id: dateKey,
          userId: uid,
          dateKey,
          steps,
          activeCalories,
          sleepHours,
          restingHeartRate,
          hrvMs,
          trainingLoadScore,
          recoveryScore,
          sources: record.sources,
          updatedAt: serverTimestamp(),
        });
      }

      return { dailyMetric: record };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function logHealthActivityFs(
  payload: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{
  activity: HealthActivity;
  stats: GameStats;
  coinsAdded: number;
  duplicate: boolean;
}> {
  const uid = assertAuthenticatedVerifiedUid(user);
  await ensureUserDocument(auth.currentUser);
  const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 140) : '';
  if (!title) {
    throw new WorkspaceValidationError(400, 'title da atividade é obrigatório.', 'invalid_activity_title');
  }

  const source = (payload.source ?? 'strava') as HealthSource;
  if (!VALID_HEALTH_SOURCES.includes(source)) {
    throw new WorkspaceValidationError(400, 'source inválido.', 'invalid_health_source');
  }

  const dateKey = assertValidDateKey(payload.dateKey, true);
  const durationMinutes = Math.min(1440, Math.max(1, Math.round(Number(payload.durationMinutes ?? 30))));
  const distanceKm = Math.min(1000, Math.max(0, Number(Number(payload.distanceKm ?? 0).toFixed(2))));
  const calories = Math.min(30000, Math.max(0, Math.round(Number(payload.calories ?? durationMinutes * 8))));
  const elevationGainM = Math.min(20000, Math.max(0, Math.round(Number(payload.elevationGainM ?? 0))));
  const sportType =
    typeof payload.sportType === 'string' && payload.sportType.trim()
      ? payload.sportType.trim().slice(0, 60)
      : 'Run';

  const avgHeartRate =
    payload.avgHeartRate !== undefined && payload.avgHeartRate !== null
      ? Math.min(240, Math.max(25, Math.round(Number(payload.avgHeartRate))))
      : null;
  const maxHeartRate =
    payload.maxHeartRate !== undefined && payload.maxHeartRate !== null
      ? Math.min(250, Math.max(25, Math.round(Number(payload.maxHeartRate))))
      : null;

  let zoneMinutes: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (Array.isArray(payload.zoneMinutes) && payload.zoneMinutes.length === 5) {
    zoneMinutes = [
      Math.max(0, Math.round(Number(payload.zoneMinutes[0]) || 0)),
      Math.max(0, Math.round(Number(payload.zoneMinutes[1]) || 0)),
      Math.max(0, Math.round(Number(payload.zoneMinutes[2]) || 0)),
      Math.max(0, Math.round(Number(payload.zoneMinutes[3]) || 0)),
      Math.max(0, Math.round(Number(payload.zoneMinutes[4]) || 0)),
    ];
  }

  const hrSamplePoints = Array.isArray(payload.hrSamplePoints)
    ? payload.hrSamplePoints
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 25 && n <= 250)
        .slice(0, MAX_HR_SAMPLE_POINTS)
    : [];

  const xpAwarded = calculateActivityXp(durationMinutes, distanceKm, sportType);
  const nowIso = new Date().toISOString();
  const rawExternalId =
    typeof payload.externalId === 'string' && payload.externalId.trim()
      ? payload.externalId.trim().slice(0, 128)
      : '';
  const rawId =
    typeof payload.id === 'string' && VALID_ID_REGEX.test(payload.id.trim()) ? payload.id.trim() : '';

  const fallbackStableId = `${source}_${dateKey}_${durationMinutes}_${distanceKm.toFixed(2)}_${sportType
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40)}`.slice(0, 120);

  const sanitizedExternalId = rawExternalId
    ? rawExternalId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
    : '';
  const actId =
    rawId ||
    (sanitizedExternalId && VALID_ID_REGEX.test(sanitizedExternalId)
      ? sanitizedExternalId
      : fallbackStableId);
  const externalId = rawExternalId || actId;

  const activity: HealthActivity = {
    id: actId,
    userId: uid,
    externalId,
    source,
    title,
    sportType,
    dateKey,
    startedAt:
      typeof payload.startedAt === 'string' && payload.startedAt.trim()
        ? payload.startedAt.trim().slice(0, 64)
        : `${dateKey}T12:00:00Z`,
    durationMinutes,
    distanceKm,
    calories,
    elevationGainM,
    avgHeartRate,
    maxHeartRate,
    zoneMinutes,
    hrSamplePoints,
    xpAwarded,
    createdAt: nowIso,
  };

  const actPath = `users/${uid}/healthActivities/${actId}`;
  const actRef = doc(db, 'users', uid, 'healthActivities', actId);
  const statsRef = doc(db, 'users', uid, 'gameStats', 'main');

  try {
    const existingActivities = await queryUserSubcollection(
      uid,
      'healthActivities',
      mapHealthActivityDoc,
      400
    );
    const sameIdentity = existingActivities.find(
      (a) => a.source === source && a.externalId === externalId
    );

    return await runTransaction(db, async (tx) => {
      const [actSnap, statsSnap] = await Promise.all([tx.get(actRef), tx.get(statsRef)]);
      const currentStats = statsSnap.exists()
        ? mapGameStatsDoc(statsSnap.data(), uid)
        : normalizeGameStats(createInitialGameStats(uid));

      if (actSnap.exists()) {
        const existing = mapHealthActivityDoc(actSnap.data(), actId, uid);
        if (existing.source !== source || existing.externalId !== externalId) {
          throw new WorkspaceValidationError(
            409,
            'Identificador já associado a outra atividade.',
            'activity_id_conflict'
          );
        }
        return { activity: existing, stats: currentStats, coinsAdded: 0, duplicate: true };
      }

      if (sameIdentity) {
        return { activity: sameIdentity, stats: currentStats, coinsAdded: 0, duplicate: true };
      }

      const nextXp = Math.min(MAX_TOTAL_XP, currentStats.totalXp + xpAwarded);
      const coinsAdded = Math.max(10, Math.round(xpAwarded * 0.25));
      const streakInfo = calculateNextStreak(
        currentStats.currentStreak,
        currentStats.longestStreak,
        currentStats.lastWorkoutDate,
        dateKey
      );
      const wt = mapSportToWorkoutType(sportType);

      const updatedStats = normalizeGameStats({
        ...currentStats,
        totalXp: nextXp,
        level: calculateLevel(nextXp),
        goldCoins: Math.min(MAX_GOLD_COINS, (currentStats.goldCoins ?? 0) + coinsAdded),
        totalCoinsEarned: Math.min(MAX_TOTAL_COINS_EARNED, (currentStats.totalCoinsEarned ?? 0) + coinsAdded),
        currentStreak: streakInfo.currentStreak,
        longestStreak: streakInfo.longestStreak,
        lastWorkoutDate:
          !currentStats.lastWorkoutDate || dateKey > currentStats.lastWorkoutDate
            ? dateKey
            : currentStats.lastWorkoutDate,
        totalMinutes: currentStats.totalMinutes + durationMinutes,
        cardioWorkouts: currentStats.cardioWorkouts + (wt === 'cardio' ? 1 : 0),
        forcaWorkouts: currentStats.forcaWorkouts + (wt === 'forca' ? 1 : 0),
        hiitWorkouts: currentStats.hiitWorkouts + (wt === 'hiit' ? 1 : 0),
        coreWorkouts: currentStats.coreWorkouts + (wt === 'core' ? 1 : 0),
        mobilidadeWorkouts: currentStats.mobilidadeWorkouts + (wt === 'mobilidade' ? 1 : 0),
        corpoInteiroWorkouts: currentStats.corpoInteiroWorkouts + (wt === 'corpo_inteiro' ? 1 : 0),
        updatedAt: nowIso,
      });

      tx.set(actRef, { ...activity, createdAt: serverTimestamp() });
      tx.set(statsRef, buildGameStatsPayload(updatedStats, uid));

      const ledger = buildLedgerEntryData(uid, currentStats, updatedStats, 'health_activity', title);
      tx.set(doc(db, 'users', uid, 'progressLedger', ledger.id), ledger.data);

      return { activity, stats: updatedStats, coinsAdded, duplicate: false };
    });
  } catch (err) {
    if (err instanceof WorkspaceValidationError) throw err;
    if (isFirestorePermissionOrRuleError(err)) {
      handleFirestoreError(err, OperationType.WRITE, actPath);
    }
    throw err;
  }
}

export async function dispatchWorkspaceCommandFs<TResult = unknown>(
  action: string,
  payload: Record<string, unknown>,
  user?: AppAuthUser | null
): Promise<{ action: string; result: TResult }> {
  let result: unknown;
  switch (action) {
    case 'get_state':
      result = await getFullSystemStateFs(user);
      break;
    case 'update_hero':
      result = await updateHeroProfileFs(payload as Parameters<typeof updateHeroProfileFs>[0], user);
      break;
    case 'grant_stats':
      result = await grantStatsFs(payload as Parameters<typeof grantStatsFs>[0], user);
      break;
    case 'create_workout':
      result = await createWorkoutFs(payload, user);
      break;
    case 'update_workout':
      result = await updateWorkoutFs(String(payload.workoutId ?? ''), payload, user);
      break;
    case 'delete_workout':
      result = await deleteWorkoutFs(String(payload.workoutId ?? ''), user);
      break;
    case 'complete_workout':
      result = await completeWorkoutFs(String(payload.workoutId ?? ''), payload, user);
      break;
    case 'purchase_gear':
      result = await purchaseGearFs(String(payload.itemId ?? ''), payload.equip !== false, user);
      break;
    case 'equip_gear':
      result = await equipGearFs(payload as Parameters<typeof equipGearFs>[0], user);
      break;
    case 'save_loadout':
      result = await saveLoadoutFs(
        String(payload.name ?? ''),
        payload.gear as EquippedGear | undefined,
        user
      );
      break;
    case 'apply_loadout':
      result = await applyLoadoutFs(String(payload.loadoutId ?? ''), user);
      break;
    case 'delete_loadout':
      result = await deleteLoadoutFs(String(payload.loadoutId ?? ''), user);
      break;
    case 'create_vow':
      result = await createVowFs(payload as Parameters<typeof createVowFs>[0], user);
      break;
    case 'complete_vow':
      result = await resolveVowFs(
        String(payload.vowId ?? ''),
        'complete',
        typeof payload.dateKey === 'string' ? payload.dateKey : undefined,
        user
      );
      break;
    case 'violate_vow':
      result = await resolveVowFs(
        String(payload.vowId ?? ''),
        'violate',
        typeof payload.dateKey === 'string' ? payload.dateKey : undefined,
        user
      );
      break;
    case 'delete_vow':
      result = await deleteVowFs(String(payload.vowId ?? ''), user);
      break;
    case 'claim_daily_quest':
      result = await claimDailyQuestFs(
        payload.questId as AnyAutoQuestId,
        typeof payload.dateKey === 'string' ? payload.dateKey : undefined,
        user
      );
      break;
    case 'log_weight':
      result = await logWeightFs(payload as Parameters<typeof logWeightFs>[0], user);
      break;
    case 'log_health_metric':
      result = await logHealthMetricsFs(payload, user);
      break;
    case 'log_health_activity':
      result = await logHealthActivityFs(payload, user);
      break;
    default:
      throw new WorkspaceValidationError(400, `Ação desconhecida: ${action}`, 'unknown_command_action');
  }
  return { action, result: result as TResult };
}
