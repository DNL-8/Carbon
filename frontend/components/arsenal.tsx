'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Tab, Tabs, TextField } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EQUIPMENT_SETS } from '../../src/utils/rpgLogic'
import { api, number, read } from '../lib/api'
import { errorMessage } from '../lib/auth'
import { idResult, itemsResult, loadoutsResult, refreshRpg, slots, type ArmoryInput } from '../lib/rpg-api'

const preset = z.object({ name: z.string().trim().min(1, 'Informe o nome do conjunto.').max(60) })
type Item = z.infer<typeof itemsResult>[number]
type Slot = keyof typeof slots

export function Arsenal({ coins }: { coins?: number }) {
  const client = useQueryClient()
  const items = useQuery({ queryKey: ['arsenal'], queryFn: async () => read(await api.GET('/api/arsenal'), itemsResult) })
  const loadouts = useQuery({ queryKey: ['loadouts'], queryFn: async () => read(await api.GET('/api/arsenal/conjuntos'), loadoutsResult) })
  const [search, setSearch] = useState('')
  const [slot, setSlot] = useState<Slot | 'all'>('all')
  const [rarity, setRarity] = useState('all')
  const [set, setSet] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [tab, setTab] = useState<'catalog' | 'sets'>('catalog')
  const [preview, setPreview] = useState<Item>()
  const [message, setMessage] = useState('')
  const draft = useRef<{ id: string; name: string }>(null)
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
        buy: 'Equipamento comprado.', equip: 'Equipamento ativo atualizado.', save: 'Conjunto salvo.',
        apply: 'Conjunto equipado.', delete: 'Conjunto excluído.',
      }[body.action])
      await refreshRpg(client, 'arsenal', 'loadouts')
    },
  })
  const run = (body: ArmoryInput) => { setMessage(''); mutation.mutate(body) }
  const term = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = items.data?.filter(item => (slot === 'all' || item.slot === slot) && (rarity === 'all' || item.rarity === rarity)
    && (set === 'all' || item.setId === set) && (ownership === 'all' || (ownership === 'owned' ? item.owned : !item.owned && item.unlock.met))
    && (item.name.toLocaleLowerCase('pt-BR').includes(term) || item.description.toLocaleLowerCase('pt-BR').includes(term)))

  return <section className="view" aria-labelledby="arsenal-heading">
    <header className="view-heading"><h1 id="arsenal-heading">Arsenal</h1><p>{coins === undefined ? 'Carregando saldo…' : number.format(coins) + ' moedas disponíveis'}</p></header>
    {mutation.error && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    {message && <p className="green" role="status">{message}</p>}
    {(items.isError || loadouts.isError) && <Alert severity="error" action={<Button onClick={() => {void items.refetch(); void loadouts.refetch()}}>Tentar novamente</Button>}>Não foi possível carregar todo o arsenal.</Alert>}
    <section className="surface overview" aria-labelledby="arsenal-equipped">
      <h2 id="arsenal-equipped">Equipamento ativo</h2>
      <div className="active-gear">
        <img src="/assets/mascote-murim.svg" width="88" height="88" alt="" />
        <dl className="gear-slots">{Object.entries(slots).map(([id, label]) => <div className="surface inset" key={id}>
          <dt>{label}</dt><dd>{items.data?.find(i => i.slot === id && i.equipped)?.name ?? '—'}</dd>
        </div>)}</dl>
      </div>
      <h3>Presets de loadout</h3>
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
        <TextField label="Buscar equipamento" value={search} onChange={event => setSearch(event.target.value)} fullWidth size="small" />
        <div className="filter-row" role="group" aria-label="Tipo de equipamento">
          <Button variant={slot === 'all' ? 'contained' : 'outlined'} aria-pressed={slot === 'all'} onClick={() => setSlot('all')}>Todos</Button>
          {(Object.keys(slots) as Slot[]).map(id => <Button key={id} variant={slot === id ? 'contained' : 'outlined'} aria-pressed={slot === id} onClick={() => setSlot(id)}>{slots[id]}</Button>)}
        </div>
        <div className="rpg-grid">
          <TextField label="Raridade" select size="small" value={rarity} onChange={event => setRarity(event.target.value)}>
            <MenuItem value="all">Todas</MenuItem>{['Comum', 'Raro', 'Épico', 'Lendário'].map(label => <MenuItem key={label} value={label}>{label}</MenuItem>)}
          </TextField>
          <TextField label="Mostrar" select size="small" value={ownership} onChange={event => setOwnership(event.target.value)}>
            <MenuItem value="all">Catálogo completo</MenuItem><MenuItem value="owned">Meus equipamentos</MenuItem><MenuItem value="available">Liberados para compra</MenuItem>
          </TextField>
          <TextField label="Conjunto" select size="small" value={set} onChange={event => setSet(event.target.value)}>
            <MenuItem value="all">Todos</MenuItem>{EQUIPMENT_SETS.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
        </div>
      </section>
      {items.isPending && <p role="status">Carregando arsenal…</p>}
      {filtered?.length === 0 && <p role="status">Nenhum equipamento nesta seleção.</p>}
      <div className="workout-grid">{filtered?.map(item => <article className={'surface workout-card' + (item.equipped ? ' fulfilled' : '')} aria-label={item.name} key={item.id}>
        <small className="gear-rarity mono">{slots[item.slot]} · {item.rarity}</small><h2>{item.name}</h2>
        <p>{item.description}</p><p className="orange">{item.powerBonusLabel}</p>
        {!item.owned && !item.unlock.met && <p>{item.unlock.progressText}</p>}
        <div className="row">
          <Button variant="outlined" onClick={() => setPreview(item)}>Visualizar</Button>
          {item.equipped ? <Chip color="success" size="small" label="Equipado" /> : item.owned ?
            <Button variant="outlined" disabled={mutation.isPending} onClick={() => run({ action: 'equip', id: item.id })}>Equipar</Button> :
            <Button variant="outlined" disabled={mutation.isPending || !item.unlock.met || coins === undefined || coins < item.priceCoins}
              onClick={() => run({ action: 'buy', id: item.id })}>Comprar por {number.format(item.priceCoins)} moedas</Button>}
        </div>
      </article>)}</div>
    </div>
    <div className="workout-grid" id="gear-sets" role="tabpanel" aria-labelledby="gear-tab-sets" hidden={tab !== 'sets'}>
      {EQUIPMENT_SETS.map(item => <article key={item.id} className="surface workout-card">
        <h2>{item.name}</h2><p>{item.description}</p><p>2 peças · {item.twoPieceBonus.label}</p>
        {item.fourPieceBonus && <p>4 peças · {item.fourPieceBonus.label}</p>}
        <Button variant="outlined" onClick={() => {
          setSet(item.id); setSlot('all'); setRarity('all'); setSearch(''); setOwnership('all'); setTab('catalog')
          requestAnimationFrame(() => document.getElementById('gear-tab-catalog')?.focus())
        }}>Ver peças de {item.name}</Button>
      </article>)}
    </div>
    <Dialog open={!!preview} onClose={() => setPreview(undefined)} aria-labelledby="equipment-title">
      <DialogTitle id="equipment-title">{preview?.name}</DialogTitle>
      <DialogContent><p>{preview?.description}</p><p className="orange">{preview?.powerBonusLabel}</p>
        {preview?.setId && <p>{EQUIPMENT_SETS.find(item => item.id === preview.setId)?.name}</p>}
        {preview && !preview.owned && <p>{preview.unlock.progressText}</p>}
      </DialogContent>
      <DialogActions><Button onClick={() => setPreview(undefined)}>Fechar</Button></DialogActions>
    </Dialog>
  </section>
}
