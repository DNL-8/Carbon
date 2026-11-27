// Fitness RPG & Saúde - Saúde e Métricas
// Funções re-exportadas da versão original rpgLogic.ts

// Re-exportar constantes importantes
export { 
  MAX_CLAIMED_AUTO_QUEST_KEYS,
  MAX_GOLD_COINS,
  MAX_HR_SAMPLE_POINTS,
  MAX_TOTAL_COINS_EARNED,
  MAX_TOTAL_XP,
  MAX_OWNED_EQUIPMENT_IDS,
} from '../rpgLogic.ts';

// Re-exportar funções da versão original
export { calculateNextStreak, computeRecoveryAssessment } from '../rpgLogic.ts';

// Funções auxiliares que são únicas deste módulo
export function getLocalDateKey(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function diffInCalendarDays(fromDateKey: string, toDateKey: string): number {
  const from = new Date(fromDateKey);
  const to = new Date(toDateKey);
  const diffTime = Math.abs(to.getTime() - from.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function parseDateKeyLocalNoon(dateInput?: Date | string): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  const [y, m, d] = dateInput.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function getIsoWeekKey(dateInput?: Date | string): string {
  const local = parseDateKeyLocalNoon(dateInput);
  const utc = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getIsoWeekDateRange(dateInput?: Date | string): {
  weekKey: string;
  startDateKey: string;
  endDateKey: string;
} {
  const local = parseDateKeyLocalNoon(dateInput);
  const jsDay = local.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + mondayOffset,
    12,
    0,
    0
  );
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6,
    12,
    0,
    0
  );
  return {
    weekKey: getIsoWeekKey(local),
    startDateKey: getLocalDateKey(monday),
    endDateKey: getLocalDateKey(sunday),
  };
}

export function getEffectiveCurrentStreak(
  storedStreak: number,
  lastWorkoutDate: string | null,
  todayKey: string = getLocalDateKey()
): number {
  if (!lastWorkoutDate || storedStreak <= 0) {
    return 0;
  }
  const diff = diffInCalendarDays(lastWorkoutDate, todayKey);
  if (diff <= 1) {
    return storedStreak;
  }
  return 0;
}

export function mapSportToWorkoutType(sport: string): string {
  const mapping: Record<string, string> = {
    'running': 'cardio',
    'swimming': 'cardio',
    'cycling': 'cardio',
    'weightlifting': 'forca',
    'yoga': 'mobilidade',
    'hiking': 'corpo_inteiro',
  };
  return mapping[sport] || 'cardio';
}

export function calculateActivityXp(
  durationMinutes: number,
  intensity: string
): number {
  const baseXp = durationMinutes * 5;
  const multiplier = { low: 1, medium: 2, high: 3 }[intensity] ?? 1;
  return Math.max(1, Math.round(baseXp * multiplier));
}

export function computeBmiSummary(
  heightCm: number | undefined,
  weightKg: number | undefined
): { bmi: number | null; category: string | null; heightCm: number | undefined; weightKg: number | undefined } {
  if (heightCm === undefined || weightKg === undefined) {
    return { bmi: null, category: null, heightCm: undefined, weightKg: undefined };
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let category: string | null = null;
  if (bmi < 18.5) category = 'Abaixo do peso';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Sobrepeso';
  else category = 'Obesidade';
  return { bmi: Math.round(bmi * 10) / 10, category, heightCm, weightKg };
}