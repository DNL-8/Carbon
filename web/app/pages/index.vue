<script setup lang="ts">
import { createAuthClient } from 'better-auth/vue'
import { useIntervalFn } from '@vueuse/core'
import OriginalAppShell from '../components/OriginalAppShell.vue'
import type { EquippedGear, NavTab, WorkoutTemplate } from '../../../src/types/fitness'
import { getWorkoutCombat } from '../../shared/boss'
import { navigateTabs } from '../utils/tab-keyboard'
import { finishTrainingSchema, type ProfileInput } from '../../shared/training'
import { type FocusSet, initialFocusSets, completedFocusSets } from '../../shared/focus'

defineOptions({ name: 'FitnessHome' })

const { data: treinos, error, pending: catalogPending, refresh } = await useFetch('/api/catalogo')
const auth = createAuthClient()
if (import.meta.server) useResponseHeader('Cache-Control').value = 'private, no-store'
const { data: account, refresh: refreshSession } = await useFetch('/api/conta')
const session = computed(() => account.value?.authenticated === true)
const { data: hero, refresh: refreshHero, error: heroError } = await useFetch('/api/heroi', {
  key: 'hero:profile', immediate: session.value, watch: false,
})
const initialProfile: ProfileInput = { name: '', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante' }
const hasProfile = computed(() => session.value && !!hero.value?.profile)
const needsProfile = computed(() => session.value && hero.value?.profile === null)
const route = useRoute()
const router = useRouter()
function focusReportSync() { document.getElementById('report-tab-sync')?.focus() }
function navigateFocus() { document.getElementById('main-content')?.focus() }
const tabs: readonly NavTab[] = ['inicio', 'painel', 'treinar', 'arsenal', 'progresso', 'coach', 'api', 'perfil']
const reportSections = {
  overview: 'visao-geral',
  activities: 'atividades',
  evolution: 'evolucao',
  sync: 'sincronizacao',
} as const
type ReportTab = keyof typeof reportSections
const reportTab = computed<ReportTab>(() => {
  const explicit = (Object.keys(reportSections) as ReportTab[]).find(tab => reportSections[tab] === route.query.secao)
  return explicit ?? (route.query.strava ? 'sync' : 'overview')
})
async function selectReport(tab: ReportTab) {
  if (tab === reportTab.value) return
  await router.push({ query: { ...route.query, secao: reportSections[tab] } })
}
async function openReportSync() {
  await selectReport('sync')
  await nextTick()
  focusReportSync()
}
const activeTab = computed<NavTab>(() => hasProfile.value && tabs.includes(route.query.tab as NavTab) ? route.query.tab as NavTab : 'inicio')
async function navigate(tab: NavTab) {
  if (!session.value || tab === activeTab.value) return
  await router.push({ query: { ...route.query, tab: tab === 'inicio' ? undefined : tab } })
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'instant' })
}
const { data: progress, refresh: refreshProgress } = await useFetch<{
  xp: number, coins: number, rank: string, level: number, realm: string, hp: number, bossDamageBonus: number, currentStreak?: number, equippedGear?: EquippedGear
}>('/api/progresso', { immediate: Boolean(session.value), watch: false })
const { data: trainingHistory, pending: historyPending, error: historyError, refresh: refreshHistory, clear: clearHistory } =
  await useFetch('/api/treinos/historico', { immediate: session.value, watch: false })
const { data: customWorkouts, refresh: refreshCustom, clear: clearCustom } =
  await useFetch('/api/treinos/personalizados', { immediate: session.value, watch: false })
const dashboard = ref<{ refresh: () => Promise<unknown> }>()
const catalog = computed(() => [...(customWorkouts.value ?? []), ...(treinos.value ?? [])])
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
})
const email = ref('')
const password = ref('')
const name = ref('')
const feedback = ref('')
const receipt = ref<{ name: string, xp: number, coins: number, bossDefeated: boolean } | null>(null)
const receiptTitle = useTemplateRef<HTMLHeadingElement>('receipt-title')
const guest = ref(false)
const guestWorkouts = ref(0)
const canTrain = computed(() => hasProfile.value || guest.value)
const busy = ref(false)
const workout = ref<WorkoutTemplate>()
const key = ref('')
const sets = ref<FocusSet[]>([])
const paused = ref(false)
const pending = ref<ReturnType<typeof finishTrainingSchema.parse>>()
let accumulatedMs = 0
const elapsedSeconds = ref(0)
let startedAt = 0
let trainingTrigger: HTMLElement | null = null

