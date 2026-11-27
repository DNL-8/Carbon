import type { AppAuthUser } from '../types/auth';
import type { HealthConnectDay } from '../utils/healthConnect';
import type { WorkspaceSnapshot } from '../types/workspace';
import {
  ARSENAL_CONFIG,
  EQUIPMENT_CATALOG,
  EQUIPMENT_SETS,
  EXAMPLE_LOADOUT_PRESETS,
  buildZoneTotals,
  calculateDerivedAttributes,
  calculateGearBonusSummary,
  computeBmiSummary,
  computeRecoveryAssessment,
  getDualProgressionStatus,
  getEffectiveCurrentStreak,
  getLevelProgress,
  getLocalDateKey,
  mergeWithInitialWorkouts,
} from '../utils/rpgLogic';
import { auth } from './firebase';
import {
  getAccountSecurityInfo,
  getClientAuthState,
  refreshClientAuthToken,
  setOrUpdateAccountPassword,
} from './authClient';
import {
  WorkspaceValidationError,
  applyLoadoutFs,
  claimDailyQuestFs,
  completeWorkoutFs,
  createVowFs,
  createWorkoutFs,
  createWorkspaceHeroFs,
  deleteLoadoutFs,
  deleteVowFs,
  deleteWeightLogFs,
  deleteWorkoutFs,
  dispatchWorkspaceCommandFs,
  equipGearFs,
  getArmoryStateFs,
  getDailyQuestsFs,
  getFullSystemStateFs,
  getHealthSummaryFs,
  getProgressLedgerFs,
  getWorkspaceSnapshotFs,
  grantStatsFs,
  listWorkoutLogsFs,
  logHealthActivityFs,
  logHealthMetricsFs,
  logWeightFs,
  purchaseGearFs,
  resetWorkspaceProgressFs,
  resolveVowFs,
  saveChatMessageFs,
  saveLoadoutFs,
  updateHeroProfileFs,
  updateWorkoutFs,
} from './firestoreWorkspace';
import type {
  AnyAutoQuestId,
  AutoQuestEvaluation,
  DailyHealthMetric,
  DailyVow,
  EquipmentItem,
  EquipmentSetDefinition,
  EquipmentSlot,
  EquippedGear,
  ExercisePrRecord,
  GameStats,
  GearBonusSummary,
  GearLoadoutPreset,
  HealthActivity,
  HealthSource,
  HeroClass,
  HeroExperience,
  HeroObjective,
  HeroProfile,
  HrZoneSummary,
  HunterRankProgress,
  MurimRealmProgress,
  PerformedExerciseRecord,
  RecoveryAssessment,
  SessionRewardSummary,
  UserAchievement,
  WeeklyAutoQuestEvaluation,
  WeeklyRaidBossState,
  WeightLog,
  WorkoutLog,
  WorkoutTemplate,
  WorkoutType,
} from '../types/fitness';
import type { ProgressLedgerPage } from '../types/progressLedger';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiDomainGroup =
  | 'global'
  | 'account'
  | 'hero'
  | 'workouts'
  | 'arsenal'
  | 'vows'
  | 'health'
  | 'oracle';

export interface ApiRouteDefinition {
  id: string;
  domain: ApiDomainGroup;
  method: HttpMethod;
  path: string;
  requiresAuth: boolean;
  storagePaths: readonly string[];
  description: string;
}

