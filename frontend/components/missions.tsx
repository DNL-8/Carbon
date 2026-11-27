'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, TextField } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, date, number, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { achievementsResult, idResult, missionsResult, refreshRpg, vowsResult, type Quest, type VowInput } from '../lib/rpg-api'

const vowSchema = z.object({ title: z.string().trim().min(1, 'Informe o compromisso.').max(120) })

export function Missions() {
  const client = useQueryClient()
  const missions = useQuery({ queryKey: ['missions'], queryFn: async () => read(await api.GET('/api/missao'), missionsResult) })
  const vows = useQuery({ queryKey: ['vows'], queryFn: async () => read(await api.GET('/api/votos'), vowsResult) })
  const [confirm, setConfirm] = useState<z.infer<typeof vowsResult>[number]>()
  const [message, setMessage] = useState('')
  const draft = useRef<{ id: string; title: string }>(null)
  const form = useForm({ resolver: zodResolver(vowSchema), defaultValues: { title: '' } })
  const { ref, ...titleInput } = form.register('title')
  const action = useMutation({
    mutationFn: async (input: { claim: Quest['id'] } | VowInput) => {
      if ('claim' in input) {
        read(await api.POST('/api/missao', { body: { id: input.claim } }), z.object({ claimed: z.literal(true) }))
      } else {
        read(await api.POST('/api/votos', { body: input }), idResult)
      }
    },
    onSuccess: async (_, input) => {
      if ('action' in input && input.action === 'create') {
        form.reset()
        draft.current = null
      }
      setMessage('claim' in input ? 'Recompensa resgatada.' : 'Voto atualizado.')
      setConfirm(undefined)
      await refreshRpg(client, 'missions', 'vows', 'arsenal')
    },
  })
  const run = (input: { claim: Quest['id'] } | VowInput) => { setMessage(''); action.mutate(input) }
  const raid = missions.data?.raid
  return <>
    {action.error && <Alert severity="error">{errorMessage(action.error)}</Alert>}
    {message && <p className="green" role="status">{message}</p>}
    <section className="surface overview" aria-labelledby="daily-missions">
      <header><h2 id="daily-missions">Missões de hoje</h2><p>Resgate as recompensas e registre seus compromissos pessoais.</p></header>
      {missions.isPending && <p role="status">Carregando missões…</p>}
      {(missions.isError || vows.isError) && <Alert severity="error" action={<Button onClick={() => {void missions.refetch(); void vows.refetch()}}>Tentar novamente</Button>}>Não foi possível carregar todas as missões.</Alert>}
      {missions.data?.daily.map(quest => <QuestCard key={quest.id} quest={quest} pending={action.isPending} claim={() => run({ claim: quest.id })} />)}
      <form className="inline-form" noValidate onSubmit={form.handleSubmit(({ title }) => {
        if (!draft.current || draft.current.title !== title) draft.current = { id: crypto.randomUUID(), title }
        run({ action: 'create', ...draft.current })
      })}>
        <TextField {...titleInput} inputRef={ref} label="Novo compromisso" size="small" error={!!form.formState.errors.title}
          helperText={form.formState.errors.title?.message} slotProps={{ htmlInput: { maxLength: 120 } }} />
        <Button variant="contained" type="submit" disabled={action.isPending}>Criar voto</Button>
      </form>
      {vows.data?.map(vow => <article key={vow.id} className={'surface inset rpg-row' + (vow.outcome === 'complete' ? ' fulfilled' : '')}>
        <div><h3>{vow.title}</h3><p>{vow.outcome === 'complete' ? 'Cumprido hoje' : vow.outcome === 'violate' ? 'Quebrado hoje' : 'Compromisso pessoal'}</p></div>
        <div className="row">
          {!vow.outcome && <><Button color="success" variant="outlined" disabled={action.isPending} onClick={() => run({ action: 'complete', id: vow.id })}>Cumpri o voto</Button>
            <Button color="error" variant="outlined" disabled={action.isPending} onClick={() => setConfirm(vow)}>Quebrei o voto</Button></>}
          <Button variant="outlined" disabled={action.isPending || !!vow.outcome} onClick={() => run({ action: 'delete', id: vow.id })}>Remover voto</Button>{vow.outcome && <small>Remoção disponível amanhã.</small>}
        </div>
      </article>)}
    </section>
    {raid && <section className="surface overview" aria-labelledby="weekly-raid">
      <div className="between">
        <header><small className="orange mono">Raid Semanal · {raid.weekKey}</small><h2 id="weekly-raid">{raid.bossName}</h2><p>{raid.bossSubtitle}</p></header>
        <div><strong className={raid.isDefeated ? 'green' : 'orange'}>{raid.isDefeated ? 'Raid concluída' : raid.currentHp + ' / ' + raid.maxHp + ' HP'}</strong>
          <p>{raid.workoutsThisWeek} treinos · {number.format(raid.weeklyVolumeKg)} kg · {raid.weeklyPrCount} PRs</p></div>
      </div>
      <LinearProgress variant="determinate" value={raid.hpPercent} aria-label="HP da raid semanal" />
      <h3>Missões da semana</h3>
      <div className="rpg-grid">{missions.data?.weekly.map(quest => <QuestCard key={quest.id} quest={quest} pending={action.isPending} claim={() => run({ claim: quest.id })} />)}</div>
    </section>}
    <Dialog open={!!confirm} onClose={(_, reason) => { if (reason !== 'backdropClick' && !action.isPending) setConfirm(undefined) }} aria-labelledby="vow-confirm">
      <DialogTitle id="vow-confirm">Registrar falha</DialogTitle>
      <DialogContent>Registrar a falha aplica a penalidade de “{confirm?.title}” ao seu progresso.
        {action.error && <Alert severity="error">{errorMessage(action.error)}</Alert>}</DialogContent>
      <DialogActions><Button disabled={action.isPending} onClick={() => setConfirm(undefined)}>Cancelar</Button>
        <Button variant="contained" color="error" disabled={action.isPending} onClick={() => { if (confirm) run({ action: 'violate', id: confirm.id }) }}>Confirmar falha</Button></DialogActions>
    </Dialog>
  </>
}