function tick() {
  elapsedSeconds.value = Math.min(28_800, Math.max(0, Math.floor((accumulatedMs + (paused.value ? 0 : Date.now() - startedAt)) / 1000)))
}

const { pause: pauseTimer, resume: resumeTimer } = useIntervalFn(tick, 1000, { immediate: false })
function togglePause() {
  if (pending.value || busy.value) return
  if (paused.value) { startedAt = Date.now(); paused.value = false; resumeTimer() }
  else { accumulatedMs += Date.now() - startedAt; paused.value = true; pauseTimer(); tick() }
}
const combat = computed(() => workout.value
  ? getWorkoutCombat(workout.value, completedFocusSets(sets.value), elapsedSeconds.value, progress.value?.bossDamageBonus ?? 0)
  : null)

async function start(item: WorkoutTemplate) {
  if (!canTrain.value || busy.value || workout.value) return
  receipt.value = null
  trainingTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  feedback.value = ''
  pending.value = undefined
  paused.value = false
  accumulatedMs = 0
  workout.value = item
  startedAt = Date.now()
  elapsedSeconds.value = 0
  resumeTimer()
  key.value = crypto.randomUUID()
  sets.value = initialFocusSets(item)
  await nextTick()
  document.getElementById('treino-em-andamento')?.focus()
}

function startRecommended() {
  const workout = (treinos.value ?? [])[0]
  if (workout) return start(workout)
}

async function refreshAfterCommand() {
  await Promise.all([refreshRpg(), refreshHistory(), refreshCustom()])
}

async function refreshRpg() {
  await Promise.all([refreshProgress(), dashboard.value?.refresh()])
}

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

async function cancelWorkout() {
  pauseTimer()
  workout.value = undefined
  pending.value = undefined
  paused.value = false
  accumulatedMs = 0
  sets.value = []
  const trigger = trainingTrigger
  trainingTrigger = null
  if (trigger) {
    await nextTick()
    if (trigger.isConnected && !trigger.matches(':disabled')) trigger.focus()
    else document.getElementById('main-content')?.focus()
  }
}

function enterAsGuest() {
  feedback.value = ''
  guest.value = true
}

function leaveGuest() {
  cancelWorkout()
  feedback.value = ''
  guestWorkouts.value = 0
  guest.value = false
}

function submitCredentials(mode: 'login' | 'register' | 'recover', credentials: { email: string, password: string, name: string }) {
  email.value = credentials.email
  password.value = credentials.password
  name.value = credentials.name
  return run(mode === 'login' ? signIn : mode === 'register' ? signUp : requestReset)
}

async function signIn() {
  const result = await auth.signIn.email({ email: email.value, password: password.value })
  if (result.error) throw Error(result.error.message)
  await refreshSession()
  await Promise.all([refreshHero(), refreshProgress(), refreshHistory(), refreshCustom()])
}

async function signUp() {
  const result = await auth.signUp.email({
    name: name.value.trim() || email.value.split('@')[0]!,
    email: email.value,
    password: password.value,
    callbackURL: '/',
  })
  if (result.error) throw Error(result.error.message)
  feedback.value = 'Confira seu e-mail para verificar a conta.'
}

async function requestReset() {
  const result = await auth.requestPasswordReset({ email: email.value, redirectTo: '/redefinir-senha' })
  if (result.error) throw Error(result.error.message)
  feedback.value = 'Se houver uma conta com esse e-mail, enviaremos um link.'
}

