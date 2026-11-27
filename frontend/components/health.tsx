'use client'

import { useEffect, useState } from 'react'
import { Alert, Button, MenuItem, Tab, Tabs, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { BarChart } from '@mui/x-charts/BarChart'
import { z } from 'zod'
import type { ProfileInput } from '../shared/training'
import { api, dashboardResult, read } from '../lib/api'
import { formatDay, formatMetric, sources, summaryResult, type Period, type Source } from '../lib/health-api'
import { HealthConnect, Strava } from './health-connections'
import { HealthImport } from './health-import'
import { Weight } from './weight'

type Section = 'visao-geral' | 'atividades' | 'evolucao' | 'sincronizacao'
const sections = [['visao-geral', 'Visão geral'], ['atividades', 'Atividades'], ['evolucao', 'Evolução'], ['sincronizacao', 'Sincronização']] as const
type TrendMetric = 'durationMinutes' | 'distanceKm' | 'calories'
const details = { durationMinutes: ['Duração', 'min'], distanceKm: ['Distância', 'km'], calories: ['Calorias estimadas', 'kcal'] } as const

export function Health({ owner, overview, profile, onProfile }: {
  owner: string; overview?: z.infer<typeof dashboardResult>; profile?: ProfileInput | null; onProfile: () => void
}) {
  const [section, setSection] = useState<Section>('visao-geral')
  const [callback, setCallback] = useState<'connected' | 'error'>()
  const [period, setPeriod] = useState<Period>('28')
  const [source, setSource] = useState<Source>('all')
  const [metric, setMetric] = useState<TrendMetric>('durationMinutes')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = sections.find(([name]) => name === params.get('secao'))
    const event = params.get('strava')
    if (event === 'connected' || event === 'error') { setCallback(event); setSection('sincronizacao') }
    else if (tab) setSection(tab[0])
  }, [])

  const summary = useQuery({
    queryKey: ['health-summary', period, source], enabled: section === 'visao-geral' || section === 'atividades',
    queryFn: async () => read(await api.GET('/api/saude/resumo', { params: { query: { period, source } } }), summaryResult),
  })
  const data = summary.data
  const totals = data?.totals
  const recovery = overview?.recovery
  const unit = details[metric][1]
  const hasTrendMeasurements = data?.trend.some(day => day[metric] != null)
  const observed = new Map(data?.trend.map(day => [day.dateKey, day[metric]]) ?? [])
  const trend = data ? Array.from({ length: Number(period) }, (_, i) => {
    const dateKey = new Date(Date.parse(data.since + 'T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10)
    return { dateKey, value: observed.get(dateKey) ?? null }
  }) : []
  const totalZoneMinutes = totals ? totals.z1 + totals.z2 + totals.z3 + totals.z4 + totals.z5 : 0

  function change(value: Section) {
    setSection(value)
    const url = new URL(window.location.href)
    url.searchParams.set('secao', value)
    url.searchParams.delete('strava')
    window.history.replaceState(null, '', url)
  }

  return <section className="view" aria-labelledby="health-heading">
    <header className="view-heading"><h1 id="health-heading">Saúde e relatórios</h1><p>Acompanhe suas atividades, métricas e recuperação.</p></header>
    <Tabs value={section} onChange={(_, value: Section) => change(value)} aria-label="Relatórios de saúde" variant="scrollable" allowScrollButtonsMobile>
      {sections.map(([id, label]) => <Tab key={id} value={id} label={label} id={'health-tab-' + id} aria-controls={'health-' + id} />)}
    </Tabs>
    {(section === 'visao-geral' || section === 'atividades') && <section className="surface catalog-filter" aria-label="Filtros do relatório">
      <div className="filter-row" role="group" aria-label="Período do relatório">
        {(['7', '28', '90'] as const).map(days => <Button key={days} variant={days === period ? 'contained' : 'outlined'} aria-pressed={days === period} onClick={() => setPeriod(days)}>{days} dias</Button>)}
      </div>
      <TextField select size="small" label="Origem" value={source} onChange={event => setSource(event.target.value as Source)}>
        {Object.entries(sources).map(([key, name]) => <MenuItem key={key} value={key}>{name}</MenuItem>)}
      </TextField>
      {summary.isPending && <p role="status">Carregando relatório…</p>}
      {summary.isError && <Alert severity="error" action={<Button onClick={() => summary.refetch()}>Tentar novamente</Button>}>Não foi possível carregar o relatório.</Alert>}
    </section>}
    <div id="health-visao-geral" role="tabpanel" aria-labelledby="health-tab-visao-geral" className="view" hidden={section !== 'visao-geral'}>
      {totals && <>
        <div className="rpg-grid">{([
          ['Tempo de treino', totals.durationMinutes, 'min'], ['Distância', totals.distanceKm, 'km'],
          ['Calorias estimadas', totals.calories, 'kcal'], ['Frequência cardíaca média', totals.avgHeartRate, 'bpm'],
        ] as const).map(([label, value, suffix]) => <article className="surface metric" key={label}><p>{label}</p><strong className="orange mono">{formatMetric(value, suffix)}</strong></article>)}</div>
        <p>Distância e calorias consideram somente as medições disponíveis.</p>
        <section className="surface overview" aria-labelledby="trend-title">
          <header className="between"><h2 id="trend-title">Tendência de atividade</h2>
            <TextField select label="Métrica do gráfico" value={metric} onChange={event => setMetric(event.target.value as TrendMetric)} size="small">
              {Object.entries(details).map(([key, [label]]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
            </TextField></header>
          {!data.trend.length && <p>Nenhuma atividade importada no período.</p>}
          {!!data.trend.length && <>
            {hasTrendMeasurements ? <div className="health-chart" role="group" aria-label="Gráfico de tendência de atividade">
              <BarChart height={240} skipAnimation hideLegend
                xAxis={[{ scaleType: 'band', data: trend.map(day => day.dateKey), valueFormatter: formatDay }]}
                series={[{ data: trend.map(day => day.value), label: details[metric][0], color: '#fb923c', valueFormatter: value => formatMetric(value, unit) }]}
              />
            </div> : <p>Sem medições para a métrica selecionada.</p>}
            <details><summary>Valores da tendência por dia</summary>
              <ul className="list">{trend.map(day => <li key={day.dateKey}>
                <time dateTime={day.dateKey}>{formatDay(day.dateKey)}</time>
                <strong>{day.value == null ? 'Sem medição' : formatMetric(day.value, unit)}</strong>
              </li>)}</ul>
            </details>
          </>}
        </section>
        <section className="surface overview" aria-labelledby="heart-zones">
          <h2 id="heart-zones">Zonas cardíacas</h2>
          {totalZoneMinutes === 0 ? <p>Sem medições de zonas no período.</p> :
            <div className="rpg-grid">{[totals.z1, totals.z2, totals.z3, totals.z4, totals.z5].map((value, index) => <div className="surface inset metric" key={index}><p>Zona {index + 1}</p>
              <strong className="mono">{formatMetric(value, 'min')}</strong></div>)}</div>}
        </section>
      </>}
    </div>
    <div id="health-atividades" role="tabpanel" aria-labelledby="health-tab-atividades" className="view" hidden={section !== 'atividades'}>
      {data && <><section className="surface overview" aria-labelledby="activity-heading">
        <h2 id="activity-heading">Atividades recentes</h2>
        {!data.activities.length && <p>Nenhuma atividade importada no período.</p>}
        <ul className="list">{data.activities.map(({ id, source, data }) => <li key={source + ':' + id}>
          <div><strong>{data.title}</strong><time dateTime={data.dateKey}>{formatDay(data.dateKey)} · {sources[source]}</time></div>
          <span>{formatMetric(data.durationMinutes, 'min')} · {formatMetric(data.distanceKm, 'km')} · {formatMetric(data.calories, 'kcal')}</span>
        </li>)}</ul>
      </section>
      <section className="surface overview" aria-labelledby="metrics-title">
        <h2 id="metrics-title">Métricas diárias recentes</h2>
        {!data.dailyMetrics.length ? <p>Nenhuma métrica importada no período.</p> :
          <div className="table-scroll" role="region" aria-label="Tabela de métricas de saúde" tabIndex={0}><table><caption>Métricas de saúde por dia e fonte</caption>
            <thead><tr><th scope="col">Dia</th><th scope="col">Origem</th><th scope="col">Passos</th><th scope="col">Sono</th><th scope="col">FC em repouso</th><th scope="col">Calorias ativas</th></tr></thead>
            <tbody>{data.dailyMetrics.map(row => <tr key={row.date + ':' + row.source}><th scope="row">{formatDay(row.date)}</th><td>{sources[row.source]}</td>
              <td>{formatMetric(row.data.steps)}</td><td>{formatMetric(row.data.sleepHours, 'h')}</td><td>{formatMetric(row.data.restingHeartRate, 'bpm')}</td><td>{formatMetric(row.data.activeCalories, 'kcal')}</td></tr>)}</tbody>
          </table></div>}
      </section></>}
    </div>
    <div id="health-evolucao" role="tabpanel" aria-labelledby="health-tab-evolucao" className="view" hidden={section !== 'evolucao'}>
      {section === 'evolucao' && <>
        {overview ? <Weight stats={overview} profile={profile} onProfile={onProfile} /> : <p role="status">Aguardando dados do painel.</p>}
        <section className="surface overview" aria-labelledby="recovery-title">
          <h2 id="recovery-title">Carga e recuperação</h2>
          <div className="stats-grid">
            <div className="surface inset metric"><p>Carga aguda/crônica (ACWR)</p><strong className="mono">{formatMetric(overview?.acwr)}</strong></div>
            <div className="surface inset metric"><p>Prontidão estimada</p><strong className="orange mono">{formatMetric(recovery?.score, '%')}</strong></div>
          </div>
          {recovery ? <><p><strong>{recovery.statusLabel}</strong> · Sono médio {formatMetric(recovery.avgSleepHours, 'h')} · FC em repouso {formatMetric(recovery.latestRestingHr, 'bpm')}</p>
            <p>{recovery.recommendation}</p></> : <p>Importe métricas de saúde e registre treinos para acompanhar a recuperação.</p>}
          <p>Indicador educativo do Murim.</p>
        </section>
      </>}
    </div>
    <div id="health-sincronizacao" role="tabpanel" aria-labelledby="health-tab-sincronizacao" className="view" hidden={section !== 'sincronizacao'}>
      {section === 'sincronizacao' && <><HealthConnect /><Strava callback={callback} /><HealthImport owner={owner} /></>}
    </div>
  </section>
}
