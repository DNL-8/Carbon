<script setup lang="ts">
import { navigateTabs } from '../utils/tab-keyboard'
import type { ProfileInput } from '../../shared/training'
import { useOnline } from '@vueuse/core'
import type { EquippedGear, EquipmentSlot, NavTab, WorkoutTemplate } from '../../../src/types/fitness'
import { getLevelProgress, getHunterRankDefinition, calculateGearBonusSummary, DEFAULT_EQUIPPED_GEAR, ARSENAL_CONFIG, EQUIPMENT_SETS, WARRIOR_AWAKENING_PROGRAM, HYBRID_CALISTHENICS_PROGRAM } from '../../../src/utils/rpgLogic'

const props = defineProps<{ progress?: { rank: string, xp: number, coins: number, level: number, realm: string, hp: number, equippedGear?: EquippedGear } | null, activeTab: NavTab, workouts: WorkoutTemplate[], training: boolean }>()
const level = computed(() => props.progress ? getLevelProgress(props.progress.xp) : null)
const emit = defineEmits<{ start: [workout: WorkoutTemplate], changed: [], signOut: [], navigate: [tab: NavTab] }>()
defineExpose({ refresh: refreshDashboard })
const { data: overview, error: overviewError, pending: overviewPending, refresh: refreshOverview } = await useFetch('/api/painel', { key: 'hero:overview' })
const { data: hero } = useNuxtData<{ profile: ProfileInput | null }>('hero:profile')
const { data: mission, error: missionError, pending: missionPending, refresh: refreshMission } = await useFetch('/api/missao', { key: 'hero:mission' })
const panelTab = ref<'visao-geral' | 'treinos' | 'arsenal'>('visao-geral')
const needsEquipment = computed(() => props.activeTab === 'arsenal' || (props.activeTab === 'painel' && panelTab.value === 'arsenal'))
const needsAchievements = computed(() => props.activeTab === 'perfil')
const { data: gear, error: gearError, pending: gearPending, status: gearStatus, refresh: refreshGear } = await useFetch('/api/arsenal', {
  key: 'hero:arsenal', immediate: needsEquipment.value,
})
const { data: achievements, status: achievementsStatus, refresh: refreshAchievements } = await useFetch('/api/conquistas', {
  key: 'hero:achievements', immediate: needsAchievements.value,
})
const { data: vows, refresh: refreshVows } = await useFetch('/api/votos', { key: 'hero:vows' })
const { data: loadouts, status: loadoutsStatus, execute: fetchLoadouts } = await useFetch('/api/arsenal/conjuntos', {
  key: 'hero:loadouts', immediate: needsEquipment.value,
})
watch(needsEquipment, active => {
  if (!active) return
  if (gearStatus.value === 'idle') void refreshGear()
  if (loadoutsStatus.value === 'idle' || loadoutsStatus.value === 'error') void fetchLoadouts()
})
watch(needsAchievements, active => {
  if (active && (achievementsStatus.value === 'idle' || achievementsStatus.value === 'error')) void refreshAchievements()
})
function refreshGearIfLoaded() {
  if (gearStatus.value !== 'idle') return refreshGear()
}
function refreshAchievementsIfLoaded() {
  if (achievementsStatus.value !== 'idle') return refreshAchievements()
}
const ledgerView = ref<{ refresh: () => Promise<void> }>()
const profile = reactive<ProfileInput>(hero.value?.profile ?? {
  name: '', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante',
})
const feedback = ref('')
const busy = ref(false)
const vowTitle = ref('')
const loadoutName = ref('')
const display = useInterfaceStore()
const equipmentSlot = ref<EquipmentSlot | 'all'>('all')
const rarity = ref('Todos')
const searchEquipment = ref('')
const setFilter = ref('Todos')
const previewId = ref<string | null>(null)
const equipError = ref('')
const equippedNotice = ref<{ id: number, name: string } | null>(null)
let equipSequence = 0
let previewTrigger: HTMLElement | undefined
const catalogSection = ref<'catalogo' | 'conjuntos' | 'extrato'>('catalogo')
const currentGear = computed(() => {
  if (!gear.value) return props.progress?.equippedGear ?? DEFAULT_EQUIPPED_GEAR
  const equipped: EquippedGear = { elmo: null, armadura: null, capa: null, arma: null }
  for (const item of gear.value) if (item.equipped) equipped[item.slot] = item.id
  return equipped
})
const previewItem = computed(() => gear.value?.find(item => item.id === previewId.value))
const previewGear = computed(() => previewItem.value
  ? { ...currentGear.value, [previewItem.value.slot]: previewItem.value.id }
  : currentGear.value)
async function showPreview(id: string, event: MouseEvent) {
  previewTrigger = event.currentTarget as HTMLElement
  equippedNotice.value = null
  equipError.value = ''
  previewId.value = id
  await nextTick()
  document.getElementById('arsenal-ficha')?.focus()
}
async function clearPreview() {
  previewId.value = null
  await nextTick()
  if (previewTrigger?.isConnected) previewTrigger.focus()
  else document.getElementById('arsenal-ficha')?.focus()
  previewTrigger = undefined
}
async function filterEquipment(slot: EquipmentSlot) {
  equipmentSlot.value = slot
  catalogSection.value = 'catalogo'
  await nextTick()
  document.getElementById('arsenal-catalogo')?.focus()
}

const previewSummary = computed(() => calculateGearBonusSummary(previewGear.value))
const previewAura = computed(() => previewSummary.value.activeSets.find(item => item.fourPieceActive)?.set.themeColorHex
  ?? ARSENAL_CONFIG.raridades[previewSummary.value.dominantRarityKey].cor)