export class ApiServiceError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code: string = 'api_error') {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.code = code;
  }
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const API_ROUTES = {
  global: {
    health: '/api/health',
    ready: '/api/ready',
    state: 'firestore://users/{uid}/state',
    command: 'firestore://users/{uid}/command',
  },
  hero: {
    profile: 'firestore://users/{uid}/heroProfiles/main',
    stats: 'firestore://users/{uid}/gameStats/main',
    ledger: 'firestore://users/{uid}/progressLedger',
    grantStats: 'firestore://users/{uid}/gameStats/main#grant',
  },
  workouts: {
    list: 'firestore://users/{uid}/workouts',
    create: 'firestore://users/{uid}/workouts',
    logs: 'firestore://users/{uid}/workoutLogs',
    byId: (workoutId: string) =>
      `firestore://users/{uid}/workouts/${encodeValidId(workoutId, 'workoutId')}`,
    complete: (workoutId: string) =>
      `firestore://users/{uid}/workouts/${encodeValidId(workoutId, 'workoutId')}/complete`,
  },
  arsenal: {
    catalog: 'local://arsenal/catalog',
    state: 'firestore://users/{uid}/gameStats/main#armory',
    purchase: 'firestore://users/{uid}/gameStats/main#purchase',
    equip: 'firestore://users/{uid}/gameStats/main#equip',
    loadouts: 'firestore://users/{uid}/gameStats/main#loadouts',
    applyLoadout: (loadoutId: string) =>
      `firestore://users/{uid}/gameStats/main#loadouts/${encodeValidId(loadoutId, 'loadoutId')}`,
    deleteLoadout: (loadoutId: string) =>
      `firestore://users/{uid}/gameStats/main#loadouts/${encodeValidId(loadoutId, 'loadoutId')}`,
  },
  vows: {
    list: 'firestore://users/{uid}/dailyVows',
    create: 'firestore://users/{uid}/dailyVows',
    byId: (vowId: string) =>
      `firestore://users/{uid}/dailyVows/${encodeValidId(vowId, 'vowId')}`,
    complete: (vowId: string) =>
      `firestore://users/{uid}/dailyVows/${encodeValidId(vowId, 'vowId')}#complete`,
    violate: (vowId: string) =>
      `firestore://users/{uid}/dailyVows/${encodeValidId(vowId, 'vowId')}#violate`,
    dailyQuests: 'firestore://users/{uid}/quests/daily',
    claimDailyQuest: (questId: AnyAutoQuestId) =>
      `firestore://users/{uid}/quests/daily/${encodeValidId(questId, 'questId')}#claim`,
  },
  health: {
    summary: 'firestore://users/{uid}/health/summary',
    weight: 'firestore://users/{uid}/weightLogs',
    metrics: 'firestore://users/{uid}/dailyHealthMetrics',
    activities: 'firestore://users/{uid}/healthActivities',
  },
  oracle: {
    ask: '/api/oracle/ask',
    loadAdjustments: '/api/oracle/load-adjustments',
    insights: '/api/reports/insights',
  },
  strava: {
    config: '/api/strava/config',
    status: '/api/strava/status',
    authUrl: '/api/strava/auth-url',
    sync: '/api/strava/sync',
    disconnect: '/api/strava/disconnect',
  },
  account: {
    security: 'firebase-auth://currentUser',
    password: 'firebase-auth://currentUser#password',
  },
} as const;

export const API_ROUTE_CATALOG: readonly ApiRouteDefinition[] = [
  {
    id: 'global.health',
    domain: 'global',
    method: 'GET',
    path: '/api/health',
    requiresAuth: false,
    storagePaths: [],
    description: 'Verifica saúde da API HTTP, Firebase Auth e Gemini server-side.',
  },
  {
    id: 'global.ready',
    domain: 'global',
    method: 'GET',
    path: '/api/ready',
    requiresAuth: false,
    storagePaths: [],
    description: 'Confirma prontidão da camada Firebase Auth + Firestore.',
  },
  {
    id: 'oracle.ask',
    domain: 'oracle',
    method: 'POST',
    path: '/api/oracle/ask',
    requiresAuth: true,
    storagePaths: ['/users/{userId}/chatMessages/{messageId}'],
    description: 'Consulta o Oráculo Gemini server-side com Firebase ID Token.',
  },
  {
    id: 'oracle.insights',
    domain: 'oracle',
    method: 'POST',
    path: '/api/reports/insights',
    requiresAuth: true,
    storagePaths: [],
    description: 'Gera análise fisiológica de relatórios com Gemini IA.',
  },
];

function encodeValidId(value: string, fieldName: string): string {
  const clean = value.trim();
  if (!VALID_ID_REGEX.test(clean)) {
    throw new ApiServiceError(
      400,
      `Identificador "${fieldName}" inválido. Use apenas letras, números, "_" ou "-".`,
      'invalid_id'
    );
  }
  return encodeURIComponent(clean);
}

