'use client'

import { useState } from 'react'
import { Alert, Button, MenuItem, TextField } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { connectResult, formatDay, formatMetric, stravaStatusResult, stravaSyncResult } from '../lib/health-api'
import { refreshRpg } from '../lib/rpg-api'

const columns = [['steps', 'Passos', ''], ['calories', 'Calorias ativas', 'kcal'], ['sleepHours', 'Sono', 'h']] as const

export function HealthConnect() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['health-connect'], queryFn: async () => read(await api.GET('/api/saude/health-connect'), connectResult) })
  const data = query.data
  async function update() {
    const response = await query.refetch()
    if (response.isSuccess) await refreshRpg(client, 'health-summary', 'missions')
  }
  return <section className="surface overview" aria-labelledby="connect-title">
    <header className="between">
      <div><h2 id="connect-title">Health Connect</h2><p>Métricas enviadas pelo app Android para sua conta Murim.</p></div>
      <Button variant="outlined" onClick={update} disabled={query.isFetching}>{query.isFetching ? 'Atualizando…' : 'Atualizar dados'}</Button>
    </header>
    {query.isError && <Alert severity="error">{errorMessage(query.error)}</Alert>}
    {data && <><p>{data.daysCount} dias com métricas · {data.activitiesCount} atividades importadas</p>
      {data.daysCount + data.activitiesCount === 0 && <p>Entre no app Android com a mesma conta para sincronizar.</p>}
      {!!data.dailyMetrics.length && <>
        <dl className="rpg-grid health-dl">{columns.map(([key, label, unit]) => {
          const recent = data.dailyMetrics.find(day => day[key] !== null)
          return <div className="surface inset metric" key={key}><dt>{label}</dt><dd>{formatMetric(recent?.[key], unit)}</dd>{recent && <dd><time dateTime={recent.dateKey}>{formatDay(recent.dateKey)}</time></dd>}</div>
        })}</dl>
        <p className="muted">Registros antigos podem conter calorias totais, em vez de apenas calorias ativas.</p>
        <details><summary>Histórico de métricas sincronizadas</summary>
          <div className="table-scroll" role="region" aria-label="Histórico do Health Connect" tabIndex={0}><table><caption>Métricas recentes do Health Connect</caption>
            <thead><tr><th scope="col">Dia</th>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
            <tbody>{data.dailyMetrics.map(row => <tr key={row.dateKey}><th scope="row">{formatDay(row.dateKey)}</th>
              {columns.map(([key, , unit]) => <td key={key}>{formatMetric(row[key], unit)}</td>)}</tr>)}</tbody>
          </table></div>
        </details>
      </>}
    </>}
  </section>
}

export function Strava({ callback }: { callback?: 'connected' | 'error' }) {
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['strava-status'], queryFn: async () => read(await api.GET('/api/strava/status'), stravaStatusResult) })
  const [days, setDays] = useState<7 | 28 | 90>(28)
  const [message, setMessage] = useState('')
  const mutation = useMutation({
    mutationFn: async (action: 'connect' | 'sync' | 'disconnect') => {
      if (action === 'connect') {
        const redirect = read(await api.POST('/api/strava/auth-url'), z.object({ url: z.url() }))
        const url = new URL(redirect.url)
        if (url.origin !== 'https://www.strava.com' || url.pathname !== '/oauth/authorize' || url.username || url.password) {
          throw new Error('Endereço de autorização do Strava inválido.')
        }
        window.location.assign(url.href)
        return
      }
      if (action === 'sync') {
        const result = read(await api.POST('/api/strava/sync', { body: { days } }), stravaSyncResult)
        setMessage(`${result.imported} atividades novas, ${result.duplicates} duplicadas. +${result.xp} XP.` + (result.truncated ? ' Limite de 150 registros atingido.' : ''))
        await refreshRpg(client, 'health-summary', 'missions', 'arsenal')
      } else {
        read(await api.POST('/api/strava/disconnect'), z.object({ disconnected: z.literal(true) }))
        setMessage('Conexão removida. Os dados importados foram preservados.')
      }
      await status.refetch()
    },
  })
  const run = (action: 'connect' | 'sync' | 'disconnect') => { setMessage(''); mutation.mutate(action) }
  const data = status.data
  return <section className="surface overview" aria-labelledby="strava-title">
    <header className="between"><div><h2 id="strava-title">Strava · OAuth</h2><p>Importe suas atividades do Strava após autorizar a conexão.</p></div>
      {data && <strong className={data.connected ? 'green' : 'muted'}>{data.connected ? 'Conectado' : data.configured ? 'Desconectado' : 'Não configurado'}</strong>}</header>
    {status.isPending && <p role="status">Verificando conexão…</p>}
    {status.isError && <Alert severity="error" action={<Button onClick={() => status.refetch()}>Tentar novamente</Button>}>Não foi possível verificar o Strava.</Alert>}
    {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    {!message && callback === 'error' && <Alert severity="error">O Strava não autorizou a conexão.</Alert>}
    {!message && callback === 'connected' && data?.connected && <Alert severity="success">Strava conectado.</Alert>}
    {data?.configured && (data.connected ? <div className="row">
      <TextField label="Período Strava" size="small" select value={days} onChange={event => setDays(z.union([z.literal(7), z.literal(28), z.literal(90)]).parse(Number(event.target.value)))}>
        {[7, 28, 90].map(option => <MenuItem value={option} key={option}>{option} dias</MenuItem>)}
      </TextField>
      <Button variant="contained" onClick={() => run('sync')} disabled={mutation.isPending}>Sincronizar Strava</Button>
      <Button variant="outlined" onClick={() => run('disconnect')} disabled={mutation.isPending}>Desconectar Strava</Button>
    </div> : <div><Button variant="contained" onClick={() => run('connect')} disabled={mutation.isPending}>Conectar Strava</Button></div>)}
    {message && <p className="green" role="status">{message}</p>}
  </section>
}
