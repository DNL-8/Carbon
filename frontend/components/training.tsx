'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, TextField } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import type { WorkoutTemplate } from '../../src/types/fitness'
import { parseExercisePrescription, formatSecondsMMSS } from '../../src/utils/rpgLogic'
import { completedFocusSets, initialFocusSets } from '../shared/focus'
import { getWorkoutCombat } from '../shared/boss'
import { api, number, read, rewardResult, type FinishInput, type Reward } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { WarriorAvatar, type AvatarGear } from './warrior-avatar'
import type { AvatarStyle, AvatarPreferences } from '../lib/avatar-preferences'
import { savePendingWorkout, removePendingWorkout } from '../lib/pending-workouts'
import { saveDraft, removeDraft, type WorkoutDraft } from '../lib/workout-draft'

export function Training({ owner, workout, draft, bonus, level, hp, gear, avatarStyle, appearances, onFinish, onCancel }: {
  owner: string; workout: WorkoutTemplate; draft: WorkoutDraft | null; bonus: number; level?: number; hp?: number; gear?: AvatarGear[]; avatarStyle?: AvatarStyle; appearances?: AvatarPreferences; onFinish: (reward: Reward) => void; onCancel: () => void
}) {
  const [sets, setSets] = useState(() => draft?.sets ?? initialFocusSets(workout))
  const [attack, setAttack] = useState(0)
  const [index, setIndex] = useState(draft?.index ?? 0)
  const [dialog, setDialog] = useState<'finish' | 'exit' | null>(null)
  const [elapsed, setElapsed] = useState(draft?.elapsedSeconds ?? 0)
  const [storageError, setStorageError] = useState(false)
  const [draftId] = useState(() => draft?.id ?? crypto.randomUUID())
  const [paused, setPaused] = useState(Boolean(draft))
  const [restEnd, setRestEnd] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const started = useRef(Date.now())
  const carried = useRef((draft?.elapsedSeconds ?? 0) * 1000)
  const heading = useRef<HTMLHeadingElement>(null)
  const payload = useRef<FinishInput>(null)
  const completed = completedFocusSets(sets)
  const exercise = workout.exercises[index]
  const isTimed = parseExercisePrescription(exercise.prescription).isTimeBased
  const rows = sets.map((set, position) => ({ ...set, position })).filter(set => set.exerciseId === exercise.id)
  const count = new Set(completed.map(row => row.exerciseId)).size
  const combat = getWorkoutCombat(workout, completed, elapsed, bonus)
  const remaining = Math.max(0, workout.durationMinutes * 60 - elapsed)
  const rest = Math.max(0, Math.ceil((restEnd - now) / 1000))
  const mutation = useMutation({ mutationFn: async (body: FinishInput) => read(
    await api.POST('/api/treinos/concluir', { body, headers: { 'x-murim-owner': owner } }), rewardResult,
  ) })
  const busy = mutation.isPending
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const tick = Date.now()
      setNow(tick)
      if (!paused && !locked) setElapsed(Math.min(28800, Math.floor((carried.current + tick - started.current) / 1000)))
    }, 500)
    return () => window.clearInterval(timer)
  }, [paused, locked])

  useEffect(() => {
    if (!locked) setStorageError(!saveDraft(owner, { version: 1, owner, id: draftId, workout, sets, index, elapsedSeconds: elapsed }))
  }, [owner, draftId, workout, sets, index, elapsed, locked])

  function pause() {
    if (paused) started.current = Date.now()
    else carried.current += Date.now() - started.current
    setPaused(!paused)
  }

  async function finish() {
    setDialog(null); setError('')
    if (!payload.current) {
      const duration = Math.min(28800, Math.floor((carried.current + (paused ? 0 : Date.now() - started.current)) / 1000))
      payload.current = { id: draftId, workoutId: workout.id, elapsedSeconds: duration, sets: completed }
    }
    setLocked(true)
    const body = payload.current
    const persisted = savePendingWorkout(owner, workout.name, body)
    if (persisted) removeDraft(owner, draftId)
    try {
      const reward = await mutation.mutateAsync(body)
      removeDraft(owner, draftId)
      removePendingWorkout(owner, body.id)
      onFinish(reward)
    } catch (cause) {
      setError(errorMessage(cause) + (persisted ? ' Treino pendente salvo neste navegador.' : ' Armazenamento local indisponível: não feche a página antes de reenviar.'))
    }
  }

  function update(position: number, field: 'weightKg' | 'reps', value: string) {
    setSets(items => items.map((item, i) => i === position ? { ...item, [field]: value === '' ? 0 : Number(value), completed: false } : item))
  }

  function toggle(position: number) {
    if (!sets[position].completed) { setAttack(value => value + 1); setNow(Date.now()); setRestEnd(Date.now() + exercise.restSeconds * 1000) }
    setSets(items => items.map((item, i) => i === position ? { ...item, completed: !item.completed } : item))
  }

  return <div className="session">
    <header className="session-header"><div>
      <Button aria-label="Retirar-se do treino" onClick={() => setDialog('exit')} disabled={busy || locked}>×</Button>
      <div><small>Modo foco · Rank {workout.rank}</small><h1 ref={heading} tabIndex={-1}>{workout.name}</h1></div>
      <span className="session-counter">{count}/{workout.exercises.length} exercícios</span>
    </div></header>
    <main className="session-main">
      {error && <Alert severity="error">{error}</Alert>}
      {storageError && <Alert severity="warning">Não foi possível guardar o rascunho neste navegador. Evite fechar a página.</Alert>}
      <section className="surface exercise-card" aria-labelledby="exercise-title">
        <div className="between"><span className="orange mono">Exercício atual · {index + 1}/{workout.exercises.length}</span>
          <Button variant="outlined" disabled={busy || locked} onClick={() => {setNow(Date.now()); setRestEnd(Date.now() + exercise.restSeconds * 1000)}}>Descanso ({exercise.restSeconds}s)</Button>
        </div>
        <div><h2 id="exercise-title">{exercise.name}</h2><p className="orange">{exercise.prescription} <span className="muted">· {exercise.muscleGroups.join(', ')}</span></p></div>
        {!!rest && <div className="surface inset between"><span>Descanso <strong className="mono">{formatSecondsMMSS(rest)}</strong></span><Button onClick={() => setRestEnd(0)}>Pular</Button></div>}
        <div className="set-grid muted" aria-hidden="true"><span>Série</span><span>Carga (kg)</span><span>{isTimed ? 'Tempo (s)' : 'Repetições'}</span><span>Feita</span></div>
        {rows.map(({ position, reps, weightKg, completed }, n) => <div className="set-grid" key={position}>
          <span className="mono">{n + 1}</span>
          <TextField size="small" type="number" value={weightKg} disabled={busy || locked} onChange={event => update(position, 'weightKg', event.target.value)}
            slotProps={{ htmlInput: { 'aria-label': 'Carga (kg) série ' + (n + 1), min: 0, max: 2000, step: 0.01 } }} />
          <TextField size="small" type="number" value={reps || ''} disabled={busy || locked} onChange={event => update(position, 'reps', event.target.value)}
            slotProps={{ htmlInput: { 'aria-label': (isTimed ? 'Tempo (s) série ' : 'Repetições série ') + (n + 1), min: 1, max: 500 } }} />
          <Button variant={completed ? 'contained' : 'outlined'} color={completed ? 'success' : 'primary'} aria-label={'Concluir série ' + (n + 1)}
            aria-pressed={completed} onClick={() => toggle(position)} disabled={busy || locked || !Number.isInteger(reps) || reps < 1 || reps > 500 || weightKg < 0 || weightKg > 2000}>{completed ? '✓' : '○'}</Button>
        </div>)}
        <div className="row">
          <Button variant="outlined" disabled={busy || locked || rows.length >= 12 || sets.length >= 150}
            onClick={() => setSets([...sets, { exerciseId: exercise.id, weightKg: rows.at(-1)?.weightKg ?? exercise.loadKg ?? 0, reps: parseExercisePrescription(exercise.prescription).targetReps, completed: false }])}>Adicionar série</Button>
          <Button variant="outlined" disabled={index === workout.exercises.length - 1} onClick={() => setIndex(index + 1)}>Próximo exercício</Button>
        </div>
        {exercise.executionTip && <details><summary>Dicas técnicas de execução</summary><p>{exercise.executionTip}</p></details>}
      </section>
      <section aria-label="Combate e tempo da sessão" className="surface combat-card">
        <WarriorAvatar avatarStyle={avatarStyle} appearances={appearances} size={112} level={level} hp={hp} gear={gear} attack={attack} victory={combat.state.bossDefeated} resting={paused || rest > 0} />
        <div className="timer mono"><small className="timer-label">{remaining > 0 ? 'Tempo restante' : 'Tempo decorrido'}</small><strong>{formatSecondsMMSS(remaining || elapsed)}</strong><span>Decorrido: {formatSecondsMMSS(elapsed)}</span></div>
        <Button variant="outlined" disabled={busy || locked} onClick={pause}>{paused ? 'Continuar' : 'Pausar'}</Button>
        <div className="surface inset boss">
          <div className="between"><strong>{combat.boss.name}</strong><span className={combat.state.bossDefeated ? 'green' : 'orange'}>{combat.state.bossDefeated ? 'DERROTADO' : combat.state.currentHp + ' / ' + combat.boss.maxHp + ' HP'}</span></div>
          <LinearProgress variant="determinate" value={combat.state.currentHp / combat.boss.maxHp * 100} aria-label="HP do chefe" />
          <p className="muted">{combat.completedSets}/{combat.totalSets} séries · Recompensa calculada ao salvar</p>
        </div>
      </section>
      <section aria-label="Lista de exercícios" className="exercise-list">
        <h2>Lista de exercícios ({count}/{workout.exercises.length})</h2>
        {workout.exercises.map((item, i) => <Button key={item.id} variant="outlined" aria-current={index === i ? 'step' : undefined} onClick={() => setIndex(i)}>{i + 1}. {item.name} · {item.prescription}</Button>)}
      </section>
    </main>
    <footer className="session-footer"><Button fullWidth variant="contained" disabled={busy || !completed.length} onClick={() => setDialog('finish')}>{busy ? 'Salvando…' : locked ? 'Reenviar treino' : completed.length ? 'Finalizar treino' : 'Conclua 1 exercício para finalizar'}</Button></footer>
    <Dialog open={dialog !== null} onClose={() => setDialog(null)} aria-labelledby="session-dialog-title" fullWidth maxWidth="xs">
      <DialogTitle id="session-dialog-title">{dialog === 'exit' ? 'Retirar-se do treino?' : 'Finalizar sessão?'}</DialogTitle>
      <DialogContent>{dialog === 'exit' ? 'As séries desta sessão não serão salvas.' :
        <><p>Revise o resumo antes de salvar o treino.</p><p>Exercícios: {count}/{workout.exercises.length} · Séries: {completed.length} · Volume: {number.format(completed.reduce((sum, set) => sum + set.weightKg * set.reps, 0))} kg</p><p>XP, moedas e recordes são calculados no servidor ao concluir.</p></>}</DialogContent>
      <DialogActions><Button onClick={() => setDialog(null)}>Voltar</Button>
        <Button variant="contained" onClick={dialog === 'exit' ? () => { removeDraft(owner, draftId); onCancel() } : finish}>{dialog === 'exit' ? 'Cancelar treino' : 'Concluir treino'}</Button>
      </DialogActions>
    </Dialog>
  </div>
}
