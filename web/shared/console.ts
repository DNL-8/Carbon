export type ConsoleMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export interface ConsoleOperation { id: string, label: string, path: string, group: string, method: ConsoleMethod, example?: Record<string, unknown>, param?: boolean, note?: string }
export const consoleOperations: readonly ConsoleOperation[] = [
  { id: 'health', label: 'Health check', path: '/api/health', group: 'Sistema', method: 'GET' },
  { id: 'ready', label: 'Prontidão', path: '/api/ready', group: 'Sistema', method: 'GET' },
  { id: 'account', label: 'Conta autenticada', path: '/api/conta', group: 'Sistema', method: 'GET' },
  { id: 'state', label: 'Snapshot global', path: '/api/estado', group: 'Sistema', method: 'GET' },
  { id: 'progress', label: 'Estado de progresso', path: '/api/progresso', group: 'RPG', method: 'GET' },
  { id: 'panel', label: 'Atributos, recuperação e evolução', path: '/api/painel', group: 'RPG', method: 'GET' },
  { id: 'hero', label: 'Ficha do herói', path: '/api/heroi', group: 'RPG', method: 'GET' },
  { id: 'hero-edit', label: 'Atualizar ficha', path: '/api/heroi', group: 'RPG', method: 'PUT', example: {} },
  { id: 'quest', label: 'Missões de hoje', path: '/api/missao', group: 'Votos & Missões', method: 'GET' },
  { id: 'quest-claim', label: 'Resgatar missão', path: '/api/missao', group: 'Votos & Missões', method: 'POST', example: { id: 'workout_today' } },
  { id: 'achievements', label: 'Conquistas', path: '/api/conquistas', group: 'RPG', method: 'GET' },
  { id: 'vows', label: 'Votos', path: '/api/votos', group: 'Votos & Missões', method: 'GET' },
  { id: 'vow-create', label: 'Criar voto', path: '/api/votos', group: 'Votos & Missões', method: 'POST', example: { action: 'create', id: '', title: '' } },
  { id: 'vow-complete', label: 'Cumprir voto', path: '/api/votos', group: 'Votos & Missões', method: 'POST', example: { action: 'complete', id: '' } },
  { id: 'vow-violate', label: 'Registrar falha de voto', path: '/api/votos', group: 'Votos & Missões', method: 'POST', example: { action: 'violate', id: '' } },
  { id: 'vow-delete', label: 'Excluir voto', path: '/api/votos', group: 'Votos & Missões', method: 'POST', example: { action: 'delete', id: '' } },
  { id: 'ledger', label: 'Extrato', path: '/api/extrato', group: 'RPG', method: 'GET' },
  { id: 'gear', label: 'Catálogo do arsenal', path: '/api/arsenal', group: 'Arsenal', method: 'GET' },
  { id: 'gear-buy', label: 'Comprar equipamento', path: '/api/arsenal', group: 'Arsenal', method: 'POST', example: { action: 'buy', id: '' } },
  { id: 'gear-equip', label: 'Equipar peça', path: '/api/arsenal', group: 'Arsenal', method: 'POST', example: { action: 'equip', id: '' } },
  { id: 'loadouts', label: 'Conjuntos', path: '/api/arsenal/conjuntos', group: 'Arsenal', method: 'GET' },
  { id: 'loadout-save', label: 'Salvar preset', path: '/api/arsenal/conjuntos', group: 'Arsenal', method: 'POST', example: { action: 'save', id: '', name: '' } },
  { id: 'loadout-apply', label: 'Aplicar preset', path: '/api/arsenal/conjuntos', group: 'Arsenal', method: 'POST', example: { action: 'apply', id: '' } },
  { id: 'loadout-delete', label: 'Excluir preset', path: '/api/arsenal/conjuntos', group: 'Arsenal', method: 'POST', example: { action: 'delete', id: '' } },
  { id: 'catalog', label: 'Catálogo de treinos', path: '/api/catalogo', group: 'Treinos', method: 'GET' },
  { id: 'history', label: 'Histórico e recordes', path: '/api/treinos/historico', group: 'Treinos', method: 'GET' },
  { id: 'custom', label: 'Treinos personalizados', path: '/api/treinos/personalizados', group: 'Treinos', method: 'GET' },
  { id: 'custom-save', label: 'Criar ou atualizar treino', path: '/api/treinos/personalizados/:id', group: 'Treinos', method: 'PUT', param: true, example: { name: '', description: '', type: 'forca', durationMinutes: 30, exercises: [{ name: '', prescription: '' }] } },
  { id: 'custom-delete', label: 'Excluir treino personalizado', path: '/api/treinos/personalizados/:id', group: 'Treinos', method: 'DELETE', param: true },
  { id: 'finish', label: 'Registrar sessão realizada', path: '/api/treinos/concluir', group: 'Treinos', method: 'POST', example: { id: '', workoutId: '', elapsedSeconds: 0, sets: [] }, note: 'Informe somente séries realmente executadas. O servidor calcula recompensas.' },
  { id: 'health-summary', label: 'Resumo de saúde', path: '/api/saude/resumo', group: 'Saúde', method: 'GET' },
  { id: 'weight', label: 'Registrar peso', path: '/api/saude/peso', group: 'Saúde', method: 'PUT', example: { kg: null, dateKey: '' } },
  { id: 'weight-delete', label: 'Excluir pesagem', path: '/api/saude/peso', group: 'Saúde', method: 'DELETE', example: { dateKey: '' } },
  { id: 'import', label: 'Importar registros de saúde', path: '/api/saude/importar', group: 'Saúde', method: 'POST', example: { source: 'csv', activities: [], dailyMetrics: [] } },
  { id: 'oracle', label: 'Perguntar ao Oráculo', path: '/api/oracle/ask', group: 'Integrações', method: 'POST', example: { question: '', includeHealth: false }, note: 'Se includeHealth for true, os dados de saúde autorizados serão enviados ao Gemini.' },
]
export function consolePath(operation: ConsoleOperation, id: string) {
  if (!operation.param) return operation.path
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw Error('Informe um UUID válido.')
  return operation.path.replace(':id', id)
}
