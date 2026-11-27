import type {
  ChatMessage, DailyHealthMetric, DailyVow, ExercisePrRecord, GameStats, HealthActivity, HeroProfile,
  UserAchievement, WeightLog, WorkoutTemplate,
} from './fitness';

export interface WorkspaceSnapshot {
  hero: HeroProfile | null;
  stats: GameStats | null;
  workouts: WorkoutTemplate[];
  healthActivities: HealthActivity[];
  dailyHealthMetrics: DailyHealthMetric[];
  achievements: UserAchievement[];
  chatMessages: ChatMessage[];
  dailyVows: DailyVow[];
  weightLogs: WeightLog[];
  exercisePrs: ExercisePrRecord[];
}
