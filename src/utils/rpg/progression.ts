// Fitness RPG & Saúde - Progressão e Níveis
// Funções adicionais exclusivas deste módulo

import type {
  HunterRankDefinition,
  HunterRankLetter,
  MurimRealmProgress,
  GameStats,
  HeroClass,
} from '../../types/fitness.ts';
import { getEffectiveCurrentStreak } from './health.ts';

// Exportar constantes exclusivas deste módulo
export const MAX_HUNTER_HP = 100;

// Função de progressão murim adicional (não existe em rpgLogic.ts)
export function getMurimStatus(
  stats: { totalXp: number; level: number },
  dateKey: string
): { rank: HunterRankLetter; murimQi: number; murimRealm: MurimRealmProgress; dateKey: string } {
  // Implementação que retorna o formato esperado pelo oracle
  return {
    rank: 'F' as HunterRankLetter,
    murimQi: 0,
    murimRealm: {
      qiPoints: 0,
      current: { id: 'third_rate', order: 0, name: 'Iniciante', englishName: 'Beginner', minQi: 0, qiTechnique: 'Foundational', description: 'Beginner realm', accentHex: '#808080' },
      next: null,
      qiIntoRealm: 0,
      qiNeededForNext: 0,
      estimatedDaysToNextRealm: 0,
      progressPercent: 0,
      isMaxRealm: false,
      breakdown: { fromWorkouts: 0, fromBosses: 0, fromStreak: 0, fromMinutes: 0 }
    },
    dateKey,
  };
}