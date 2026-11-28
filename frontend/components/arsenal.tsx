'use client'

import { useRef, useState } from 'react'
import { Alert, Button, ButtonBase, Chip, MenuItem, Pagination, Tab, Tabs, TextField } from '@mui/material'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { calculateGearBonusSummary, EQUIPMENT_CATALOG, EQUIPMENT_SETS } from '../../src/utils/rpgLogic'
import { api, number, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { WarriorAvatar } from './warrior-avatar'
import { resolveAvatarStyle, type AvatarPreferences } from '../lib/avatar-preferences'
import { EquipmentArt } from './equipment-art'
import { idResult, itemsResult, loadoutsResult, refreshRpg, slots, type ArmoryInput } from '../lib/rpg-api'

const preset = z.object({ name: z.string().trim().min(1, 'Informe o nome do conjunto.').max(60) })
type Slot = keyof typeof slots
type Track = 'all' | 'rank_cacador' | 'reino_murim' | 'inicial'
type Order = 'catalog' | 'price' | 'xp' | 'coins' | 'boss'
const PAGE_SIZE = 24
const catalog = new Map(EQUIPMENT_CATALOG.map(item => [item.id, item]))
const trackLabels = { rank_cacador: 'Caçador', reino_murim: 'Murim', inicial: 'Inicial' } as const
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
function difference(value: number, unit: string) {
  return value === 0 ? 'Sem mudança' : (value > 0 ? '+' : '−') + number.format(Math.abs(value)) + ' ' + unit
}

type ArsenalProps = { coins?: number; heroName?: string; rank?: string; realm?: string; preferences: AvatarPreferences; onSettings: () => void; onLedger: () => void }

export function Arsenal({ coins, heroName, rank, realm, preferences, onSettings, onLedger }: ArsenalProps) {
  const client = useQueryClient()
  const items = useQuery({ queryKey: ['arsenal'], queryFn: async () => read(await api.GET('/api/arsenal'), itemsResult) })
  const loadouts = useQuery({ queryKey: ['loadouts'], queryFn: async () => read(await api.GET('/api/arsenal/conjuntos'), loadoutsResult) })
  const [search, setSearch] = useState('')
  const [slot, setSlot] = useState<Slot | 'all'>('all')
  const [rarity, setRarity] = useState('all')
  const [set, setSet] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [track, setTrack] = useState<Track>('all')
  const [order, setOrder] = useState<Order>('catalog')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'catalog' | 'sets'>('catalog')
  const [previewId, setPreviewId] = useState<string>()
  const [attack, setAttack] = useState(0)
  const [message, setMessage] = useState('')
  const draft = useRef<{ id: string; name: string }>(null)
  const equipmentHeading = useRef<HTMLHeadingElement>(null)
  const previewTrigger = useRef<HTMLButtonElement>(null)
  const form = useForm({ resolver: zodResolver(preset), defaultValues: { name: '' } })
  const { ref, ...nameInput } = form.register('name')

  const mutation = useMutation({
    mutationFn: async (body: ArmoryInput) => {
      if (body.action === 'buy' || body.action === 'equip') {
        read(await api.POST('/api/arsenal', { body }), idResult)
      } else if (body.action === 'save' || body.action === 'apply' || body.action === 'delete') {
        const preset = body.action === 'save' ? body : { id: body.id, action: body.action }
        client.setQueryData(['loadouts'], read(await api.POST('/api/arsenal/conjuntos', { body: preset }), loadoutsResult))
      }
    },
    onSuccess: async (_, body) => {
      if (body.action === 'save') { form.reset(); draft.current = null }
      setMessage({
        buy: items.data?.find(item => item.id === body.id)?.acquisition === 'reward' ? 'Recompensa resgatada.' : 'Equipamento comprado.', equip: 'Equipamento ativo atualizado.', save: 'Conjunto salvo.',
        apply: 'Conjunto equipado.', delete: 'Conjunto excluído.',
      }[body.action])
      await refreshRpg(client, 'arsenal', 'loadouts')
      if (body.action === 'equip') setPreviewId(current => current === body.id ? undefined : current)
    },
  })
  const run = (body: ArmoryInput) => { setMessage(''); mutation.mutate(body) }
  const term = normalize(search.trim())
  const equipped = items.data?.filter(item => item.equipped)
  const characterStyle = resolveAvatarStyle(preferences.style, equipped)
  const characterTrack = characterStyle === 'murim' ? 'reino_murim' : 'rank_cacador'
  const effectiveTrack = !preferences.mixed && track !== 'all' && track !== 'inicial' && track !== characterTrack ? 'all' : track
  const preview = items.data?.find(item => item.id === previewId)
  const shownGear = preview
    ? [...(equipped ?? []).filter(item => item.slot !== preview.slot), { ...preview, equipped: true }]
    : equipped
  function summarize(gear: typeof equipped) {
    return gear && calculateGearBonusSummary({
      elmo: gear.find(item => item.slot === 'elmo')?.id ?? null,
      armadura: gear.find(item => item.slot === 'armadura')?.id ?? null,
      capa: gear.find(item => item.slot === 'capa')?.id ?? null,
      arma: gear.find(item => item.slot === 'arma')?.id ?? null,
    })
  }
  const currentSummary = summarize(equipped)
  const summary = preview ? summarize(shownGear) : currentSummary
  const metrics = summary && [
    { label: 'Bônus de XP', value: summary.xpBonusPercent, previous: currentSummary?.xpBonusPercent, unit: '%', deltaUnit: 'p.p.', color: 'green' },
    { label: 'Bônus de moedas', value: summary.coinBonusPercent, previous: currentSummary?.coinBonusPercent, unit: '%', deltaUnit: 'p.p.', color: 'orange' },
    { label: 'Dano em chefes', value: summary.bossDamageBonusPercent, previous: currentSummary?.bossDamageBonusPercent, unit: '%', deltaUnit: 'p.p.', color: '' },
    { label: 'Poder total', value: summary.totalPowerScore, previous: currentSummary?.totalPowerScore, unit: ' pts', deltaUnit: 'pts', color: '' },
  ]
  const filtered = items.data?.filter(item => {
    const definition = catalog.get(item.id)
    return (slot === 'all' || item.slot === slot)
      && (rarity === 'all' || item.rarity === rarity)
      && (set === 'all' || item.setId === set)
      && (preferences.mixed || definition?.requirement.tipo === characterTrack || definition?.requirement.tipo === 'inicial')
      && (effectiveTrack === 'all' || definition?.requirement.tipo === effectiveTrack)
      && (ownership === 'all' || (ownership === 'owned' ? item.owned : !item.owned && item.unlock.met && (ownership === 'rewards' ? item.acquisition === 'reward' : item.acquisition === 'purchase')))
      && (normalize(item.name).includes(term) || normalize(item.description).includes(term))
  })
  const ordered = filtered && (order === 'catalog' ? filtered : [...filtered].sort((a, b) => {
    if (order === 'price') return a.priceCoins - b.priceCoins
    const key = order === 'xp' ? 'xpBonusPercent' : order === 'coins' ? 'coinBonusPercent' : 'bossDamageBonusPercent'
    return (catalog.get(b.id)?.[key] ?? 0) - (catalog.get(a.id)?.[key] ?? 0)
  }))
  const pageCount = Math.max(1, Math.ceil((ordered?.length ?? 0) / PAGE_SIZE))
  const activePage = Math.min(page, pageCount)
  const visibleItems = ordered?.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const availableRewards = items.data?.filter(item => !item.owned && item.unlock.met && item.acquisition === 'reward').length ?? 0
  function resetFilters() {
    setSearch(''); setSlot('all'); setRarity('all'); setSet('all'); setOwnership('all'); setTrack('all'); setOrder('catalog'); setPage(1)
  }

  function showPreview(id: string, trigger: HTMLButtonElement) {
    previewTrigger.current = trigger
    setPreviewId(id)
    equipmentHeading.current?.focus({ preventScroll: true })
    equipmentHeading.current?.scrollIntoView({ block: 'start' })
  }

  function clearPreview() {
    setPreviewId(undefined)
    if (tab === 'catalog' && previewTrigger.current?.isConnected) previewTrigger.current.focus()
    else equipmentHeading.current?.focus()
  }

  return <section className="view arsenal-view" aria-labelledby="arsenal-heading">
    <header className="view-heading arsenal-heading">
      <div>
        <h1 id="arsenal-heading">Arsenal · Caçadores e Murim</h1>
        {items.data && <p>{items.data.length} peças catalogadas · {items.data.filter(item => item.unlock.met || item.owned).length} desbloqueadas</p>}
      </div>
      <div className="row arsenal-actions">
        {coins !== undefined && <strong className="orange mono">{number.format(coins)} moedas</strong>}
        <Button variant="outlined" onClick={() => {
          setTab('sets')
          document.getElementById('gear-tab-sets')?.focus()
        }}>Ver conjuntos</Button>
        <Button component={Link} href="/?tab=extrato" variant="outlined" onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onLedger()
        }}>Ver extrato</Button>
      </div>
    </header>
    {items.data && availableRewards > 0 && <Alert severity="success" action={<Button color="inherit" onClick={() => {
      resetFilters(); setOwnership('rewards'); setTab('catalog')
      requestAnimationFrame(() => document.getElementById('gear-tab-catalog')?.focus())
    }}>Ver recompensas</Button>}>{availableRewards} {availableRewards === 1 ? 'recompensa disponível' : 'recompensas disponíveis'} para resgatar.</Alert>}
    {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    {message && <p className="green" role="status">{message}</p>}
    {(items.isError || loadouts.isError) && <Alert severity="error" action={<Button onClick={() => {void items.refetch(); void loadouts.refetch()}}>Tentar novamente</Button>}>Não foi possível carregar todo o arsenal.</Alert>}
    <section className="surface arsenal-equipment" aria-labelledby="arsenal-equipped">
      <header className="arsenal-equipment-heading">
        <div>
          <h2 id="arsenal-equipped" ref={equipmentHeading} tabIndex={-1}>{heroName || 'Equipamento ativo'}</h2>
          {(rank || realm) && <p className="muted">{[rank && 'Rank ' + rank, realm].filter(Boolean).join(' · ')}</p>}
        </div>
        {summary && <div className="row">
          <Chip size="small" variant="outlined" label={`${shownGear?.length}/4 slots`} />
          <Chip size="small" variant="outlined" color="primary" label={`Aura ${summary.dominantRarity} · ${summary.auraMultiplier.toFixed(2).replace('.', ',')}×`} />
        </div>}
      </header>
      <div className="active-gear">
        <div className="arsenal-stage">
          <WarriorAvatar size={224} gear={shownGear} attack={attack} avatarStyle={preferences.style} appearances={preferences} />
          <Button variant="outlined" onClick={onSettings} startIcon={<span aria-hidden="true">⚙</span>}>Personalizar personagem</Button>
          <p className="muted">{characterStyle === 'murim' ? 'Murim' : 'Caçador'} · {preferences.mixed ? 'Equipamentos mistos' : 'Catálogo da trilha'}</p>
          <Button variant="outlined" disabled={!shownGear?.some(item => item.slot === 'arma')}
            onClick={() => setAttack(value => value + 1)}>Testar golpe</Button>
        </div>
        <ul className="gear-slots" aria-label="Slots de equipamento">{Object.entries(slots).map(([id, label]) => {
          const item = shownGear?.find(gear => gear.slot === id)
          const isPreview = preview?.slot === id
          return <li key={id}>
            <ButtonBase className="surface inset gear-slot" data-preview={isPreview} onClick={() => {
              setTab('catalog')
              setSlot(id as Slot); setPage(1)
              requestAnimationFrame(() => document.getElementById('gear-filter-' + id)?.focus())
            }}>
              <span className="muted">{label}</span>
              {item && <EquipmentArt id={item.id} compact />}
              <strong>{item?.name ?? (shownGear ? 'Sem peça' : '—')}</strong>
              {item && <span className={isPreview ? 'orange' : 'muted'}>{isPreview ? 'Prévia' : 'Equipado'}</span>}
            </ButtonBase>
          </li>
        })}</ul>
      </div>
      <div className="arsenal-preview">
        <p className="orange" role="status">{preview && 'Prévia: ' + preview.name}</p>
        {preview && <p className="muted">{preview.owned ? 'No inventário' : preview.unlock.progressText}</p>}
        {preview && <div className="row">
          {!preview.owned && preview.unlock.met && preview.acquisition === 'reward' && <Button variant="contained" disabled={mutation.isPending} onClick={() => run({ action: 'buy', id: preview.id })}>Resgatar recompensa</Button>}
          {!preview.owned && preview.acquisition === 'purchase' && <Button variant="contained" disabled={mutation.isPending || !preview.unlock.met || coins === undefined || coins < preview.priceCoins}
            onClick={() => run({ action: 'buy', id: preview.id })}>Comprar por {number.format(preview.priceCoins)} moedas</Button>}
          {preview?.owned && !preview.equipped && <Button variant="contained" disabled={mutation.isPending} onClick={() => {
            equipmentHeading.current?.focus()
            run({ action: 'equip', id: preview.id })
          }}>Equipar no mascote</Button>}
          <Button variant="outlined" onClick={clearPreview}>Limpar prévia</Button>
        </div>}
      </div>
    </section>
    {summary && <section className="arsenal-bonuses" aria-label={preview ? 'Bônus da prévia' : 'Bônus do equipamento'}>
      <dl className="surface arsenal-stats">
        {metrics?.map(metric => <div key={metric.label}>
          <dt>{metric.label}</dt><dd className={metric.color}>{metric.unit === '%' ? '+' : ''}{number.format(metric.value)}{metric.unit}
          {preview && metric.previous !== undefined && <span className="arsenal-delta" data-direction={Math.sign(metric.value - metric.previous)}>{difference(metric.value - metric.previous, metric.deltaUnit)} em relação ao ativo</span>}</dd>
        </div>)}
      </dl>
      {summary.activeSets.map(({ set, equippedCount, twoPieceActive, fourPieceActive }) => <div className="surface arsenal-set-bonus" key={set.id}>
        <span className="orange">{set.name} · {equippedCount}/4</span>
        <span>{fourPieceActive ? set.fourPieceBonus?.label : twoPieceActive ? set.twoPieceBonus.label : 'Bônus a partir de 2 peças'}</span>
      </div>)}
    </section>}
    <section className="surface overview arsenal-loadouts" aria-labelledby="arsenal-loadouts">
      <h2 id="arsenal-loadouts">Conjuntos salvos</h2>
      <p className="muted">Salve um conjunto de equipamento ativo para cada personagem. Aplicar é uma ação explícita; a troca de aparência não altera os bônus.</p>
      <div className="rpg-grid">{(['Murim', 'Caçador'] as const).map(character => {
        const title = 'Personagem · ' + character
        const saved = loadouts.data?.find(item => item.name === title)
        return <div key={character} className="surface inset overview">
          <h3>{character}</h3>
          {saved ? <><p>{Object.values(saved.gear).filter(Boolean).length}/4 peças salvas</p>
            <Button variant="outlined" disabled={mutation.isPending} onClick={() => run({ action: 'apply', id: saved.id })}>Equipar conjunto {character}</Button></> :
            <Button variant="outlined" disabled={mutation.isPending || items.isPending || loadouts.isPending || !items.data || !loadouts.data} onClick={() => {
              if (!draft.current || draft.current.name !== title) draft.current = { id: crypto.randomUUID(), name: title }
              run({ action: 'save', ...draft.current })
            }}>Salvar conjunto {character}</Button>}
        </div>
      })}</div>
      <form className="inline-form" noValidate onSubmit={form.handleSubmit(({ name }) => {
        if (!draft.current || draft.current.name !== name) draft.current = { id: crypto.randomUUID(), name }
        run({ action: 'save', ...draft.current })
      })}>
        <TextField {...nameInput} inputRef={ref} label="Nome do conjunto" size="small" error={!!form.formState.errors.name}
          helperText={form.formState.errors.name?.message} slotProps={{ htmlInput: { maxLength: 60 } }} />
        <Button type="submit" variant="outlined" disabled={mutation.isPending || items.isPending || loadouts.isPending}>Salvar equipamento atual</Button>
      </form>
      {loadouts.data?.length === 0 && <p>Nenhum conjunto salvo.</p>}
      {loadouts.data?.map(item => <article key={item.id} className="surface inset rpg-row"><h3>{item.name}</h3><div className="row">
        <Button variant="outlined" disabled={mutation.isPending} onClick={() => run({ action: 'apply', id: item.id })}>Equipar conjunto</Button>
        <Button color="error" disabled={mutation.isPending} onClick={() => run({ action: 'delete', id: item.id })}>Excluir conjunto</Button>
      </div></article>)}
    </section>
    <Tabs value={tab} onChange={(_, value: 'catalog' | 'sets') => setTab(value)} aria-label="Seções do Arsenal">
      <Tab id="gear-tab-catalog" aria-controls="gear-catalog" label="Catálogo" value="catalog" />
      <Tab id="gear-tab-sets" aria-controls="gear-sets" label="Conjuntos" value="sets" />
    </Tabs>
    <div className="view" id="gear-catalog" role="tabpanel" aria-labelledby="gear-tab-catalog" hidden={tab !== 'catalog'}>
      <section className="surface catalog-filter" aria-label="Filtros de equipamentos">
        <TextField label="Buscar equipamento" value={search} onChange={event => {setSearch(event.target.value); setPage(1)}} fullWidth size="small" />
        <div className="filter-row" role="group" aria-label="Tipo de equipamento">
          <Button variant={slot === 'all' ? 'contained' : 'outlined'} aria-pressed={slot === 'all'} onClick={() => {setSlot('all'); setPage(1)}}>Todos</Button>
          {(Object.keys(slots) as Slot[]).map(id => <Button key={id} id={'gear-filter-' + id} variant={slot === id ? 'contained' : 'outlined'} aria-pressed={slot === id} onClick={() => {setSlot(id); setPage(1)}}>{slots[id]}</Button>)}
        </div>
        <div className="rpg-grid">
          <TextField label="Trilha" select size="small" value={effectiveTrack} onChange={event => {setTrack(event.target.value as Track); setPage(1)}}>
            <MenuItem value="all">{preferences.mixed ? 'Ambas as trilhas' : 'Trilha e iniciais'}</MenuItem><MenuItem value="rank_cacador" disabled={!preferences.mixed && characterTrack !== 'rank_cacador'}>Caçador</MenuItem><MenuItem value="reino_murim" disabled={!preferences.mixed && characterTrack !== 'reino_murim'}>Murim</MenuItem><MenuItem value="inicial">Inicial</MenuItem>
          </TextField>
          <TextField label="Ordenar por" select size="small" value={order} onChange={event => {setOrder(event.target.value as Order); setPage(1)}}>
            <MenuItem value="catalog">Catálogo</MenuItem><MenuItem value="price">Menor preço</MenuItem><MenuItem value="xp">Maior XP</MenuItem><MenuItem value="coins">Mais moedas</MenuItem><MenuItem value="boss">Dano em chefes</MenuItem>
          </TextField>
          <TextField label="Raridade" select size="small" value={rarity} onChange={event => {setRarity(event.target.value); setPage(1)}}>
            <MenuItem value="all">Todas</MenuItem>{['Comum', 'Raro', 'Épico', 'Lendário'].map(label => <MenuItem key={label} value={label}>{label}</MenuItem>)}
          </TextField>
          <TextField label="Mostrar" select size="small" value={ownership} onChange={event => {setOwnership(event.target.value); setPage(1)}}>
            <MenuItem value="all">Catálogo completo</MenuItem><MenuItem value="owned">Meus equipamentos</MenuItem><MenuItem value="available">Liberados para compra</MenuItem><MenuItem value="rewards">Recompensas disponíveis</MenuItem>
          </TextField>
          <TextField label="Conjunto" select size="small" value={set} onChange={event => {setSet(event.target.value); setPage(1)}}>
            <MenuItem value="all">Todos</MenuItem>{EQUIPMENT_SETS.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
        </div>
        <div className="arsenal-results"><p role="status">{filtered?.length ?? 0} de {items.data?.length ?? 0} equipamentos</p><Button variant="outlined" onClick={resetFilters}>Limpar filtros</Button></div>
      </section>
      {items.isPending && <p role="status">Carregando arsenal…</p>}
      {filtered?.length === 0 && <p role="status">Nenhum equipamento nesta seleção.</p>}
      <div className="workout-grid arsenal-cards">{visibleItems?.map(item => <article className={'surface workout-card' + (item.equipped ? ' fulfilled' : '')} aria-label={item.name} key={item.id}>
        <div className="arsenal-card-meta"><small className="gear-rarity mono">{slots[item.slot]} · {item.rarity} · {(() => { const kind = catalog.get(item.id)?.requirement.tipo; return kind === 'rank_cacador' || kind === 'reino_murim' || kind === 'inicial' ? trackLabels[kind] : '—' })()}</small>
          {item.equipped && <span className="green">Equipado</span>}{item.acquisition === 'reward' && !item.owned && <Chip size="small" label="Recompensa de marco" color="success" variant="outlined" /> }</div><h2>{item.name}</h2>
        <div className="equipment-card-art"><EquipmentArt id={item.id} /></div>
        <p>{item.description}</p><p className="orange">{item.powerBonusLabel}</p>
        {!item.owned && <p>{item.unlock.progressText}</p>}
        {!item.owned && item.acquisition === 'purchase' && <p>{number.format(item.priceCoins)} moedas{item.unlock.met && coins !== undefined && coins < item.priceCoins ? ' · Saldo insuficiente' : ''}</p>}
        <div className="row">
          <Button variant="outlined" aria-pressed={previewId === item.id} onClick={event => showPreview(item.id, event.currentTarget)}>Visualizar</Button>
          {!item.equipped && (item.owned ?
            <Button variant="outlined" disabled={mutation.isPending} onClick={() => run({ action: 'equip', id: item.id })}>Equipar</Button> :
            item.acquisition === 'reward' ? (item.unlock.met && <Button variant="contained" disabled={mutation.isPending} onClick={() => run({ action: 'buy', id: item.id })}>Resgatar recompensa</Button>) :
            <Button variant="outlined" disabled={mutation.isPending || !item.unlock.met || coins === undefined || coins < item.priceCoins}
              onClick={() => run({ action: 'buy', id: item.id })}>Comprar por {number.format(item.priceCoins)} moedas</Button>)}
        </div>
      </article>)}</div>
      {pageCount > 1 && <Pagination className="arsenal-pagination" count={pageCount} page={activePage} onChange={(_, next) => {
        setPage(next)
        document.getElementById('gear-tab-catalog')?.focus()
      }} getItemAriaLabel={(type, p, selected) => type === 'page' ? (selected ? 'Página atual ' : 'Ir para página ') + p : ({ first: 'Primeira página', last: 'Última página', next: 'Próxima página', previous: 'Página anterior', 'start-ellipsis': 'Páginas anteriores', 'end-ellipsis': 'Mais páginas' })[type]} />}
    </div>
    <div className="workout-grid" id="gear-sets" role="tabpanel" aria-labelledby="gear-tab-sets" hidden={tab !== 'sets'}>
      {EQUIPMENT_SETS.map(item => <article key={item.id} className="surface workout-card">
        <h2>{item.name}</h2><p>{item.description}</p><p>2 peças · {item.twoPieceBonus.label}</p>
        {item.fourPieceBonus && <p>4 peças · {item.fourPieceBonus.label}</p>}
        <Button variant="outlined" onClick={() => {
          resetFilters(); setSet(item.id); setTab('catalog')
          requestAnimationFrame(() => document.getElementById('gear-tab-catalog')?.focus())
        }}>Ver peças de {item.name}</Button>
      </article>)}
    </div>
  </section>
}