async function finish() {
  if (!workout.value || !canTrain.value) return
  tick()
  const payload = finishTrainingSchema.safeParse(pending.value ?? {
    id: key.value,
    workoutId: workout.value.id,
    elapsedSeconds: elapsedSeconds.value,
    sets: completedFocusSets(sets.value),
  })
  if (!payload.success) throw Error('Confira as repetições e a carga das séries.')
  if (guest.value && !session.value) {
    const defeated = combat.value?.state.bossDefeated
    guestWorkouts.value += 1
    cancelWorkout()
    feedback.value = `Treino concluído como visitante.${defeated ? ' Chefe derrotado!' : ''}`
    return
  }
  pending.value = payload.data
  if (!paused.value) { accumulatedMs = elapsedSeconds.value * 1000; paused.value = true; pauseTimer() }
  let result
  try {
    result = await $fetch('/api/treinos/concluir', {
      method: 'POST',
      body: payload.data,
    })
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    if (status === 400 || status === 409) {
      pending.value = undefined
      throw Error('O servidor recusou este treino. Confira os exercícios e as séries antes de concluir novamente.', { cause: error })
    }
    throw Error('Envio pendente. Confira a conexão e selecione Reenviar treino. Mantenha esta página aberta.', { cause: error })
  }
  receipt.value = { name: workout.value.name, xp: result.earnedXp, coins: result.earnedCoins, bossDefeated: result.bossDefeated }
  await cancelWorkout()
  await nextTick()
  receiptTitle.value?.focus()
  const refreshed = await Promise.allSettled([refreshRpg(), refreshHistory()])
  if (refreshed.some(item => item.status === 'rejected')) feedback.value = 'Atualize o painel para sincronizar os dados.'
}

async function createProfile(profile: ProfileInput) {
  hero.value = await $fetch('/api/heroi', { method: 'PUT', body: profile })
  await nextTick()
  document.getElementById('main-content')?.focus()
}

async function retryProfile() {
  await refreshHero()
}

async function signOut() {
  const result = await auth.signOut()
  if (result.error) throw Error(result.error.message)
  cancelWorkout()
  progress.value = undefined
  receipt.value = null
  clearHistory()
  clearCustom()
  clearNuxtData(key => key.startsWith('hero:'))
  sets.value = []
  await refreshSession()
}

async function signInGoogle() {
  const result = await auth.signIn.social({ provider: 'google', callbackURL: '/' })
  if (result.error) throw Error(result.error.message)
}
</script>

