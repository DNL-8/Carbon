export async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch('/api/auth/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data: { url?: string; message?: string; statusMessage?: string; code?: string; user?: { emailVerified?: boolean } } = await response.json()
  if (!response.ok) {
    if (data.code === 'EMAIL_NOT_VERIFIED') {
      throw new Error('Verifique seu e-mail antes de entrar. Se necessário, confira o spam.')
    }
    throw new Error(data.message || data.statusMessage || 'Não foi possível acessar o Murim.')
  }
  return data
}

export function errorMessage(error: unknown) {
  return error instanceof Error && error.message !== 'Failed to fetch'
    ? error.message : 'Conexão indisponível. Tente novamente.'
}

export const sessionChangeKey = 'murim-session-change'

export function notifySessionChange() {
  try { localStorage.setItem(sessionChangeKey, crypto.randomUUID()) } catch { /* Storage may be disabled. */ }
}
