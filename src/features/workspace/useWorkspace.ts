import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  readCachedWorkoutLogs,
  writeCachedWorkoutLogs,
} from '../../services/workspaceCache';
import { db, handleFirestoreError, OperationType } from '../../services/firebase';
import {
  mapAchievementDoc,
  mapChatMessageDoc,
  mapDailyHealthMetricDoc,
  mapDailyVowDoc,
  mapExercisePrDoc,
  mapGameStatsDoc,
  mapHealthActivityDoc,
  mapHeroProfileDoc,
  mapWeightLogDoc,
  mapWorkoutLogDoc,
  mapWorkoutTemplateDoc,
} from '../../services/firestoreWorkspace';
import type { AppAuthUser } from '../../types/auth';
import type {
  ChatMessage,
  DailyHealthMetric,
  DailyVow,
  ExercisePrRecord,
  GameStats,
  HealthActivity,
  HeroProfile,
  UserAchievement,
  WeightLog,
  WorkoutLog,
  WorkoutTemplate,
} from '../../types/fitness';
import { getFriendlyErrorMessage } from '../../utils/errors';
import {
  createInitialGameStats,
  mergeWithInitialWorkouts,
  normalizeGameStats,
} from '../../utils/rpgLogic';

type ProfileLoad = { status: 'loading' | 'ready' } | { status: 'error'; message: string };

const REQUIRED_LISTENER_KEYS = [
  'hero',
  'stats',
  'workouts',
  'workoutLogs',
  'exercisePrs',
  'dailyVows',
  'healthActivities',
  'dailyHealthMetrics',
  'weightLogs',
  'achievements',
  'chatMessages',
] as const;