<template>
  <OriginalFocusSession v-if="workout && combat" v-model:sets="sets" :workout="workout" :combat="combat" :elapsed="elapsedSeconds" :paused="paused" :busy="busy" :locked="!!pending" :feedback="feedback" :equipped-gear="progress?.equippedGear" @pause="togglePause" @finish="run(finish)" @cancel="cancelWorkout" />
  <OriginalAuthScreen
    v-if="!session && !guest" :busy="busy" :feedback="feedback"
    @submit="submitCredentials" @google="run(signInGoogle)" @guest="enterAsGuest" @clear="feedback = ''" />
  <main v-if="session && !hasProfile && !workout" class="min-h-screen bg-[#09090B] px-4 py-8 text-zinc-100">
    <section class="mx-auto max-w-md space-y-4 rounded-lg border border-[#27272A] bg-[#18181B] p-4 sm:p-5">
      <h1 class="text-lg font-bold">Crie sua ficha de personagem</h1>
      <template v-if="needsProfile">
        <p class="text-sm text-zinc-400">Preencha sua ficha para abrir o painel. As medidas de saúde são opcionais.</p>
        <OriginalHeroProfileForm :initial="initialProfile" :busy="busy" :feedback="feedback" cancel-label="Sair da conta" submit-label="Criar ficha" @cancel="run(signOut)" @save="run(() => createProfile($event))" />
      </template>
      <template v-else-if="heroError">
        <p role="alert" class="text-sm text-zinc-300">Não foi possível carregar sua ficha.</p>
        <UButton :disabled="busy" @click="run(retryProfile)">Tentar novamente</UButton>
        <UButton variant="outline" :disabled="busy" @click="run(signOut)">Sair da conta</UButton>
      </template>
      <p v-else role="status" class="text-sm text-zinc-400">Carregando ficha…</p>
    </section>
  </main>
  <component :is="session ? OriginalAppShell : 'main'" v-if="hasProfile || guest" v-show="!workout" v-bind="session ? { active: activeTab, progress } : { class: 'guest-main' }" @navigate="navigate">
    <header v-if="guest && !session"><h1>Fitness RPG &amp; Saúde</h1></header>
    <section v-if="receipt && session" aria-labelledby="receipt-heading" class="mb-4 space-y-3 rounded-lg border border-emerald-500/40 bg-[#18181B] p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div role="status">
          <h2 id="receipt-heading" ref="receipt-title" tabindex="-1" class="text-base font-bold text-emerald-300">Treino salvo</h2>
          <p class="text-sm text-zinc-200">{{ receipt.name }}</p>
          <p class="mt-1 text-xs text-zinc-400">{{ receipt.bossDefeated ? 'Chefe derrotado' : 'Chefe permaneceu ativo' }}</p>
        </div>
        <button type="button" class="min-h-11 rounded-md border border-zinc-700 px-3 text-xs text-zinc-200" @click="receipt = null; $nextTick(() => navigateFocus())">Fechar resumo</button>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-md border border-zinc-800 bg-[#111113] p-3"><dt class="text-xs text-zinc-400">Experiência</dt><dd class="font-semibold text-orange-400">+{{ receipt.xp.toLocaleString('pt-BR') }} XP</dd></div>
        <div class="rounded-md border border-zinc-800 bg-[#111113] p-3"><dt class="text-xs text-zinc-400">Moedas</dt><dd class="font-semibold text-orange-400">+{{ receipt.coins.toLocaleString('pt-BR') }}</dd></div>
      </dl>
    </section>
    <HeroDashboard
      v-if="session" ref="dashboard" :progress="progress" :active-tab="activeTab" :workouts="catalog" :training="busy || !!workout" @navigate="navigate"
      @start="start" @changed="refreshProgress()" @sign-out="run(signOut)" />
    <section v-else-if="guest" class="guest" aria-labelledby="guest-heading">
      <h2 id="guest-heading">Modo visitante</h2>
      <p>Experimente os treinos do catálogo. O progresso é temporário e se perde ao sair ou recarregar a página.</p>
      <p v-if="guestWorkouts">Treinos concluídos nesta sessão: {{ guestWorkouts }}</p>
      <div class="guest-actions">
        <UButton type="button" :disabled="busy || !!workout || !treinos?.length" @click="startRecommended">Iniciar treino</UButton>
        <UButton type="button" variant="outline" color="neutral" :disabled="busy" @click="leaveGuest">Voltar ao login</UButton>
      </div>
    </section>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <MurimDataState v-if="error && (guest || activeTab === 'inicio' || activeTab === 'treinar')" kind="error" message="Falha ao carregar os treinos." retry @retry="refresh()" />
    <MurimDataState v-else-if="catalogPending && (guest || activeTab === 'inicio' || activeTab === 'treinar')" kind="loading" message="Carregando treinos…" />
    <div v-if="session" v-show="activeTab === 'progresso'" class="space-y-4" data-view="progresso">
      <h1 class="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Relatórios</h1>
      <div role="tablist" aria-label="Seções dos relatórios" class="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-[#111113] p-1 sm:grid-cols-4" @keydown="navigateTabs($event, false)">
        <button v-for="page in [{ id: 'overview' as const, label: 'Visão geral', icon: 'cardio' as const }, { id: 'activities' as const, label: 'Atividades', icon: 'clock' as const }, { id: 'evolution' as const, label: 'Evolução', icon: 'hiit' as const }, { id: 'sync' as const, label: 'Sincronização', icon: 'compass' as const }]" :id="`report-tab-${page.id}`" :key="page.id" type="button" role="tab" :aria-controls="`report-panel-${page.id}`" :tabindex="reportTab === page.id ? 0 : -1" :aria-selected="reportTab === page.id" class="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-zinc-400 aria-selected:bg-orange-400/12 aria-selected:text-orange-300 sm:gap-2 sm:text-sm" @click="selectReport(page.id)"><OriginalGlyph :name="page.icon" />{{ page.label }}</button>
      </div>
      <div v-for="page in ['overview', 'activities', 'evolution', 'sync'].filter(item => item !== reportTab)" :id="`report-panel-${page}`" :key="page" role="tabpanel" :aria-labelledby="`report-tab-${page}`" hidden />
      <div :id="`report-panel-${reportTab}`" role="tabpanel" :aria-labelledby="`report-tab-${reportTab}`" tabindex="0" class="space-y-4">
          <HealthImport :section="reportTab" @imported="refreshRpg()" @sync="openReportSync" />
          <section v-if="reportTab === 'evolution'" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-sm font-bold text-white">Evolução de XP</h2><p class="text-xs text-zinc-400">XP total: {{ progress?.xp ?? '—' }} · Nível {{ progress?.level ?? '—' }}</p><p class="text-xs text-zinc-400">Confira os treinos e recordes registrados no histórico.</p></section>
      </div>
    </div>
    <section v-if="session" v-show="activeTab === 'perfil' || (activeTab === 'progresso' && reportTab === 'evolution')" class="legacy-panel" aria-labelledby="historico">
      <h2 id="historico">Histórico recente e recordes</h2>
      <MurimDataState v-if="historyError" kind="error" message="Falha ao carregar o histórico." retry @retry="refreshHistory()" />
      <MurimDataState v-else-if="historyPending" kind="loading" message="Carregando histórico…" />
      <template v-else-if="trainingHistory">
        <MurimDataState v-if="!trainingHistory.history.length" kind="empty" message="Seus treinos concluídos vão aparecer aqui." />
        <details v-for="entry in trainingHistory.history" :key="entry.id">
          <summary>{{ entry.name }} · {{ dateFormatter.format(new Date(entry.createdAt)) }} · +{{ entry.xp }} XP</summary>
          <p>{{ entry.coins }} moedas</p>
          <ul>
            <li v-for="(set, index) in entry.sets" :key="index">{{ set.name }} · {{ set.reps }} repetições · {{ set.weightKg }} kg</li>
          </ul>
        </details>
        <details v-if="trainingHistory.records.length">
          <summary>Recordes pessoais ({{ trainingHistory.records.length }})</summary>
          <ul>
            <li v-for="record in trainingHistory.records" :key="record.exerciseId">
              {{ record.name }} · {{ record.bestReps }} repetições · {{ record.bestWeightKg }} kg
              <template v-if="record.estimated1RmKg"> · 1RM estimado de {{ record.estimated1RmKg }} kg</template>
            </li>
          </ul>
        </details>
      </template>
    </section>
    <div v-show="!session || activeTab === 'treinar'" class="space-y-4" data-view="treinar">
      <CustomWorkoutEditor v-if="session" :workouts="customWorkouts ?? []" @saved="refreshCustom()" />
      <OriginalWorkoutCatalog v-if="!error && !catalogPending" :workouts="catalog" :records="trainingHistory?.records" :disabled="!canTrain || busy || !!workout" @start="start" />
    </div>
    <OriginalApiCenter v-if="session && activeTab === 'api'" @changed="refreshAfterCommand" />
    <OriginalOracleView v-if="session" v-show="activeTab === 'coach'" :progress="progress" />
  </component>
</template>

<style scoped>
 :global(body) { margin: 0; background: #09090b; color: #f4f4f5; font-family: 'Plus Jakarta Sans Variable', system-ui, sans-serif; }
 .guest-main { max-width: 52rem; margin: auto; padding: 2rem clamp(1rem, 5vw, 4rem); }
header p, small { color: #fb923c; }
.guest-main > header h1 { font-size: clamp(2rem, 6vw, 4rem); margin: .25em 0; }
.legacy-panel { background: #18181b; border: 1px solid #27272a; border-radius: .5rem; padding: 1rem; margin-block: 1rem; }
h2 { margin: .35em 0; }
p, li { line-height: 1.6; }
summary { cursor: pointer; width: fit-content; color: #fb923c; }
details + details { margin-top: .75rem; }
form { display: flex; flex-wrap: wrap; align-items: end; gap: .75rem; padding: 1rem 0; }
form h2, fieldset { width: 100%; }
label { display: inline-grid; gap: .25rem; }
fieldset label { margin-right: .75rem; }
.combat { width: 100%; border: 1px solid #27272a; border-radius: .75rem; padding: .75rem; }
.combat p { margin-block: .25rem; }
.combat progress { width: 100%; accent-color: #f08a82; }
.guest { background: #18181b; border: 1px solid #27272a; border-radius: 1.25rem; padding: clamp(1rem, 4vw, 2rem); }
.guest h2 { font-size: clamp(1.5rem, 4vw, 2rem); }
.guest-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
input, button { padding: .45rem; }
.legacy-panel button { margin-top: .75rem; }
</style>