const currentSummary = computed(() => calculateGearBonusSummary(currentGear.value))
const equipmentSets = EQUIPMENT_SETS
const slots = ARSENAL_CONFIG.slots
const profileEdit = ref(false)
function openProfile() { feedback.value = ''; Object.assign(profile, { name: '', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante', avatar: undefined, heightCm: null, weightKg: null, restingHrBaseline: null, maxHrEstimated: null }, hero.value?.profile ?? {}); profileEdit.value = true }
const online = useOnline()
const pendingVow = ref<string | null>(null)
function confirmVow() { if (pendingVow.value) { const id = pendingVow.value; pendingVow.value = null; return resolveVow(id, 'violate') } }
const panelSearch = ref('')
const matchesPanel = (text: string) => text.toLowerCase().includes(panelSearch.value.trim().toLowerCase())
const panelWorkouts = computed(() => props.workouts.filter(item => matchesPanel(item.name + ' ' + item.description)))
const program = computed(() => props.progress?.rank === 'F' || !hero.value?.profile || hero.value.profile.experience === 'Iniciante' ? WARRIOR_AWAKENING_PROGRAM : HYBRID_CALISTHENICS_PROGRAM)
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
const schedule = computed(() => {
  const today = overview.value?.today
  const dayIndex = today ? new Date(today).getUTCDay() : -1
  const monday = today ? Date.parse(today) - ((dayIndex + 6) % 7) * 86_400_000 : 0
  return program.value.weeklySchedule.map(day => {
    const date = new Date(monday + ((day.dayIndex + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
    return { ...day, isToday: day.dayIndex === dayIndex, workout: props.workouts.find(item => item.id === day.workoutId), completed: overview.value?.workoutDates.some(item => item.dateKey === date && item.workoutId === day.workoutId) ?? false }
  })
})
const recommended = computed(() => schedule.value.find(day => day.isToday)?.workout ?? props.workouts.find(item => item.id === program.value.workoutAId) ?? props.workouts[0])
const telemetry = computed(() => [
  { label: 'Sequência atual', value: overview.value?.currentStreak ?? '—', detail: 'dias', icon: 'corpo_inteiro' as const },
  { label: 'Prontidão física', value: overview.value?.recovery ? overview.value.recovery.score + '%' : '—', detail: overview.value?.recovery?.statusLabel ?? 'Sem dados suficientes', icon: 'cardio' as const },
  { label: 'Chefes e treinos', value: overview.value?.bossesDefeated ?? '—', detail: overview.value ? '/ ' + (overview.value.totalWorkouts + overview.value.importedCount) + ' sessões' : '', icon: 'sword' as const },
  { label: 'Passos hoje', value: overview.value?.stepsToday?.toLocaleString('pt-BR') ?? '—', detail: '', icon: 'compass' as const },
])
const displayedGear = computed(() => (gear.value ?? []).filter(item => (
  (display.arsenalFilter === 'all' || (display.arsenalFilter === 'owned' ? item.owned : item.unlock.met && !item.owned))
  && (equipmentSlot.value === 'all' || equipmentSlot.value === item.slot)
  && (rarity.value === 'Todos' || rarity.value === item.rarity)
  && (setFilter.value === 'Todos' || setFilter.value === item.setId)
  && (item.name + ' ' + item.description).toLowerCase().includes(searchEquipment.value.trim().toLowerCase())
)))

async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  feedback.value = ''
  try {
    await action()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Tente novamente.'
  } finally {
    busy.value = false
  }
}

function refreshDashboard() {
  return Promise.all([
    refreshMission(), refreshGearIfLoaded(), refreshAchievementsIfLoaded(),
    refreshVows(), refreshOverview(), ledgerView.value?.refresh(),
  ])
}

function syncPanel() {
  return run(async () => {
    await refreshDashboard()
    emit('changed')
    feedback.value = 'Dados sincronizados.'
  })
}

function saveProfile(updated: ProfileInput) {
  return run(async () => {
    hero.value = await $fetch('/api/heroi', { method: 'PUT', body: updated })
    await refreshOverview()
    Object.assign(profile, updated)
    profileEdit.value = false
    feedback.value = 'Perfil salvo.'
  })
}

function claim(id: string) {
  return run(async () => {
    await $fetch('/api/missao', { method: 'POST', body: { id } })
    await Promise.all([refreshGearIfLoaded(), refreshMission(), refreshOverview(), refreshAchievementsIfLoaded()])
    emit('changed')
    await ledgerView.value?.refresh()
    feedback.value = 'Recompensa da missão resgatada.'
  })
}

function saveWeight(kg: number, dateKey: string) {
  return run(async () => {
    await $fetch('/api/saude/peso', { method: 'PUT', body: { kg, dateKey } })
    await Promise.all([refreshMission(), refreshOverview()])
    feedback.value = 'Peso registrado.'
  })
}

function removeWeight(dateKey: string) {
  return run(async () => {
    await $fetch('/api/saude/peso', { method: 'DELETE', body: { dateKey } })
    await Promise.all([refreshMission(), refreshOverview()])
    feedback.value = 'Registro de peso excluído.'
  })
}

function manageItem(id: string, action: 'buy' | 'equip') {
  return run(async () => {
    equipError.value = ''
    equippedNotice.value = null
    try {
      await $fetch('/api/arsenal', { method: 'POST', body: { id, action } })
    } catch (error) {
      if (action === 'buy') throw error
      equipError.value = 'Não foi possível equipar esta peça. Tente novamente.'
      return
    }
    await refreshGear()
    emit('changed')
    await ledgerView.value?.refresh()
    previewId.value = null
    previewTrigger = undefined
    if (action === 'equip') {
      equippedNotice.value = { id: ++equipSequence, name: gear.value?.find(item => item.id === id)?.name ?? 'Peça equipada' }
      await nextTick()
      document.getElementById('arsenal-ficha')?.focus()
    } else {
      feedback.value = 'Equipamento adquirido.'
    }
  })
}

function createVow() {
  return run(async () => {
    await $fetch('/api/votos', { method: 'POST', body: { id: crypto.randomUUID(), action: 'create', title: vowTitle.value } })
    vowTitle.value = ''
    await refreshVows()
    feedback.value = 'Voto criado.'
  })
}

function resolveVow(id: string, action: 'complete' | 'violate' | 'delete') {
  return run(async () => {
    await $fetch('/api/votos', { method: 'POST', body: { id, action } })
    await Promise.all([refreshVows(), refreshOverview(), refreshAchievementsIfLoaded()])
    emit('changed')
    await ledgerView.value?.refresh()
    feedback.value = action === 'delete' ? 'Voto removido.' : 'Voto registrado.'
  })
}

function manageLoadout(action: 'save' | 'apply' | 'delete', id?: string) {
  return run(async () => {
    loadouts.value = await $fetch('/api/arsenal/conjuntos', {
      method: 'POST', body: { action, id: id ?? crypto.randomUUID(), name: loadoutName.value },
    })
    if (action === 'save') loadoutName.value = ''
    if (action === 'apply') {
      await refreshGear()
      emit('changed')
    }
  })
}
</script>

<template>
  <section v-show="['inicio', 'painel', 'perfil', 'arsenal'].includes(activeTab)" class="hero hero-flat space-y-5" :aria-labelledby="activeTab === 'painel' ? 'panel-heading' : activeTab === 'arsenal' ? 'arsenal-heading' : activeTab === 'perfil' ? 'profile-heading' : 'hero-heading'">
    <header v-show="activeTab === 'inicio'" class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-3 min-w-0"><div class="w-16 h-16 rounded-lg bg-[#111113] border border-orange-500/45 flex items-center justify-center"><OriginalMascot :equipped-gear="progress?.equippedGear" size="md" /></div><div class="min-w-0"><div class="text-[11px] text-orange-400 font-mono-tabular uppercase tracking-wider">Sistema do caçador</div><h1 id="hero-heading" class="text-xl sm:text-2xl font-bold text-zinc-100 truncate tracking-tight">{{ hero?.profile?.name ?? 'Seu herói' }}</h1><p class="text-xs text-zinc-400">{{ hero?.profile?.heroClass ?? '—' }} · Nível {{ progress?.level ?? '—' }} · {{ mission?.daily.filter(q => q.isFulfilled).length ?? 0 }}/{{ mission?.daily.length ?? 0 }} missões automáticas</p></div></div><div class="flex flex-col items-end gap-2"><button type="button" class="panel-button" @click="emit('navigate', 'arsenal')">Equipar no Arsenal</button><span class="text-[11px] text-zinc-400">Objetivo: <strong class="text-zinc-200">{{ hero?.profile?.objective ?? '—' }}</strong></span></div></header>
    <section v-if="recommended" v-show="activeTab === 'inicio'" aria-label="Sessão recomendada" class="bg-[#18181B] border border-orange-500/45 rounded-lg p-5 space-y-4"><div class="flex justify-between text-xs text-orange-400"><span>Sessão recomendada · Rank {{ recommended.rank }}</span><span class="text-emerald-400">+{{ recommended.baseXp }} XP</span></div><h2 class="text-lg sm:text-xl font-bold text-zinc-100">{{ recommended.name }}</h2><p class="text-xs text-zinc-400">{{ recommended.description }}</p><p class="text-xs text-zinc-300">{{ recommended.difficulty }} · {{ recommended.durationMinutes }} min · {{ recommended.exercises.length }} exercícios</p><div class="flex gap-2"><button type="button" class="flex-1 min-h-[42px] rounded-md bg-orange-500 text-zinc-950 text-xs font-semibold disabled:opacity-50" :disabled="training || busy" @click="emit('start', recommended)">Iniciar treino</button><button type="button" class="panel-button" @click="emit('navigate', 'treinar')">Explorar treinos</button></div></section>
    <section v-show="activeTab === 'inicio'" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><div class="text-[11px] font-semibold uppercase tracking-wider text-orange-400">Agenda semanal · {{ program.weeklyFrequency }}x por semana</div><h2 class="text-base sm:text-lg font-bold text-zinc-100">{{ program.name }}</h2><p class="text-xs text-zinc-400">Equipamentos: {{ program.equipments.join(' · ') }}</p></div></div><div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2"><component :is="day.workout ? 'button' : 'div'" v-for="day in schedule" :key="day.dayIndex" :type="day.workout ? 'button' : undefined" :disabled="day.workout ? training || busy : undefined" class="min-h-[90px] p-3 rounded-md border text-left flex flex-col justify-between transition-colors" :class="day.completed ? 'bg-emerald-950/15 border-emerald-500/40' : day.isToday ? 'bg-[#111113] border-orange-500/60' : 'bg-[#111113] border-[#27272A]'" @click="day.workout && emit('start', day.workout)"><div class="flex justify-between text-[11px] font-semibold uppercase"><span>{{ day.shortDay }}</span><span v-if="day.completed" class="text-emerald-400">✓</span><span v-else-if="day.isToday" class="text-orange-400">Hoje</span></div><div><div class="text-sm font-bold text-zinc-100">{{ day.workout ? day.sessionCode : 'Descanso' }}</div><div class="text-[11px] text-zinc-400">{{ day.shortFocus ?? day.focus }}</div></div></component></div></section>
    <template v-if="activeTab === 'inicio' || activeTab === 'painel'">
      <MurimDataState v-if="overviewError" kind="error" message="Falha ao carregar sua evolução." retry @retry="refreshOverview()" />
      <MurimDataState v-else-if="overviewPending" kind="loading" message="Carregando evolução…" />
      <MurimDataState v-if="missionError" kind="error" message="Falha ao carregar as missões." retry @retry="refreshMission()" />
      <MurimDataState v-else-if="missionPending" kind="loading" message="Carregando missões…" />
    </template>
    <div v-show="activeTab === 'painel'" class="space-y-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div class="space-y-1"><h1 id="panel-heading" class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Painel de controle</h1><p class="text-sm text-zinc-400">{{ hero?.profile?.name ?? 'Seu herói' }} · {{ hero?.profile?.heroClass ?? '—' }} · <span class="text-orange-400">{{ progress?.rank ? getHunterRankDefinition(progress.rank).label : '—' }}</span> · <span class="text-emerald-400">{{ overview?.dual.murim.current.name ?? progress?.realm }}</span></p></div><div class="flex flex-wrap gap-2"><input v-model="panelSearch" type="search" placeholder="Filtrar treinos, votos ou builds..." aria-label="Filtrar itens do painel" class="rounded-md border border-[#27272A] text-xs"><button type="button" :disabled="busy" class="panel-button" @click="syncPanel">{{ busy ? 'Sincronizando' : 'Sincronizar' }}</button></div></div>
      <div class="flex flex-wrap items-center justify-between gap-2"><div role="tablist" aria-label="Seções do painel" class="grid grid-cols-3 bg-[#111113] border border-[#27272A] p-1 rounded-md" @keydown="navigateTabs"><button v-for="tab in [{ id: 'visao-geral' as const, label: 'Visão geral' }, { id: 'treinos' as const, label: 'Treinos (' + panelWorkouts.length + ')' }, { id: 'arsenal' as const, label: 'Arsenal' }]" :id="`panel-tab-${tab.id}`" :key="tab.id" type="button" role="tab" :aria-controls="`panel-content-${tab.id}`" :tabindex="panelTab === tab.id ? 0 : -1" :aria-selected="panelTab === tab.id" class="min-h-10 px-2 text-xs font-semibold rounded-sm text-zinc-400 aria-selected:bg-[#F97316] aria-selected:text-zinc-950" @click="panelTab = tab.id">{{ tab.label }}</button></div><span class="text-xs text-zinc-400">{{ overview?.bossesDefeated ?? '—' }} chefes derrotados · Recorde de {{ overview?.longestStreak ?? '—' }} dias</span></div>
      <section v-show="panelTab === 'visao-geral'" id="panel-content-visao-geral" role="tabpanel" aria-labelledby="panel-tab-visao-geral" tabindex="0" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-lg font-bold text-white">Classificação dual: Mundo Real e Murim</h2><p class="text-xs text-zinc-400">Evolução paralela entre sua licença de Caçador (XP) e sua maestria de Qi em Murim.</p><OriginalDualProgress v-if="progress" :xp="progress.xp" :level="progress.level" :dual="overview?.dual" />
      <div v-if="progress" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="panel-card"><p>Vitalidade e prontidão</p><strong>{{ progress.hp }} HP</strong><p>{{ overview?.recovery ? 'Prontidão ' + overview.recovery.score + '% · ' + overview.recovery.statusLabel : 'Prontidão sem dados suficientes' }}</p></div>
        <div class="panel-card"><p>Moedas de Ouro</p><strong>{{ progress.coins }}</strong><button type="button" class="text-orange-400" @click="emit('navigate', 'arsenal')">Abrir Arsenal</button></div>
      </div>
      </section>
      <div v-show="panelTab === 'treinos'" id="panel-content-treinos" role="tabpanel" aria-labelledby="panel-tab-treinos" tabindex="0" class="grid grid-cols-1 md:grid-cols-2 gap-3"><article v-for="item in panelWorkouts" :key="item.id" class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-2"><h3 class="text-sm font-bold text-white">{{ item.name }}</h3><p class="text-xs text-zinc-400">{{ item.description }}</p><p class="text-xs text-orange-400">Rank {{ item.rank }} · {{ item.durationMinutes }} min · +{{ item.baseXp }} XP</p><button type="button" class="panel-button" :disabled="busy || training" @click="emit('start', item)">Iniciar sessão</button></article></div>
      <section v-show="panelTab === 'arsenal'" id="panel-content-arsenal" role="tabpanel" aria-labelledby="panel-tab-arsenal" tabindex="0" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-lg font-bold text-white">Equipamento ativo</h2><div class="flex items-center gap-3"><OriginalMascot :equipped-gear="currentGear" size="lg" /><div class="grid grid-cols-2 gap-2 flex-1"><div v-for="slot in slots" :key="slot.id" class="bg-[#111113] border border-[#27272A] rounded-md p-2 text-xs"><span class="text-zinc-400">{{ slot.nome }}</span><p>{{ gear?.find(item => item.id === currentGear[slot.id])?.name ?? '—' }}</p></div></div></div><h3 class="text-sm font-semibold">Presets de loadout</h3><div v-for="preset in loadouts?.filter(item => matchesPanel(item.name))" :key="preset.id" class="flex justify-between gap-2 text-xs"><span>{{ preset.name }}</span><button type="button" class="panel-button" :disabled="busy" @click="manageLoadout('apply', preset.id)">Equipar conjunto</button></div><button type="button" class="panel-button" @click="emit('navigate', 'arsenal')">Abrir Arsenal completo</button></section>
    </div>
    <p v-if="!online" role="status" class="text-xs text-orange-400">Reconecte-se para salvar seu treino.</p>
    <section v-if="mission" v-show="activeTab === 'inicio' || (activeTab === 'painel' && panelTab === 'visao-geral')" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-sm font-semibold text-zinc-100 flex items-center gap-2"><OriginalGlyph name="book" class="text-orange-400" />{{ activeTab === 'painel' ? 'Missões automáticas de hoje' : 'Missões de hoje' }}</h2><p class="text-xs text-zinc-400">Metas de saúde via Auto-check; resgate suas recompensas e registre compromissos pessoais.</p></div><span class="text-xs font-semibold text-zinc-200 font-mono-tabular">{{ mission.daily.filter(q => q.isFulfilled).length + (vows?.filter(v => v.outcome === 'complete').length ?? 0) }}/{{ mission.daily.length + (vows?.length ?? 0) }} concluídas</span></div>
      <div class="flex gap-1.5"><div v-for="q in mission.daily" :key="q.id" class="h-2 flex-1 rounded-sm border border-[#27272A]" :class="q.isFulfilled ? 'bg-emerald-500' : 'bg-[#09090B]'" /><div v-for="v in vows" :key="v.id" class="h-2 flex-1 rounded-sm border border-[#27272A]" :class="v.outcome === 'complete' ? 'bg-emerald-500' : 'bg-[#09090B]'" /></div>
      <div v-for="quest in mission.daily" :key="quest.id" class="p-3.5 rounded-md border flex flex-wrap items-center justify-between gap-3" :class="quest.isFulfilled ? 'bg-emerald-950/15 border-emerald-500/35' : 'bg-[#111113] border-[#27272A]'"><div class="min-w-0 flex-1 space-y-1"><div class="text-xs sm:text-sm font-semibold" :class="quest.isFulfilled ? 'text-emerald-400' : 'text-zinc-100'">{{ quest.title }} <span class="text-[11px] text-orange-400">· Auto-check</span></div><p class="text-[11px] text-zinc-400">{{ quest.subtitle }}</p><div class="w-full max-w-xs h-1.5 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full transition-all duration-500" :class="quest.isFulfilled ? 'bg-emerald-500' : 'bg-orange-500'" :style="{ width: quest.progressPercent + '%' }" /></div></div><div class="text-right font-mono-tabular"><div class="text-xs text-zinc-200 font-semibold">{{ quest.progressText }}</div><div class="text-[11px] text-orange-400">+{{ quest.xpReward }} XP · +{{ quest.coinsReward }} moedas</div><button v-if="quest.isFulfilled && !quest.claimed" type="button" :disabled="busy" class="panel-button" @click="claim(quest.id)">{{ quest.id === 'workout_today' ? 'Resgatar missão' : 'Resgatar ' + quest.title }}</button><span v-else-if="quest.claimed" class="text-xs text-emerald-400">Resgatada</span></div></div>
      <form class="flex gap-2 items-center" @submit.prevent="createVow"><input v-model="vowTitle" required maxlength="120" placeholder="Nova missão pessoal..." aria-label="Novo compromisso" class="flex-1 min-w-0 rounded-md text-xs"><button :disabled="busy" class="rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs">Criar voto</button></form>
      <div v-for="vow in vows?.filter(item => activeTab !== 'painel' || matchesPanel(item.title))" :key="vow.id" class="p-3.5 rounded-md border flex flex-wrap items-center justify-between gap-3" :class="vow.outcome === 'complete' ? 'bg-emerald-950/15 border-emerald-500/35' : vow.outcome === 'violate' ? 'bg-red-950/15 border-red-500/35' : 'bg-[#111113] border-[#27272A]'"><div><strong class="text-xs sm:text-sm">{{ vow.title }}</strong><p class="text-[11px] text-zinc-400">{{ vow.outcome === 'complete' ? 'Cumprido hoje' : vow.outcome === 'violate' ? 'Quebrado hoje' : 'Compromisso pessoal' }}</p></div><div class="flex flex-wrap gap-1.5"><template v-if="!vow.outcome"><button :disabled="busy" class="panel-button text-emerald-400" @click="resolveVow(vow.id, 'complete')">Cumpri o voto</button><button :disabled="busy" class="panel-button text-red-400" @click="pendingVow = vow.id">Quebrei o voto</button></template><button :disabled="busy" class="panel-button" @click="resolveVow(vow.id, 'delete')">Remover voto</button></div></div>
      <UModal :open="!!pendingVow" title="Registrar falha" @update:open="open => { if (!open) pendingVow = null }"><template #body><p class="text-sm text-zinc-300">Registrar a falha aplica a penalidade do compromisso ao seu progresso.</p><div class="flex gap-2 mt-3"><button class="panel-button" @click="pendingVow = null">Cancelar</button><button class="panel-button text-red-400" :disabled="busy" @click="confirmVow">Confirmar falha</button></div></template></UModal>
    </section>
    <div v-show="activeTab === 'inicio'" class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <section class="lg:col-span-8 bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
        <OriginalDualProgress v-if="progress" :xp="progress.xp" :level="progress.level" :dual="overview?.dual" />
        <div v-if="progress && level" class="rounded-md bg-[#111113] border border-[#27272A] p-3 space-y-2"><div class="flex justify-between gap-2 text-xs font-mono-tabular"><span data-testid="hero-xp" class="text-orange-400 font-semibold">{{ progress.xp.toLocaleString('pt-BR') }} XP</span><span class="text-zinc-400">{{ level.isMaxLevel ? 'Nível máximo' : 'Faltam ' + level.xpNeededForNext + ' XP' }}</span></div><div role="progressbar" aria-label="Progresso para o próximo nível" :aria-valuenow="level.progressPercent" aria-valuemin="0" aria-valuemax="100" class="h-2 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full bg-orange-500 transition-all duration-700" :style="{ width: level.progressPercent + '%' }" /></div></div>
      </section>
      <aside class="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
        <div v-for="card in telemetry" :key="card.label" class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between"><div class="flex justify-between items-center text-zinc-400 text-xs mb-1.5"><span>{{ card.label }}</span><OriginalGlyph :name="card.icon" class="text-orange-400" /></div><div class="text-2xl font-bold text-zinc-100 font-mono-tabular">{{ card.value }} <span class="text-xs font-sans font-medium text-zinc-400">{{ card.detail }}</span></div></div>
      </aside>
    </div>
    <section v-if="mission" v-show="activeTab === 'inicio' || (activeTab === 'painel' && panelTab === 'visao-geral')" aria-label="Chefe de Raid Semanal e Missões da Semana" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4"><div class="flex items-center gap-3"><div class="w-12 h-12 grid place-items-center rounded-md bg-[#111113] border border-[#27272A]"><OriginalGlyph name="skull" class="text-red-400" /></div><div><div class="text-[11px] font-mono-tabular uppercase tracking-wider text-orange-400">Raid Semanal · {{ mission.raid.weekKey }}</div><h2 class="text-base sm:text-lg font-bold text-zinc-100">{{ mission.raid.bossName }}</h2><p class="text-xs text-zinc-400">{{ mission.raid.bossSubtitle }}</p></div></div><div class="text-right font-mono-tabular"><strong :class="mission.raid.isDefeated ? 'text-emerald-400' : 'text-red-400'">{{ mission.raid.isDefeated ? 'RAID CONCLUÍDA' : mission.raid.currentHp + ' / ' + mission.raid.maxHp + ' HP' }}</strong><p class="text-[11px] text-zinc-400">{{ mission.raid.workoutsThisWeek }} treinos · {{ mission.raid.weeklyVolumeKg }} kg · {{ mission.raid.weeklyPrCount }} PRs</p></div></div>
      <div class="h-2.5 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full bg-orange-500 transition-all duration-500" :style="{ width: mission.raid.hpPercent + '%' }" /></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5"><div v-for="quest in mission.weekly" :key="quest.id" class="p-3.5 rounded-md border flex flex-col justify-between gap-2.5" :class="quest.isFulfilled ? 'bg-emerald-950/15 border-emerald-500/35' : 'bg-[#111113] border-[#27272A]'"><strong class="text-xs sm:text-sm">{{ quest.title }}</strong><p class="text-[11px] text-zinc-400">{{ quest.subtitle }}</p><div class="h-1.5 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full bg-orange-500 transition-all duration-500" :style="{ width: quest.progressPercent + '%' }" /></div><div class="flex justify-between gap-2 text-[11px] font-mono-tabular"><span>{{ quest.progressText }}</span><span class="text-orange-400">+{{ quest.xpReward }} XP · +{{ quest.coinsReward }} m</span></div><button v-if="quest.isFulfilled && !quest.claimed" class="panel-button" :disabled="busy" @click="claim(quest.id)">Resgatar {{ quest.title }}</button><span v-else-if="quest.claimed" class="text-xs text-emerald-400">Resgatada</span></div></div>
    </section>
    <div v-if="overview" v-show="activeTab === 'inicio' || (activeTab === 'painel' && panelTab === 'visao-geral')"><OriginalWeightTracker :weights="overview.weights" :today="overview.today" :height-cm="hero?.profile?.heightCm" :profile-weight="hero?.profile?.weightKg" :busy="busy" @save="saveWeight" @remove="removeWeight" @profile="emit('navigate', 'perfil')" /></div>
    <div v-show="activeTab === 'inicio'" class="space-y-4">
      <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div class="text-xs font-semibold text-orange-400">Central de saúde e relatórios de desempenho</div><p class="text-xs text-zinc-400"> {{ overview?.recovery ? 'Índice estimado de prontidão: ' + overview.recovery.score + '% · ' + overview.recovery.statusLabel + '. Indicador do jogo, não avaliação clínica.' : 'Importe dados de saúde e registre seus treinos para acompanhar a recuperação.' }}</p></div><button type="button" class="panel-button" @click="emit('navigate', 'progresso')">Abrir saúde e relatórios</button></section>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5"><section class="lg:col-span-5 bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4"><h2 class="text-sm font-semibold text-zinc-100">Últimos 7 dias</h2><div class="grid grid-cols-7 gap-1.5"><div v-for="day in overview?.days ?? []" :key="day.dateKey" class="flex flex-col items-center py-2.5 px-1 rounded-md border text-xs" :class="day.count > 0 ? 'bg-emerald-950/15 border-emerald-500/40' : day.dateKey === overview?.today ? 'bg-[#111113] border-orange-500/50' : 'bg-[#111113] border-[#27272A] text-zinc-500'"><span class="text-[10px] uppercase">{{ weekday.format(new Date(day.dateKey)) }}</span><span class="w-7 h-7 grid place-items-center rounded-sm my-1.5 text-[11px] font-semibold" :class="day.count ? 'bg-emerald-500 text-zinc-950' : 'border border-[#27272A]'">{{ day.count ? '✓' : day.dateKey.slice(-2) }}</span><span class="text-[9px]">{{ day.count > 1 ? day.count + 'x' : day.dateKey === overview?.today ? 'Hoje' : day.dateKey.slice(-2) }}</span></div></div><p class="text-xs text-zinc-400">Treinos no aplicativo e sessões importadas somam consistência diária.</p></section></div>
    </div>
    <OriginalProfileView v-show="activeTab === 'perfil'" :overview="overview" :profile="hero?.profile" :progress="progress" :achievements="achievements ?? []" :draft="profile" :editing="profileEdit" :busy="busy" :feedback="feedback" @edit="openProfile" @cancel="profileEdit = false" @save="saveProfile" @sign-out="emit('signOut')" />
    <div v-show="activeTab === 'arsenal'" class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3 text-left">
        <div class="space-y-1">
          <div class="text-[11px] font-mono-tabular uppercase tracking-wider text-orange-400">Equipamento tático</div>
          <h1 id="arsenal-heading" class="text-2xl font-bold tracking-tight text-white flex items-center gap-2"><OriginalGlyph name="core" class="text-orange-400" />Arsenal · Caçadores e Murim</h1>
          <p class="text-xs text-zinc-400 font-mono-tabular tabular-nums">{{ gear?.length ?? 0 }} peças catalogadas ({{ gear?.filter(item => item.owned).length ?? 0 }}/{{ gear?.length ?? 0 }} desbloqueadas) com bônus de XP, Moedas e dano em chefes.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#18181B] border border-[#27272A]"><OriginalGlyph name="sword" class="text-orange-400" /><span class="text-xs font-bold text-white">Poder {{ currentSummary.totalPowerScore }}</span></div>
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#18181B] border border-[#27272A]"><OriginalGlyph name="coins" class="text-orange-400" /><span class="text-xs font-bold text-orange-400">{{ progress?.coins ?? '—' }} Moedas</span></div>
          <button type="button" class="panel-button" @click="catalogSection = 'conjuntos'">Ver conjuntos</button>
          <button type="button" class="panel-button" @click="catalogSection = 'extrato'">Ver extrato</button>
        </div>
      </div>
      <ArsenalHeroStage
        v-if="activeTab === 'arsenal'"
        :gear="previewGear"
        :name="hero?.profile?.name ?? 'Seu herói'"
        :rank="progress?.rank ? getHunterRankDefinition(progress.rank).label : undefined"
        :realm="progress?.realm"
        :rarity="previewSummary.dominantRarity"
        :aura-color="previewAura"
        :aura-multiplier="previewSummary.auraMultiplier"
        :preview="previewItem"
        :equipped="equippedNotice"
        @filter="filterEquipment"
        @clear="clearPreview"
      />
      <section aria-label="Bônus do equipamento" class="space-y-2">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-md bg-[#111113] border border-[#27272A] text-left">
          <div v-for="stat in [{ label: 'Bônus de XP', value: '+' + previewSummary.xpBonusPercent + '%', color: 'text-emerald-400' }, { label: 'Bônus moedas', value: '+' + previewSummary.coinBonusPercent + '%', color: 'text-orange-400' }, { label: 'Dano em chefes', value: '+' + previewSummary.bossDamageBonusPercent + '%', color: 'text-red-400' }, { label: 'Poder total', value: previewSummary.totalPowerScore + ' pts', color: 'text-white' }]" :key="stat.label" class="space-y-0.5"><div class="text-[11px] font-medium text-zinc-400">{{ stat.label }}</div><div class="text-base sm:text-lg font-bold font-mono-tabular" :class="stat.color">{{ stat.value }}</div></div>
        </div>
        <div v-for="item in previewSummary.activeSets" :key="item.set.id" class="p-3 rounded-md bg-[#111113] border border-[#27272A] flex flex-wrap items-center justify-between gap-2 text-xs"><span :style="{ color: item.set.themeColorHex }">{{ item.set.name }} · {{ item.equippedCount }}/4</span><span>{{ item.fourPieceActive ? item.set.fourPieceBonus?.label : item.twoPieceActive ? item.set.twoPieceBonus.label : 'Bônus ainda inativo' }}</span></div>
      </section>
      <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-4">
        <h2 class="text-sm font-bold text-white">Presets de loadout</h2>
        <form @submit.prevent="manageLoadout('save')"><label>Nome do conjunto <input v-model="loadoutName" maxlength="60" required></label><button :disabled="busy" class="panel-button">Salvar equipamento atual</button></form>
        <ul v-if="loadouts?.length" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <li v-for="loadout in loadouts" :key="loadout.id" class="rounded-md bg-[#111113] border border-[#27272A] p-3 text-xs"><strong>{{ loadout.name }}</strong><button :disabled="busy" @click="manageLoadout('apply', loadout.id)">Equipar conjunto</button><button :disabled="busy" @click="manageLoadout('delete', loadout.id)">Excluir conjunto</button></li>
        </ul>
      </section>
      <div role="tablist" aria-label="Seções do Arsenal" class="flex gap-2 flex-wrap">
        <button v-for="tab in [{ id: 'catalogo' as const, label: 'Catálogo' }, { id: 'conjuntos' as const, label: 'Conjuntos' }, { id: 'extrato' as const, label: 'Extrato' }]" :key="tab.id" type="button" role="tab" :aria-selected="catalogSection === tab.id" class="panel-button" :class="{ 'text-orange-400 border-orange-500': catalogSection === tab.id }" @click="catalogSection = tab.id">{{ tab.label }}</button>
      </div>
      <div v-show="catalogSection === 'catalogo'" id="arsenal-catalogo" tabindex="-1" class="space-y-4">
        <div class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-3">
          <input v-model="searchEquipment" class="w-full text-xs" placeholder="Buscar equipamento..." aria-label="Buscar equipamento">
          <div class="flex flex-wrap gap-2"><button type="button" class="panel-button" :aria-pressed="equipmentSlot === 'all'" @click="equipmentSlot = 'all'">Todos</button><button v-for="slot in slots" :key="slot.id" type="button" class="panel-button" :aria-pressed="equipmentSlot === slot.id" @click="equipmentSlot = slot.id">{{ slot.nome }}</button></div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <label>Raridade <select v-model="rarity"><option v-for="option in ['Todos', 'Comum', 'Raro', 'Épico', 'Lendário']" :key="option">{{ option }}</option></select></label>
            <label>Mostrar <select v-model="display.arsenalFilter"><option value="owned">Meus equipamentos</option><option value="available">Disponíveis para compra</option><option value="all">Catálogo completo</option></select></label>
            <label>Conjunto <select v-model="setFilter"><option>Todos</option><option v-for="set in equipmentSets" :key="set.id" :value="set.id">{{ set.name }}</option></select></label>
          </div>
        </div>
        <p v-if="equipError" role="alert" class="rounded-md border border-red-400/40 bg-[#211315] p-3 text-sm text-red-200">{{ equipError }}</p>
        <MurimDataState v-if="gearError" kind="error" message="Falha ao carregar o arsenal." retry @retry="refreshGear()" />
        <MurimDataState v-else-if="gearPending" kind="loading" message="Carregando arsenal…" />
        <MurimDataState v-else-if="!displayedGear.length" kind="empty" message="Nenhum equipamento nesta seleção." />
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <article v-for="item in displayedGear" :key="item.id" class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-3 text-left" :style="{ borderColor: item.equipped ? item.accentHex : undefined }">
            <div class="flex items-start justify-between gap-2"><div><div class="text-[11px] font-semibold uppercase" :style="{ color: item.accentHex }">{{ item.slot }} · {{ item.rarity }}</div><h3 class="text-sm font-bold text-white">{{ item.name }}</h3></div><span v-if="item.equipped" class="text-emerald-400 text-xs">Equipado</span></div>
            <p class="text-xs text-zinc-400">{{ item.description }}</p><p class="text-xs font-semibold text-orange-400">{{ item.powerBonusLabel }}</p><p v-if="!item.owned && !item.unlock.met" class="text-xs text-zinc-500">{{ item.unlock.progressText }}</p>
            <div class="flex flex-wrap gap-2"><button type="button" class="panel-button" :aria-pressed="previewId === item.id" @click="showPreview(item.id, $event)">Visualizar</button><button v-if="item.owned && !item.equipped" :disabled="busy" class="panel-button" @click="manageItem(item.id, 'equip')">Equipar</button><button v-else-if="!item.owned" :disabled="busy || !item.unlock.met || (progress?.coins ?? 0) < item.priceCoins" class="panel-button" @click="manageItem(item.id, 'buy')">Comprar por {{ item.priceCoins }} moedas</button></div>
          </article>
        </div>
      </div>
      <div v-show="catalogSection === 'conjuntos'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <article v-for="set in equipmentSets" :key="set.id" class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-2"><h3 class="text-sm font-bold" :style="{ color: set.themeColorHex }">{{ set.name }}</h3><p class="text-xs text-zinc-400">{{ set.description }}</p><p class="text-xs">2 peças · {{ set.twoPieceBonus.label }}</p><p v-if="set.fourPieceBonus" class="text-xs">4 peças · {{ set.fourPieceBonus.label }}</p><button type="button" class="panel-button" @click="setFilter = set.id; equipmentSlot = 'all'; rarity = 'Todos'; searchEquipment = ''; display.arsenalFilter = 'all'; catalogSection = 'catalogo'">Ver peças do conjunto</button></article>
      </div>
    </div>
    <ProgressLedger v-show="activeTab === 'inicio' || (activeTab === 'arsenal' && catalogSection === 'extrato')" ref="ledgerView" />
    <p v-if="feedback" role="status">{{ feedback }}</p>
  </section>
</template>

<style scoped>
.hero { background: #18181b; border: 1px solid #27272a; border-radius: 1.25rem; padding: clamp(1rem, 4vw, 2rem); }
.hero-main, .mission { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
.hero h2 { font-size: clamp(1.75rem, 5vw, 3rem); margin: .25rem 0; }
.eyebrow, .stats, summary { color: #fb923c; }
.mission { border-block: 1px solid #27272a; margin-block: 1rem; padding-block: 1rem; }
.missions h3 { margin-top: 1rem; }
.missions li { margin-block: .4rem; }
.mission h3, .mission p { margin: .25rem 0; }
summary { cursor: pointer; margin-block: .65rem; }
form { display: flex; flex-wrap: wrap; align-items: end; gap: .75rem; }
label, .gear li { display: grid; gap: .35rem; }
.gear { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: .75rem; padding: 0; }
.gear li { border: 1px solid #27272a; border-radius: .75rem; padding: .75rem; }
button, select, input { padding: .5rem .75rem; }
.start { border: 0; border-radius: .5rem; background: #f97316; color: #09090b; font-weight: 700; padding: .75rem 1.25rem; }
.logout { margin-top: .75rem; }
.panel-card { display: grid; gap: .65rem; background: #18181b; border: 1px solid #27272a; padding: 1rem; border-radius: .5rem; }
.panel-card p { font-size: .75rem; color: #a1a1aa; }
.panel-card strong { font-size: 1.25rem; color: white; }
.panel-card progress { width: 100%; height: .5rem; accent-color: #f97316; }
.panel-button { background: #111113; border: 1px solid #27272a; border-radius: .375rem; color: #e4e4e7; font-size: .75rem; }
.hero :is(input, select) { background: #111113; border: 1px solid #27272a; border-radius: .375rem; color: #f4f4f5; }
.hero-flat { background: transparent; border: 0; padding: 0; border-radius: 0; }

.panel-button:disabled { opacity: .45; cursor: not-allowed; }
.panel-button[aria-pressed="true"] { border-color: #f97316; color: #fb923c; }
</style>
