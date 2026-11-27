// Fitness RPG & Saúde - Oráculo e IA
// Extraído de src/utils/rpgLogic.ts
// Funções relacionadas ao Gemini/AI mentor

import type { GameStats } from '../../types/fitness.ts';

// --- Funções do Oráculo ---

export function buildOracleContext(
  stats: GameStats,
  prompt: string
): {
  context: string;
  limited: boolean;
} {
  // Contexto simplificado para o Gemini
  const xpInfo = `XP total: ${stats.totalXp}, nível: ${stats.level}`;
  const context = `Você é um mentor de RPG fitness. Informações do usuário: ${xpInfo}. ${prompt}`;
  
  // Simular rate limiting - limite de 1 mensagem por minuto por usuário
  const limited = false;
  
  return { context, limited };
}

export function handleOracleAsk(
  oraclePrompt: string,
  stats: GameStats
): Promise<{
  response: string;
  recoveryScore: number;
  suggestions: string[];
}> {
  // Lógica simplificada - implementação completa usa Gemini API
  return Promise.resolve({
    response: `Mensagem de orientação baseada no seu progresso: ${oraclePrompt}`,
    recoveryScore: 75,
    suggestions: ['Continue seus treinos', 'Mantenha a hidratação', 'Descanso adequado']
  });
}