function assertValidDateKey(dateKey: string): string {
  const clean = dateKey.trim();
  if (!VALID_DATE_KEY_REGEX.test(clean)) {
    throw new ApiServiceError(
      400,
      'Data inválida. Utilize o formato YYYY-MM-DD.',
      'invalid_date_key'
    );
  }
  return clean;
}

async function wrapFirestore<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiServiceError) throw err;
    if (err instanceof WorkspaceValidationError) {
      throw new ApiServiceError(err.status, err.message, err.code);
    }
    throw err;
  }
}

export interface ValidatedUserSession {
  user: AppAuthUser;
  uid: string;
  token: string;
}

/**
 * Garante que existe usuário autenticado via Firebase Auth com e-mail verificado
 * e retorna o ID Token JWT válido da sessão.
 */
export async function validateAndGetAuthSession(
  options: { user?: AppAuthUser | null; forceRefresh?: boolean } = {}
): Promise<ValidatedUserSession> {
  let state = getClientAuthState();
  const currentFb = auth.currentUser;

  if (options.forceRefresh || !state.user || !state.apiToken) {
    state = await refreshClientAuthToken(options.forceRefresh ?? false);
  }

  let token = state.apiToken;
  if ((!token || token.split('.').length !== 3) && currentFb) {
    try {
      token = await currentFb.getIdToken(options.forceRefresh ?? false);
    } catch {
      token = null;
    }
  }

  const activeUser = options.user ?? state.user;
  if (!activeUser || (state.user && state.user.uid !== activeUser.uid)) {
    throw new ApiServiceError(
      401,
      'Usuário não autenticado. Faça login antes de enviar comandos para a API.',
      'unauthenticated'
    );
  }

  if (activeUser.emailVerified !== true) {
    throw new ApiServiceError(
      403,
      'Sua conta precisa estar com o e-mail verificado para acessar os dados do aplicativo.',
      'email_not_verified'
    );
  }

  if (!token || token.split('.').length !== 3) {
    throw new ApiServiceError(
      401,
      'Não foi possível obter um ID Token válido do Firebase Auth.',
      'invalid_token'
    );
  }

  return {
    user: activeUser,
    uid: activeUser.uid,
    token,
  };
}

export async function fetchStrava(
  route: 'auth-url' | 'status' | 'sync' | 'disconnect',
  options: RequestInit = {}
): Promise<Response> {
  return fetchAuthenticatedApi(`/api/strava/${route}`, options);
}

export async function fetchAuthenticatedApi(
  path: string,
  options: RequestInit = {},
  user: AppAuthUser | null = getClientAuthState().user
): Promise<Response> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new ApiServiceError(400, 'Endereço de API inválido.', 'invalid_api_url');
  }
  const signal = options.signal ?? AbortSignal.timeout(30_000);
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  const send = async (forceRefresh: boolean) => {
    const { token } = await validateAndGetAuthSession({ user, forceRefresh });
    signal.throwIfAborted();
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal,
      redirect: 'error',
    });
  };
  const response = await send(false);
  if (response.status !== 401) return response;
  await response.body?.cancel();
  return send(true);
}