function QuestCard({ quest, pending, claim }: { quest: Quest; pending: boolean; claim: () => void }) {
  return <article className={'surface inset quest-card' + (quest.isFulfilled ? ' fulfilled' : '')}>
    <div><h3>{quest.title}</h3><p>{quest.subtitle}</p></div>
    <LinearProgress variant="determinate" color={quest.isFulfilled ? 'success' : 'primary'} value={quest.progressPercent} aria-label={'Progresso: ' + quest.title} />
    <div className="between mono"><p>{quest.progressText}</p><strong className="orange">+{quest.xpReward} XP · +{quest.coinsReward} moedas</strong></div>
    {quest.claimed ? <strong className="green quest-state">Resgatada</strong> : quest.isFulfilled ? <Button variant="contained" disabled={pending} onClick={claim}>Resgatar {quest.title}</Button> : <span className="muted quest-state">Em andamento</span>}
  </article>
}

export function Achievements() {
  const achievements = useQuery({ queryKey: ['achievements'], queryFn: async () => read(await api.GET('/api/conquistas'), achievementsResult) })
  return <section className="surface overview" aria-labelledby="achievements-heading">
    <header><h2 id="achievements-heading">Conquistas</h2>
      {achievements.data && <p>{achievements.data.filter(item => item.unlockedAt !== null).length} de {achievements.data.length} desbloqueadas</p>}</header>
    {achievements.isPending && <p role="status">Carregando conquistas…</p>}
    {achievements.isError && <Alert severity="error" action={<Button onClick={() => achievements.refetch()}>Tentar novamente</Button>}>Não foi possível carregar as conquistas.</Alert>}
    <ul className="rpg-grid achievement-grid">{achievements.data?.map(item => <li key={item.id} className={'surface inset achievement' + (item.unlockedAt ? ' fulfilled' : '')}>
      <span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p>
        <p className={item.unlockedAt ? 'green' : 'muted'}>{item.unlockedAt ? 'Desbloqueada em ' + date.format(new Date(item.unlockedAt)) : 'Bloqueada'} · +{item.bonusXp} XP</p></div>
    </li>)}</ul>
  </section>
}
