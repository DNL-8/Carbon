'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, LinearProgress } from '@mui/material'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WorkoutTemplate } from '../../src/types/fitness'
import { getLevelProgress } from '../../src/utils/rpgLogic'
import {
  api, ApiError, dashboardResult, date, historyResult, ledgerResult, number,
  profileResult, progressResult, read, workouts, type Reward,
} from '../lib/api'
import { authRequest, errorMessage, notifySessionChange } from '../lib/auth'
import { Catalog } from './catalog'
import { Glyph } from './glyph'
import { Arsenal } from './arsenal'
import { Health } from './health'
import { Oracle } from './oracle'
import { CustomWorkouts } from './custom-workouts'
import { Achievements, Missions } from './missions'
import { refreshRpg } from '../lib/rpg-api'
import { Profile } from './profile'
import { Training } from './training'

const navigation = [
  ['inicio', 'Início', '⌂'], ['painel', 'Painel', '▤'], ['treinar', 'Treinar', '⚔'],
  ['arsenal', 'Arsenal', '♜'], ['progresso', 'Saúde', '♡'], ['coach', 'Oráculo', '✦'], ['extrato', 'Extrato', '▤'], ['perfil', 'Perfil', '♙'],
] as const
type View = (typeof navigation)[number][0]

const totals = (xp: number, coins: number) => <>{number.format(xp)} XP <span aria-hidden="true">·</span> {number.format(coins)} moedas</>