export function useWorkspace(user: AppAuthUser) {
  const { uid } = user;
  const [profileLoad, setProfileLoad] = useState<ProfileLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [heroProfile, setHeroProfile] = useState<HeroProfile | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutTemplate[]>(() => mergeWithInitialWorkouts([], uid));
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [healthActivities, setHealthActivities] = useState<HealthActivity[]>([]);
  const [dailyHealthMetrics, setDailyHealthMetrics] = useState<DailyHealthMetric[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [dailyVows, setDailyVows] = useState<DailyVow[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [exercisePrs, setExercisePrs] = useState<ExercisePrRecord[]>([]);

  const retryProfile = useCallback(() => {
    setProfileLoad({ status: 'loading' });
    setGlobalError(null);
    setAttempt((value) => value + 1);
  }, []);

  const refreshHistory = useCallback(() => {
    setHistoryError(null);
    setWorkoutLogs((prev) =>
      [...prev].sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGlobalError(null);
    setHistoryError(null);
    setProfileLoad({ status: 'loading' });

    const settled = new Set<string>();
    const markSettled = (key: string) => {
      if (cancelled) return;
      settled.add(key);
      if (settled.size >= REQUIRED_LISTENER_KEYS.length) {
        setProfileLoad({ status: 'ready' });
        setGlobalError(null);
      }
    };

    const reportSnapshotError = (op: OperationType, path: string, err: unknown, isCritical: boolean) => {
      if (cancelled) return;
      try {
        handleFirestoreError(err, op, path);
      } catch {
        // O log estruturado Firestore Error já foi emitido em console.error
      }
      const message = getFriendlyErrorMessage(err);
      if (isCritical) {
        setProfileLoad((previous) =>
          previous.status === 'ready' ? previous : { status: 'error', message }
        );
      }
      setGlobalError(message);
    };

    void readCachedWorkoutLogs<WorkoutLog>(uid).then((cached) => {
      if (!cancelled && cached && cached.length > 0) {
        setWorkoutLogs((prev) => (prev.length === 0 ? cached : prev));
      }
    });

    const unsubscribes: Array<() => void> = [];

    // 1. Perfil do Herói
    const heroPath = `users/${uid}/heroProfiles/main`;
    unsubscribes.push(
      onSnapshot(
        doc(db, 'users', uid, 'heroProfiles', 'main'),
        (snap) => {
          if (cancelled) return;
          setHeroProfile(snap.exists() ? mapHeroProfileDoc(snap.data(), uid) : null);
          markSettled('hero');
        },
        (err) => reportSnapshotError(OperationType.GET, heroPath, err, true)
      )
    );

    // 2. Game Stats
    const statsPath = `users/${uid}/gameStats/main`;
    unsubscribes.push(
      onSnapshot(
        doc(db, 'users', uid, 'gameStats', 'main'),
        (snap) => {
          if (cancelled) return;
          setGameStats(
            snap.exists()
              ? mapGameStatsDoc(snap.data(), uid)
              : normalizeGameStats(createInitialGameStats(uid))
          );
          markSettled('stats');
        },
        (err) => reportSnapshotError(OperationType.GET, statsPath, err, true)
      )
    );

    // 3. Treinos (sem orderBy para evitar necessidade de índice composto)
    const workoutsPath = `users/${uid}/workouts`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'workouts'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const mapped = snap.docs.map((d) => mapWorkoutTemplateDoc(d.data(), d.id, uid));
          setWorkouts(mergeWithInitialWorkouts(mapped, uid));
          markSettled('workouts');
        },
        (err) => reportSnapshotError(OperationType.LIST, workoutsPath, err, false)
      )
    );

    // 4. Histórico de Treinos Concluídos (limit 300, ordenado em memória)
    const logsPath = `users/${uid}/workoutLogs`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'workoutLogs'), where('userId', '==', uid), limit(300)),
        (snap) => {
          if (cancelled) return;
          const logs = snap.docs
            .map((d) => mapWorkoutLogDoc(d.data(), d.id, uid))
            .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
          setWorkoutLogs(logs);
          setHistoryError(null);
          void writeCachedWorkoutLogs(uid, logs);
          markSettled('workoutLogs');
        },
        (err) => {
          if (cancelled) return;
          setHistoryError(getFriendlyErrorMessage(err));
          reportSnapshotError(OperationType.LIST, logsPath, err, false);
        }
      )
    );

    // 5. Recordes Pessoais (PRs)
    const prsPath = `users/${uid}/exercisePrs`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'exercisePrs'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const prs = snap.docs
            .map((d) => mapExercisePrDoc(d.data(), d.id, uid))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          setExercisePrs(prs);
          markSettled('exercisePrs');
        },
        (err) => reportSnapshotError(OperationType.LIST, prsPath, err, false)
      )
    );

    // 6. Votos Diários
    const vowsPath = `users/${uid}/dailyVows`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'dailyVows'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const vows = snap.docs
            .map((d) => mapDailyVowDoc(d.data(), d.id, uid))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          setDailyVows(vows);
          markSettled('dailyVows');
        },
        (err) => reportSnapshotError(OperationType.LIST, vowsPath, err, false)
      )
    );

    // 7. Atividades de Saúde
    const activitiesPath = `users/${uid}/healthActivities`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'healthActivities'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const activities = snap.docs
            .map((d) => mapHealthActivityDoc(d.data(), d.id, uid))
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          setHealthActivities(activities);
          markSettled('healthActivities');
        },
        (err) => reportSnapshotError(OperationType.LIST, activitiesPath, err, false)
      )
    );

    // 8. Métricas Diárias de Saúde
    const metricsPath = `users/${uid}/dailyHealthMetrics`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'dailyHealthMetrics'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const metrics = snap.docs
            .map((d) => mapDailyHealthMetricDoc(d.data(), d.id, uid))
            .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
          setDailyHealthMetrics(metrics);
          markSettled('dailyHealthMetrics');
        },
        (err) => reportSnapshotError(OperationType.LIST, metricsPath, err, false)
      )
    );

    // 9. Registros de Peso
    const weightsPath = `users/${uid}/weightLogs`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'weightLogs'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const weights = snap.docs
            .map((d) => mapWeightLogDoc(d.data(), d.id, uid))
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
          setWeightLogs(weights);
          markSettled('weightLogs');
        },
        (err) => reportSnapshotError(OperationType.LIST, weightsPath, err, false)
      )
    );

    // 10. Conquistas
    const achievementsPath = `users/${uid}/achievements`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'achievements'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          setUserAchievements(snap.docs.map((d) => mapAchievementDoc(d.data(), d.id, uid)));
          markSettled('achievements');
        },
        (err) => reportSnapshotError(OperationType.LIST, achievementsPath, err, false)
      )
    );

    // 11. Mensagens do Oráculo
    const chatPath = `users/${uid}/chatMessages`;
    unsubscribes.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'chatMessages'), where('userId', '==', uid)),
        (snap) => {
          if (cancelled) return;
          const msgs = snap.docs
            .map((d) => mapChatMessageDoc(d.data(), d.id, uid))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          setChatMessages(msgs);
          markSettled('chatMessages');
        },
        (err) => reportSnapshotError(OperationType.LIST, chatPath, err, false)
      )
    );

    return () => {
      cancelled = true;
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  }, [uid, attempt]);

  return {
    profileLoad,
    retryProfile,
    globalError,
    setGlobalError,
    heroProfile,
    setHeroProfile,
    gameStats,
    setGameStats,
    workouts,
    setWorkouts,
    workoutLogs,
    historyError,
    refreshHistory,
    healthActivities,
    dailyHealthMetrics,
    userAchievements,
    chatMessages,
    dailyVows,
    weightLogs,
    exercisePrs,
  };
}
