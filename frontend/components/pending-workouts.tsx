'use client'

import { useEffect, useState } from 'react'
import { Alert, Button } from '@mui/material'
import { api, read, rewardResult, type Reward } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { listPendingWorkouts, removePendingWorkout, type PendingWorkout } from '../lib/pending-workouts'

export function PendingWorkouts({ owner, onSaved }: { owner: string; onSaved: (name: string, reward: Reward) => void }) {
  const [entries, setEntries] = useState<PendingWorkout[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const load = () => setEntries(listPendingWorkouts(owner))
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [owner])

  async function resend(entry: PendingWorkout) {
    if (busy || entry.owner !== owner) return
    setBusy(true); setError('')
    try {
      const reward = read(await api.POST('/api/treinos/concluir', {
        body: entry.body, headers: { 'x-murim-owner': owner },
      }), rewardResult)
      removePendingWorkout(owner, entry.body.id)
      setEntries(listPendingWorkouts(owner))
      onSaved(entry.name, reward)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  if (!entries.length) return null
  return <section className="surface overview" aria-labelledby="pending-title">
    <h2 id="pending-title">Treinos pendentes</h2>
    <p>Envios ainda não confirmados neste navegador. O mesmo identificador impede XP duplicado.</p>
    {error && <Alert severity="error">{error}</Alert>}
    <ul className="list">{entries.map(entry => <li key={entry.body.id}>
      <span>{entry.name}</span>
      <Button disabled={busy} onClick={() => void resend(entry)}>Reenviar treino pendente</Button>
      <Button color="error" disabled={busy} onClick={() => {
        if (window.confirm('Descartar somente a cópia local? O treino pode já ter sido salvo no servidor.')) {
          removePendingWorkout(owner, entry.body.id)
          setEntries(listPendingWorkouts(owner))
        }
      }}>Descartar cópia local</Button>
    </li>)}</ul>
  </section>
}