export function Murim() {
  const client = useQueryClient()
  const [view, setView] = useState<View>('inicio')
  const [active, setActive] = useState<WorkoutTemplate>()
  const [receipt, setReceipt] = useState<{ name: string; reward: Reward }>()
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const main = useRef<HTMLElement>(null)
  const receiptHeading = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const profile = useQuery({ queryKey: ['hero'], queryFn: async () => read(await api.GET('/api/heroi'), profileResult) })
  const ready = Boolean(profile.data?.profile)
  const progress = useQuery({ queryKey: ['progress'], enabled: ready, queryFn: async () => read(await api.GET('/api/progresso'), progressResult) })
  const dashboard = useQuery({ queryKey: ['dashboard'], enabled: ready, queryFn: async () => read(await api.GET('/api/painel'), dashboardResult) })
  const catalog = useQuery({ queryKey: ['catalog'], enabled: ready && ['inicio', 'painel', 'treinar'].includes(view), queryFn: async () => read(await api.GET('/api/catalogo'), workouts) })
  const custom = useQuery({ queryKey: ['custom'], enabled: ready && view === 'treinar', queryFn: async () => read(await api.GET('/api/treinos/personalizados'), workouts) })
  const history = useQuery({ queryKey: ['history'], enabled: ready && (view === 'inicio' || view === 'painel'),
    queryFn: async () => read(await api.GET('/api/treinos/historico'), historyResult) })
  const ledger = useInfiniteQuery({
    queryKey: ['ledger'], enabled: ready && view === 'extrato', initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => read(await api.GET('/api/extrato', { params: { query: { cursor: pageParam } } }), ledgerResult),
    getNextPageParam: page => page.nextCursor ?? undefined,
  })
  const userQueries = [profile, progress, dashboard, custom, history, ledger]
  const sessionError = userQueries.some(query => query.error instanceof ApiError && [401, 403].includes(query.error.status))
  const metrics = progress.data
  const overview = dashboard.data
  const level = metrics ? getLevelProgress(metrics.xp) : undefined

  useEffect(() => { if (receipt) receiptHeading.current?.focus() }, [receipt])
  useEffect(() => {
    const fromQuery = () => {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (navigation.some(([value]) => value === tab)) setView(tab as View)
      else setView('inicio')
    }
    fromQuery()
    window.addEventListener('popstate', fromQuery)
    return () => window.removeEventListener('popstate', fromQuery)
  }, [])

  async function signOut() {
    setSigningOut(true); setError('')
    try {
      await authRequest('sign-out', {})
      client.clear()
      notifySessionChange()
      window.location.replace('/')
    } catch (cause) {
      setError(errorMessage(cause))
      setSigningOut(false)
    }
  }

  function navigate(tab: View) {
    setView(tab)
    const query = tab === 'inicio' ? '/' : '/?tab=' + tab
    window.history.pushState(null, '', query)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => main.current?.focus())
  }

  function start(workout: WorkoutTemplate) {
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement
    setReceipt(undefined); setActive(workout)
    window.scrollTo(0, 0)
  }

  function finish(reward: Reward) {
    if (!active) return
    setReceipt({ name: active.name, reward }); setActive(undefined)
    client.setQueryData(['progress'], metrics ? { ...metrics, xp: reward.xp, coins: reward.coins } : undefined)
    void refreshRpg(client, 'history', 'missions', 'achievements', 'arsenal')
    window.scrollTo(0, 0)
  }

  if (active) return <Training workout={active} bonus={metrics?.bossDamageBonus ?? 0} onFinish={finish} onCancel={() => {
    setActive(undefined)
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus()
      else main.current?.focus()
    })
  }} />
  const signOutButton = <Button disabled={signingOut} onClick={signOut}>{signingOut ? 'Saindo…' : 'Sair da conta'}</Button>
  if (sessionError) return <main className="profile-page"><section className="surface profile-card">
    <h1>Sessão encerrada</h1><p>Entre novamente para continuar.</p>
    {error && <Alert severity="error">{error}</Alert>}
    <Button variant="contained" onClick={() => {client.clear(); window.location.replace('/')}}>Voltar ao login</Button>
  </section></main>

  if (!ready) return <main className="profile-page">
    {error && <Alert severity="error">{error}</Alert>}
    {profile.isPending ? <p role="status">Carregando ficha…</p> : profile.isError ?
      <section className="surface profile-card"><h1>Ficha de personagem</h1><Alert severity="error">Não foi possível carregar sua ficha.</Alert>
        <Button onClick={() => profile.refetch()}>Tentar novamente</Button>{signOutButton}</section> :
      <Profile onSave={value => client.setQueryData(['hero'], { profile: value })} onSignOut={signOut} />}
  </main>

  const choices = [...(custom.data ?? []), ...(catalog.data ?? [])]
  const menus = navigation.map(([id, label, icon]) => <Button href={id === 'inicio' ? '/' : '/?tab=' + id}
    key={id} className="menu-item" aria-current={view === id ? 'page' : undefined}
    onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); navigate(id)
    }}><span aria-hidden="true">{icon}</span>{label}</Button>)

  return <div className="shell">
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <aside className="sidebar">
      <div className="brand"><span><Glyph name="bolt" /></span>Fitness RPG</div>
      <div className="surface sidebar-progress">
        <div className="character">
          <img src="/assets/mascote-murim.svg" width="54" height="54" alt="" />
          <div><strong>{profile.data?.profile?.name}</strong><p className="orange">Rank {metrics?.rank ?? '—'} · Nv. {metrics?.level ?? '—'}</p></div>
        </div>
        {metrics && <><p className="mono">{totals(metrics.xp, metrics.coins)}</p>
          <LinearProgress variant="determinate" value={level?.progressPercent ?? 0} aria-label="Progresso de experiência" />
          <p className="muted">{metrics.currentStreak} {metrics.currentStreak === 1 ? 'dia' : 'dias'} de sequência</p>
        </>}
      </div>
      <nav aria-label="Menu principal">{menus}</nav>
    </aside>
    <div className="shell-content">
      <header className="topbar"><strong>Fitness RPG &amp; Saúde</strong>{signOutButton}</header>
      <main id="main-content" ref={main} tabIndex={-1} className="content">
        {error && <Alert severity="error">{error}</Alert>}
        {receipt && <section className="surface receipt" aria-labelledby="receipt-title">
          <div className="between"><div><h2 id="receipt-title" ref={receiptHeading} tabIndex={-1}>Treino salvo</h2><p>{receipt.name}</p></div>
            <Button onClick={() => {setReceipt(undefined); main.current?.focus()}}>Fechar resumo</Button></div>
          <p>{receipt.reward.bossDefeated ? 'Chefe derrotado' : 'Chefe permaneceu ativo'}</p>
            <div className="stats-grid"><div className="surface inset"><p>Experiência</p><strong className="orange">+{number.format(receipt.reward.earnedXp)} XP</strong></div>
            <div className="surface inset"><p>Moedas</p><strong className="orange">+{number.format(receipt.reward.earnedCoins)}</strong></div></div>
        </section>}
        {view === 'treinar' && <>
          {(catalog.isError || custom.isError) && <Alert severity="error" action={<Button onClick={() => {void catalog.refetch(); if (ready) void custom.refetch()}}>Tentar novamente</Button>}>Não foi possível carregar todos os treinos.</Alert>}
          {catalog.isPending && <p role="status">Carregando treinos…</p>}
          {custom.data && <CustomWorkouts workouts={custom.data} />}
          {!catalog.isPending && <Catalog workouts={choices} onStart={start} />}
        </>}
        {(view === 'inicio' || view === 'painel') && <section className="view">
          <header className="view-heading"><h1>{view === 'inicio' ? 'Seu herói' : 'Painel de controle'}</h1>
            <p>{profile.data?.profile?.name} <span aria-hidden="true">·</span> {profile.data?.profile?.heroClass} {metrics && <>· <span className="green">{metrics.realm}</span></>}</p>
          </header>
          {(progress.isError || dashboard.isError) && <Alert severity="error" action={<Button onClick={() => {void progress.refetch(); void dashboard.refetch()}}>Tentar novamente</Button>}>Não foi possível carregar todo o progresso.</Alert>}
          {progress.isPending && <p role="status">Carregando progresso…</p>}
          {metrics && <div className="stats-grid status-totals">
            {[[number.format(metrics.xp) + ' XP', 'Experiência'], [number.format(metrics.coins), 'Moedas'], [String(metrics.hp), 'Pontos de vida']].map(([value, label]) =>
              <article className="surface metric" key={label}><p>{label}</p><strong className="orange mono">{value}</strong></article>)}
          </div>}
          <section className="surface recommended">
            <div><h2>Treino recomendado</h2><p>{catalog.data?.[0]?.name ?? 'Abra o catálogo para escolher um treino.'}</p></div>
            <Button variant="contained" onClick={() => catalog.data?.[0] ? start(catalog.data[0]) : navigate('treinar')}>{catalog.data?.[0] ? 'Iniciar treino' : 'Abrir catálogo'}</Button>
          </section>
          <Missions />
          {overview && <section className="surface overview"><h2>Atividade dos últimos 7 dias</h2>
            <ul className="week">{overview.days.map(day => <li key={day.dateKey}>
              <time dateTime={day.dateKey}>{day.dateKey.slice(-2)}/{day.dateKey.slice(5, 7)}</time><strong className={day.count ? 'orange' : 'muted'}>{day.count}</strong></li>)}</ul>
            <p>{overview.totalWorkouts} treinos · {overview.bossesDefeated} chefes derrotados · recorde de {overview.longestStreak} dias</p>
          </section>}
          <Achievements />
          <section className="surface overview"><h2>Histórico de treinos</h2>
            {history.isPending && <p role="status">Carregando histórico…</p>}
            {history.isError && <Alert severity="error">Não foi possível carregar o histórico.</Alert>}
            {history.data && <>{history.data.history.length === 0 ? <p>Seus treinos salvos aparecerão aqui.</p> :
              <ul className="list">{history.data.history.map(item => <li key={item.id}><div><strong>{item.name}</strong><time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time></div><span className="orange">{totals(item.xp, item.coins)}</span></li>)}</ul>}</>}
          </section>
        </section>}
        {view === 'progresso' && <Health overview={overview} profile={profile.data?.profile} onProfile={() => navigate('perfil')} />}
        {view === 'coach' && <Oracle progress={metrics} overview={overview} />}
        {view === 'arsenal' && <Arsenal coins={metrics?.coins} />}
        {view === 'extrato' && <section className="view"><header className="view-heading"><h1>Extrato de recompensas</h1><p>Movimentações de XP e moedas do seu personagem.</p></header>
          <section className="surface overview" aria-label="Lançamentos do extrato">
            {ledger.isPending && <p role="status">Carregando extrato…</p>}
            {ledger.isError && <Alert severity="error" action={<Button onClick={() => ledger.refetch()}>Tentar novamente</Button>}>Não foi possível carregar o extrato.</Alert>}
            {ledger.data?.pages[0].entries.length === 0 && <p>Ainda não há movimentações.</p>}
            <ul className="list">{ledger.data?.pages.flatMap(page => page.entries).map(item => <li key={item.id}>
              <div><strong>{item.title}</strong><time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time></div>
              <div><strong className="orange">{item.xpDelta > 0 ? '+' : ''}{number.format(item.xpDelta)} XP · {item.coinDelta > 0 ? '+' : ''}{number.format(item.coinDelta)} moedas</strong>
                <p>Saldo: {totals(item.totalXp, item.goldCoins)}</p></div>
            </li>)}</ul>
            {ledger.hasNextPage && <Button disabled={ledger.isFetchingNextPage} onClick={() => ledger.fetchNextPage()}>Carregar mais</Button>}
          </section>
        </section>}
        {view === 'perfil' && profile.data?.profile && <Profile profile={profile.data.profile} onSave={value => {
          client.setQueryData(['hero'], { profile: value }); void client.invalidateQueries({ queryKey: ['dashboard'] }); navigate('inicio')
        }} onSignOut={signOut} />}
      </main>
    </div>
    <nav className="bottom-menu" aria-label="Menu principal móvel">{menus}</nav>
  </div>
}