interface RequestOptions {
  signal?: AbortSignal;
  method?: HttpMethod;
  body?: unknown;
  requiresAuth?: boolean;
  user?: AppAuthUser | null;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Cliente HTTP para as rotas server-side (/api/health, /api/oracle/*, /api/reports/*, /api/strava/*).
 * Injeta o Firebase ID Token em `Authorization: Bearer <token>` e renova em 401.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method: HttpMethod = options.method ?? 'GET';
  const requiresAuth = options.requiresAuth ?? true;

  const request = {
    method,
    signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  };
  const response = requiresAuth
    ? await fetchAuthenticatedApi(path, request, options.user ?? getClientAuthState().user)
    : await fetch(path, request);

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errPayload = (parsed && typeof parsed === 'object' ? parsed : {}) as {
      error?: string;
      code?: string;
    };
    throw new ApiServiceError(
      response.status,
      errPayload.error || `Erro HTTP ${response.status} ao acessar ${path}.`,
      errPayload.code || 'http_error'
    );
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    'ok' in parsed &&
    'data' in parsed &&
    (parsed as ApiEnvelope<T>).data !== undefined
  ) {
    return (parsed as ApiEnvelope<T>).data as T;
  }

  return parsed as T;
}

// ============================================================================
// TIPOS DE PAYLOAD & RESPOSTA POR DOMÍNIO
// ============================================================================

export interface FullSystemStateResponse {
  uid: string;
  todayKey: string;
  hero: HeroProfile | null;
  stats: GameStats;
  levelProgress: {
    level: number;
    isMaster: boolean;
    isMaxLevel: boolean;
    levelTitle: string;
    currentLevelMinXp: number;
    nextLevelXp: number;
    xpIntoLevel: number;
    xpNeededForNext: number;
    progressPercent: number;
  };
  dualProgression?: {
    hunter: HunterRankProgress;
    murim: MurimRealmProgress;
  };
  gearBonuses: GearBonusSummary;
  derivedAttributes: {
    forca: number;
    resistencia: number;
    agilidade: number;
    disciplina: number;
  } | null;
  recovery: RecoveryAssessment;
  autoQuests: AutoQuestEvaluation[];
  weeklyAutoQuests?: WeeklyAutoQuestEvaluation[];
  weeklyRaidBoss?: WeeklyRaidBossState;
  workoutsCount: number;
  workouts: WorkoutTemplate[];
  workoutLogs: WorkoutLog[];
  exercisePrs?: ExercisePrRecord[];
  dailyVows: DailyVow[];
  weightLogs: WeightLog[];
  dailyMetrics: DailyHealthMetric[];
  healthActivities: HealthActivity[];
  achievements: UserAchievement[];
  healthConnectStatus: HealthConnectReadStatus;
}

export type HealthConnectReadStatus = 'available' | 'partial' | 'unavailable';

export interface UpdateHeroPayload {
  name?: string;
  avatar?: string;
  heroClass?: HeroClass;
  objective?: HeroObjective;
  experience?: HeroExperience;
  heightCm?: number | null;
  weightKg?: number | null;
  restingHrBaseline?: number;
  maxHrEstimated?: number;
}

export interface GrantStatsPayload {
  xpDelta?: number;
  coinsDelta?: number;
  hpDelta?: number;
  bossesDelta?: number;
}

export interface CreateWorkoutPayload {
  id?: string;
  name: string;
  description?: string;
  type: WorkoutType;
  difficulty?: HeroExperience;
  durationMinutes?: number;
  baseXp?: number;
  rank?: WorkoutTemplate['rank'];
  exercises: Array<{
    id?: string;
    name: string;
    prescription?: string;
    restSeconds?: number;
    muscleGroups?: string[];
    executionTip?: string;
    equipment?: string;
    loadKg?: number;
    loadNote?: string;
    unilateral?: boolean;
  }>;
}

export interface UpdateWorkoutPayload extends Partial<CreateWorkoutPayload> {
  exerciseLoadUpdates?: Array<{ exerciseId: string; loadKg: number }>;
}

export interface CompleteWorkoutPayload {
  idempotencyKey: string;
  completedExerciseIds?: string[];
  completedExercises?: number;
  durationMinutes?: number;
  elapsedSeconds?: number;
  bossDefeated?: boolean;
  performedExercises?: PerformedExerciseRecord[];
  dateKey?: string;
}

export interface LogWeightPayload {
  weightKg: number;
  dateKey?: string;
  note?: string | null;
}

export interface LogHealthMetricsPayload {
  dateKey?: string;
  steps?: number;
  activeCalories?: number;
  sleepHours?: number;
  restingHeartRate?: number | null;
  hrvMs?: number | null;
  trainingLoadScore?: number;
  recoveryScore?: number;
  sources?: string[];
}

export interface LogHealthActivityPayload {
  id?: string;
  externalId?: string;
  title: string;
  source?: HealthSource;
  sportType?: string;
  dateKey?: string;
  startedAt?: string;
  durationMinutes?: number;
  distanceKm?: number;
  calories?: number;
  elevationGainM?: number;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  zoneMinutes?: [number, number, number, number, number];
  hrSamplePoints?: number[];
}

async function askOracleViaServer(
  question: string,
  persist: boolean = true,
  user?: AppAuthUser | null
): Promise<{
  question: string;
  reply: string;
  persisted: boolean;
  recoveryScore: number;
}> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || cleanQuestion.length > 400) {
    throw new ApiServiceError(
      400,
      'A pergunta ao Oráculo deve ter entre 1 e 400 caracteres.',
      'invalid_question'
    );
  }

  const state = await wrapFirestore(() => getFullSystemStateFs(user));
  const stats = state.stats;
  const hero = state.hero;
  const dual = getDualProgressionStatus(stats, getLocalDateKey());
  const effectiveStreak = getEffectiveCurrentStreak(stats.currentStreak, stats.lastWorkoutDate);
  const bmi = computeBmiSummary(hero?.heightCm, hero?.weightKg);
  const zoneTotals = buildZoneTotals(
    state.healthActivities,
    state.workoutLogs,
    hero?.maxHrEstimated ?? 190
  );
  const zSummary = zoneTotals.map((z) => `${z.label}: ${z.minutes} min (${z.percentage}%)`).join(' | ');

  const contextText = [
    'DADOS REAIS DO USUÁRIO:',
    `- Classe: ${hero?.heroClass ?? 'Guerreiro'} | Objetivo: ${hero?.objective ?? 'Condicionamento'} | Experiência: ${hero?.experience ?? 'Iniciante'}`,
    `- Biometria: Altura ${hero?.heightCm ? `${hero.heightCm} cm` : 'não informada'} | Peso ${hero?.weightKg ? `${hero.weightKg} kg` : 'não informado'}${bmi ? ` | IMC ${bmi.bmi} (${bmi.label})` : ''}`,
    `- Mundo Real: Nível ${state.levelProgress.level} (${dual.hunter.current.label} · ${state.levelProgress.levelTitle}) | XP: ${stats.totalXp}`,
    `- Mundo de Murim: ${dual.murim.current.name} (${dual.murim.qiPoints} Qi · Técnica: ${dual.murim.current.qiTechnique})`,
    `- Streak: ${effectiveStreak}d | Treinos RPG: ${stats.totalWorkouts} | Chefes: ${stats.bossesDefeated ?? 0} | Atividades Saúde: ${state.healthActivities.length}`,
    `- Prontidão/Recuperação: ${state.recovery.score}/100 (${state.recovery.statusLabel}) | ACWR: ${state.recovery.acwrRatio}`,
    `- Sono médio 7d: ${state.recovery.avgSleepHours ?? 'não informado'}h | FC repouso recente: ${state.recovery.latestRestingHr ?? 'não informada'} bpm`,
    `- Distribuição Zonas Cardíacas: ${zSummary}`,
  ].join('\n');

  const response = await fetchAuthenticatedApi(
    '/api/oracle/ask',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: cleanQuestion, contextText }),
    },
    user ?? getClientAuthState().user
  );

  const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string; code?: string };
  if (!response.ok || !data.reply) {
    throw new ApiServiceError(
      response.status || 502,
      data.error || 'Falha ao consultar o Oráculo Gemini.',
      data.code || 'oracle_failed'
    );
  }

  let persisted = false;
  if (persist) {
    await wrapFirestore(async () => {
      await saveChatMessageFs('user', cleanQuestion, user);
      await saveChatMessageFs('oracle', data.reply!, user);
    });
    persisted = true;
  }

  return {
    question: cleanQuestion,
    reply: data.reply,
    persisted,
    recoveryScore: state.recovery.score,
  };
}

// ============================================================================
// CLIENTE UNIFICADO (Cloud Firestore em tempo real + Firebase Auth + Server AI/Strava)
// ============================================================================

export const api = {
  workspace: {
    snapshot: (user: AppAuthUser, _signal?: AbortSignal): Promise<WorkspaceSnapshot> =>
      wrapFirestore(() => getWorkspaceSnapshotFs(user)),
    createHero: (hero: HeroProfile, user: AppAuthUser) =>
      wrapFirestore(() => createWorkspaceHeroFs(hero, user)),
    saveChat: (role: 'user' | 'oracle', content: string, user: AppAuthUser) =>
      wrapFirestore(() => saveChatMessageFs(role, content, user)),
    resetProgress: (user: AppAuthUser) =>
      wrapFirestore(() => resetWorkspaceProgressFs(user)),
  },

  account: {
    getSecurity: (user?: AppAuthUser | null) => getAccountSecurityInfo(user),
    setPassword: (
      payload: { currentPassword?: string; newPassword: string },
      _user?: AppAuthUser | null
    ) => setOrUpdateAccountPassword(payload),
  },

  routes: API_ROUTES,
  catalog: API_ROUTE_CATALOG,

  global: {
    getHealthStatus: () =>
      apiRequest<{
        ok: boolean;
        service: string;
        authMode: string;
        storageMode: string;
        geminiConfigured: boolean;
        timestamp: string;
      }>('/api/health', { method: 'GET', requiresAuth: false }),

    getFullState: (user?: AppAuthUser | null): Promise<FullSystemStateResponse> =>
      wrapFirestore(() => getFullSystemStateFs(user)),

    dispatchCommand: async <TResult = unknown>(
      action: string,
      payload: Record<string, unknown> = {},
      user?: AppAuthUser | null
    ): Promise<{ action: string; result: TResult }> => {
      if (action === 'ask_oracle') {
        const question = typeof payload.question === 'string' ? payload.question : '';
        const persist = payload.persist !== false;
        const result = await askOracleViaServer(question, persist, user);
        return { action, result: result as TResult };
      }
      return wrapFirestore(() => dispatchWorkspaceCommandFs<TResult>(action, payload, user));
    },
  },

  hero: {
    getProfile: async (user?: AppAuthUser | null) =>
      wrapFirestore(async () => {
        const state = await getFullSystemStateFs(user);
        if (!state.hero) {
          throw new ApiServiceError(404, 'Perfil do herói não encontrado.', 'hero_not_found');
        }
        return {
          hero: state.hero,
          bmi: computeBmiSummary(state.hero.heightCm, state.hero.weightKg),
        };
      }),

    updateProfile: (payload: UpdateHeroPayload, user?: AppAuthUser | null) => {
      if (payload.name !== undefined) {
        const cleanName = payload.name.trim();
        if (cleanName.length < 2 || cleanName.length > 24) {
          throw new ApiServiceError(
            400,
            'O nome do herói deve ter entre 2 e 24 caracteres.',
            'invalid_hero_name'
          );
        }
      }
      if (
        payload.heightCm !== undefined &&
        payload.heightCm !== null &&
        (payload.heightCm < 100 || payload.heightCm > 250)
      ) {
        throw new ApiServiceError(400, 'heightCm deve estar entre 100 e 250 cm.', 'invalid_height');
      }
      if (
        payload.weightKg !== undefined &&
        payload.weightKg !== null &&
        (payload.weightKg < 25 || payload.weightKg > 350)
      ) {
        throw new ApiServiceError(400, 'weightKg deve estar entre 25 e 350 kg.', 'invalid_weight');
      }
      return wrapFirestore(() => updateHeroProfileFs(payload, user));
    },

    getStats: (user?: AppAuthUser | null) =>
      wrapFirestore(async () => {
        const state = await getFullSystemStateFs(user);
        return {
          stats: state.stats,
          levelProgress: state.levelProgress,
          dualProgression: state.dualProgression,
          gearBonuses: state.gearBonuses,
          derivedAttributes: state.derivedAttributes,
        };
      }),

    getProgressLedger: (cursor?: string, _signal?: AbortSignal, user?: AppAuthUser | null): Promise<ProgressLedgerPage> =>
      wrapFirestore(() => getProgressLedgerFs(user, cursor)),

    grantStats: (payload: GrantStatsPayload, user?: AppAuthUser | null) =>
      wrapFirestore(() => grantStatsFs(payload, user)),
  },

  workouts: {
    list: (user?: AppAuthUser | null) =>
      wrapFirestore(async () => {
        const snapshot = await getWorkspaceSnapshotFs(user);
        return { workouts: mergeWithInitialWorkouts(snapshot.workouts, snapshot.hero?.userId ?? user?.uid ?? '') };
      }),

    create: (payload: CreateWorkoutPayload, user?: AppAuthUser | null) => {
      if (!payload.name || payload.name.trim().length < 2 || payload.name.trim().length > 100) {
        throw new ApiServiceError(
          400,
          'O nome do treino deve ter entre 2 e 100 caracteres.',
          'invalid_workout_name'
        );
      }
      if (!Array.isArray(payload.exercises) || payload.exercises.length < 1 || payload.exercises.length > 20) {
        throw new ApiServiceError(
          400,
          'O treino deve conter entre 1 e 20 exercícios.',
          'invalid_exercises'
        );
      }
      return wrapFirestore(() => createWorkoutFs(payload as unknown as Record<string, unknown>, user));
    },

    update: (workoutId: string, payload: UpdateWorkoutPayload, user?: AppAuthUser | null) => {
      encodeValidId(workoutId, 'workoutId');
      return wrapFirestore(() => updateWorkoutFs(workoutId, payload as unknown as Record<string, unknown>, user));
    },

    remove: (workoutId: string, user?: AppAuthUser | null) => {
      encodeValidId(workoutId, 'workoutId');
      return wrapFirestore(() => deleteWorkoutFs(workoutId, user));
    },

    complete: (
      workoutId: string,
      payload: CompleteWorkoutPayload,
      user?: AppAuthUser | null
    ) => {
      encodeValidId(workoutId, 'workoutId');
      if (payload.dateKey !== undefined) {
        assertValidDateKey(payload.dateKey);
      }
      return wrapFirestore(() => completeWorkoutFs(workoutId, payload as unknown as Record<string, unknown>, user));
    },

    listLogs: (limit = 50, user?: AppAuthUser | null, _cursor?: string, _signal?: AbortSignal) =>
      wrapFirestore(() => listWorkoutLogsFs(limit, user)),
  },

  arsenal: {
    getCatalog: async (): Promise<{
      config: Record<string, unknown>;
      sets: EquipmentSetDefinition[];
      items: EquipmentItem[];
      exampleLoadouts: GearLoadoutPreset[];
    }> => ({
      config: ARSENAL_CONFIG as unknown as Record<string, unknown>,
      sets: [...EQUIPMENT_SETS],
      items: [...EQUIPMENT_CATALOG],
      exampleLoadouts: EXAMPLE_LOADOUT_PRESETS.map((preset) => ({
        ...preset,
        gear: { ...preset.gear },
      })),
    }),

    getState: (user?: AppAuthUser | null) =>
      wrapFirestore(() => getArmoryStateFs(user)),

    purchase: (itemId: string, equip: boolean = true, user?: AppAuthUser | null) => {
      const cleanItemId = itemId.trim();
      if (!cleanItemId || cleanItemId.length > 64) {
        throw new ApiServiceError(400, 'itemId inválido.', 'invalid_item_id');
      }
      return wrapFirestore(() => purchaseGearFs(cleanItemId, equip, user));
    },

    equip: (
      payload: { slot: EquipmentSlot; itemId: string | null } | { gear: EquippedGear },
      user?: AppAuthUser | null
    ) => wrapFirestore(() => equipGearFs(payload, user)),

    saveLoadout: (name: string, gear?: EquippedGear, user?: AppAuthUser | null) => {
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 28) {
        throw new ApiServiceError(
          400,
          'O nome do loadout deve ter entre 2 e 28 caracteres.',
          'invalid_loadout_name'
        );
      }
      return wrapFirestore(() => saveLoadoutFs(cleanName, gear, user));
    },

    applyLoadout: (loadoutId: string, user?: AppAuthUser | null) => {
      encodeValidId(loadoutId, 'loadoutId');
      return wrapFirestore(() => applyLoadoutFs(loadoutId, user));
    },

    deleteLoadout: (loadoutId: string, user?: AppAuthUser | null) => {
      encodeValidId(loadoutId, 'loadoutId');
      return wrapFirestore(() => deleteLoadoutFs(loadoutId, user));
    },
  },

  vows: {
    list: (user?: AppAuthUser | null) =>
      wrapFirestore(async () => {
        const snapshot = await getWorkspaceSnapshotFs(user);
        return {
          vows: [...snapshot.dailyVows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        };
      }),

    create: (
      payload: { title: string; xpReward?: number; penaltyXp?: number },
      user?: AppAuthUser | null
    ) => {
      const cleanTitle = payload.title.trim();
      if (cleanTitle.length < 3 || cleanTitle.length > 80) {
        throw new ApiServiceError(
          400,
          'O título do voto deve ter entre 3 e 80 caracteres.',
          'invalid_vow_title'
        );
      }
      return wrapFirestore(() =>
        createVowFs(
          {
            title: cleanTitle,
            xpReward: payload.xpReward ?? 15,
            penaltyXp: payload.penaltyXp ?? 15,
          },
          user
        )
      );
    },

    complete: (vowId: string, dateKey?: string, user?: AppAuthUser | null) => {
      encodeValidId(vowId, 'vowId');
      if (dateKey !== undefined) assertValidDateKey(dateKey);
      return wrapFirestore(() => resolveVowFs(vowId, 'complete', dateKey, user));
    },

    violate: (vowId: string, dateKey?: string, user?: AppAuthUser | null) => {
      encodeValidId(vowId, 'vowId');
      if (dateKey !== undefined) assertValidDateKey(dateKey);
      return wrapFirestore(() => resolveVowFs(vowId, 'violate', dateKey, user));
    },

    remove: (vowId: string, user?: AppAuthUser | null) => {
      encodeValidId(vowId, 'vowId');
      return wrapFirestore(() => deleteVowFs(vowId, user));
    },

    getDailyQuests: (dateKey?: string, user?: AppAuthUser | null) => {
      if (dateKey !== undefined) assertValidDateKey(dateKey);
      return wrapFirestore(() => getDailyQuestsFs(dateKey, user));
    },

    claimDailyQuest: (questId: AnyAutoQuestId, dateKey?: string, user?: AppAuthUser | null) => {
      encodeValidId(questId, 'questId');
      if (dateKey !== undefined) assertValidDateKey(dateKey);
      return wrapFirestore(() => claimDailyQuestFs(questId, dateKey, user));
    },
  },

  health: {
    getSummary: (user?: AppAuthUser | null) =>
      wrapFirestore(() => getHealthSummaryFs(user)),

    logWeight: (payload: LogWeightPayload, user?: AppAuthUser | null) => {
      if (!Number.isFinite(payload.weightKg) || payload.weightKg < 25 || payload.weightKg > 350) {
        throw new ApiServiceError(
          400,
          'weightKg deve estar entre 25 e 350 kg.',
          'invalid_weight'
        );
      }
      if (payload.dateKey !== undefined) assertValidDateKey(payload.dateKey);
      return wrapFirestore(() =>
        logWeightFs(
          {
            ...payload,
            note: payload.note ? payload.note.trim().slice(0, 140) : payload.note ?? null,
          },
          user
        )
      );
    },

    deleteWeight: (dateKey: string, user?: AppAuthUser | null) => {
      assertValidDateKey(dateKey);
      return wrapFirestore(() => deleteWeightLogFs(dateKey, user));
    },

    logMetrics: (payload: LogHealthMetricsPayload, user?: AppAuthUser | null) => {
      if (payload.dateKey !== undefined) assertValidDateKey(payload.dateKey);
      return wrapFirestore(() => logHealthMetricsFs(payload as unknown as Record<string, unknown>, user));
    },

    logActivity: (payload: LogHealthActivityPayload, user?: AppAuthUser | null) => {
      const cleanTitle = payload.title.trim();
      if (!cleanTitle || cleanTitle.length > 140) {
        throw new ApiServiceError(
          400,
          'O título da atividade deve ter entre 1 e 140 caracteres.',
          'invalid_activity_title'
        );
      }
      if (payload.dateKey !== undefined) assertValidDateKey(payload.dateKey);
      return wrapFirestore(() =>
        logHealthActivityFs({ ...payload, title: cleanTitle } as unknown as Record<string, unknown>, user)
      );
    },
  },

  oracle: {
    ask: (question: string, persist: boolean = true, user?: AppAuthUser | null) =>
      askOracleViaServer(question, persist, user),
  },
} as const;
