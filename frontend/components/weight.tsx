'use client'

import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { computeBmiSummary } from '../../src/utils/rpgLogic'
import type { ProfileInput } from '../../web/shared/training'
import { api, dashboardResult, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { formatDay, formatMetric } from '../lib/health-api'
import { refreshRpg } from '../lib/rpg-api'

const schema = z.object({ dateKey: z.iso.date('Informe a data.'), kg: z.number().min(20, 'Informe um peso entre 20 e 500 kg.').max(500, 'Informe um peso entre 20 e 500 kg.') })

export function Weight({ stats, profile, onProfile }: { stats: z.infer<typeof dashboardResult>; profile?: ProfileInput | null; onProfile: () => void }) {
  const client = useQueryClient()
  const { weights, today } = stats
  const current = weights[0]?.kg ?? profile?.weightKg ?? null
  const bmi = computeBmiSummary(profile?.heightCm, current)
  const delta = weights.length > 1 ? weights[0].kg - weights[1].kg : null
  const days = [...weights].reverse()
  const min = Math.min(...days.map(item => item.kg))
  const max = Math.max(...days.map(item => item.kg))
  const start = Date.parse(days[0]?.dateKey ?? today)
  const span = Math.max(1, Date.parse(days.at(-1)?.dateKey ?? today) - start)
  const points = days.map(item => ({
    ...item,
    x: days.length === 1 ? 160 : 18 + 284 * (Date.parse(item.dateKey) - start) / span,
    y: max === min ? 64 : 112 - 94 * (item.kg - min) / (max - min),
  }))
  const [deleteDay, setDeleteDay] = useState<string>()
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { dateKey: today, kg: current ?? undefined } })
  const selectedDay = form.watch('dateKey')
  const highlighted = points.find(point => point.dateKey === selectedDay) ?? points.at(-1)
  const { ref: dateRef, ...dateInput } = form.register('dateKey')
  const { ref: kgRef, ...kgInput } = form.register('kg', { valueAsNumber: true })
  const mutation = useMutation({
    mutationFn: async (input: z.infer<typeof schema> | { dateKey: string }) => {
      if ('kg' in input) read(await api.PUT('/api/saude/peso', { body: input }), z.object({ kg: z.number() }))
      else read(await api.DELETE('/api/saude/peso', { body: input }), z.object({ deleted: z.literal(true) }))
    },
    onSuccess: async (_, input) => {
      setMessage('kg' in input ? 'Peso registrado.' : 'Pesagem excluída.')
      setDeleteDay(undefined)
      await refreshRpg(client, 'missions')
    },
  })
  return <section className="surface overview" aria-labelledby="weight-title">
    <header className="between"><div><h2 id="weight-title">Peso corporal e evolução física</h2><p>Registre e acompanhe suas pesagens.</p></div>
      {delta !== null && <small className="mono">{delta > 0 ? '+' : ''}{formatMetric(delta, 'kg')} vs. anterior</small>}
    </header>
    {message && <p className="green" role="status">{message}</p>}
    {mutation.error && !deleteDay && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    <div className="rpg-grid">
      <div className="health-stack"><div className="stats-grid">
        <div className="surface inset metric"><p>Peso atual</p><strong className="mono">{formatMetric(current, 'kg')}</strong></div>
        <div className="surface inset metric"><p>IMC calculado</p><strong className="mono orange">{formatMetric(bmi?.bmi)}</strong>
          {bmi ? <p>{bmi.label}</p> : <Button size="small" onClick={onProfile}>Editar ficha</Button>}</div>
      </div>
      <form className="health-stack" noValidate onSubmit={form.handleSubmit(data => {
        if (data.dateKey > today) { form.setError('dateKey', { message: 'Informe uma data até hoje.' }, { shouldFocus: true }); return }
        setMessage(''); mutation.mutate(data)
      })}>
        <div className="stats-grid">
          <TextField {...dateInput} inputRef={dateRef} label="Data da pesagem" type="date" size="small"
            error={!!form.formState.errors.dateKey} helperText={form.formState.errors.dateKey?.message}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }} />
          <TextField {...kgInput} inputRef={kgRef} label="Peso (kg)" type="number" size="small" defaultValue={current ?? ''}
            error={!!form.formState.errors.kg} helperText={form.formState.errors.kg?.message}
            slotProps={{ htmlInput: { min: 20, max: 500, step: 'any' } }} />
        </div>
        <Button type="submit" variant="contained" disabled={mutation.isPending}>Registrar peso</Button>
      </form></div>
      <div className="surface inset health-stack health-inset">
        <div className="between"><h3>Curva de evolução</h3>
          {highlighted && <small className="mono muted">{formatDay(highlighted.dateKey)} · {formatMetric(highlighted.kg, 'kg')}</small>}</div>
        {points.length > 0 && <svg viewBox="0 0 320 128" className="weight-curve" role="img" aria-label="Evolução do peso ao longo do tempo">
          {[24, 64, 104].map(y => <line key={y} x1="12" x2="308" y1={y} y2={y} stroke="#27272a" />)}
          <polyline points={points.map(({ x, y }) => x + ',' + y).join(' ')} fill="none" stroke="#f97316" strokeWidth="2" />
          {points.map(point => <circle key={point.dateKey} cx={point.x} cy={point.y}
            r={point.dateKey === highlighted?.dateKey ? 4 : 2.5} fill="#fb923c"><title>{formatDay(point.dateKey)} · {formatMetric(point.kg, 'kg')}</title></circle>)}
        </svg>}
        <h3>Histórico de pesagens</h3>
        {!weights.length && <p>Registre sua primeira pesagem.</p>}
        <ul className="list">{(expanded ? weights : weights.slice(0, 3)).map(row => <li key={row.dateKey}>
          <Button onClick={() => form.reset(row)} aria-label={'Editar pesagem de ' + formatDay(row.dateKey)}>{formatDay(row.dateKey)} · {formatMetric(row.kg, 'kg')}</Button>
          <Button color="error" aria-label={'Excluir pesagem de ' + formatDay(row.dateKey)} onClick={() => { mutation.reset(); setDeleteDay(row.dateKey) }} disabled={mutation.isPending}>Excluir</Button>
        </li>)}</ul>
        {weights.length > 3 && <Button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Mostrar menos' : 'Ver histórico'}</Button>}
      </div>
    </div>
    <Dialog open={!!deleteDay} onClose={() => { if (!mutation.isPending) setDeleteDay(undefined) }} aria-labelledby="weight-delete">
      <DialogTitle id="weight-delete">Excluir pesagem?</DialogTitle>
      <DialogContent>{deleteDay && <p>Remover o registro de {formatDay(deleteDay)}?</p>}
        {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={() => setDeleteDay(undefined)} disabled={mutation.isPending}>Cancelar</Button>
        <Button color="error" onClick={() => { if (deleteDay) mutation.mutate({ dateKey: deleteDay }) }} disabled={mutation.isPending}>Confirmar exclusão</Button></DialogActions>
    </Dialog>
  </section>
}
