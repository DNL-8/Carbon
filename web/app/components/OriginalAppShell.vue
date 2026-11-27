<script setup lang="ts">
import type { EquippedGear, NavTab } from '../../../src/types/fitness'
import type { ProfileInput } from '../../shared/training'
import { getHunterRankDefinition, getLevelProgress } from '../../../src/utils/rpgLogic'

const props = defineProps<{ active: NavTab, progress?: { xp: number, coins: number, rank: string, level: number, realm: string, hp: number, currentStreak?: number, equippedGear?: EquippedGear } | null }>()
const emit = defineEmits<{ navigate: [tab: NavTab] }>()
const { data: overview } = useNuxtData<{ dual: { murim: { current: { name: string } } } }>('hero:overview')
const { data: hero } = useNuxtData<{ profile: ProfileInput | null }>('hero:profile')
const nav = [
  { id: 'inicio', label: 'Início', icon: 'corpo_inteiro' },
  { id: 'painel', label: 'Painel', icon: 'grid' },
  { id: 'treinar', label: 'Treinar', icon: 'sword' },
  { id: 'arsenal', label: 'Arsenal', icon: 'core' },
  { id: 'progresso', label: 'Relatórios', icon: 'cardio' },
  { id: 'coach', label: 'Oráculo', icon: 'sparkle' },
  { id: 'api', label: 'API', icon: 'terminal' },
  { id: 'perfil', label: 'Perfil', icon: 'user' },
] as const
const moreItems = nav.filter(item => ['painel', 'perfil', 'api'].includes(item.id))
const mobile = nav.filter(item => !moreItems.includes(item))
const moreOpen = ref(false)
const moreTrigger = useTemplateRef<HTMLButtonElement>('more-trigger')
const moreSelected = ref(false)
const moreActive = computed(() => moreItems.some(item => item.id === props.active))
function chooseMore(tab: NavTab) {
  moreSelected.value = tab !== props.active
  moreOpen.value = false
  navigate(tab)
}
function restoreMoreFocus(event: Event) {
  event.preventDefault()
  if (moreSelected.value) document.getElementById('main-content')?.focus()
  else moreTrigger.value?.focus()
  moreSelected.value = false
}
const realm = ref<'hunter' | 'murim'>('hunter')
function toggleRealm() { realm.value = realm.value === 'hunter' ? 'murim' : 'hunter' }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(toggleRealm, 30_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
const level = computed(() => props.progress ? getLevelProgress(props.progress.xp) : null)
const title = computed(() => !props.progress ? '—' : realm.value === 'hunter' ? getHunterRankDefinition(props.progress.rank).label : overview.value?.dual.murim.current.name ?? props.progress.realm)
const navigate = (tab: NavTab) => emit('navigate', tab)
</script>
<template>
  <div class="original-shell min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 bg-[#09090B] text-zinc-100">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[#F97316] focus:text-[#09090B] focus:font-semibold focus:text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Pular para o conteúdo principal</a>
    <aside aria-label="Navegação lateral desktop" class="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 border-r bg-[#111113] border-[#27272A] p-4 justify-between overflow-y-auto">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2 px-1 pt-0.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-md bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0"><OriginalGlyph name="sword" class="text-[#F97316]" /></div>
            <div>
              <div class="font-display font-bold tracking-tight text-sm leading-none text-zinc-100">FITNESS <span class="text-[#F97316]">RPG</span></div>
              <div class="text-[11px] font-medium mt-1 text-zinc-500">Sistema de caçador</div>
            </div>
          </div>
        </div>
        <div class="p-3.5 rounded-lg border grid gap-3 bg-[#18181B] border-[#27272A]">
          <div class="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
            <div class="w-11 h-11 rounded-md border flex items-center justify-center bg-[#111113] border-orange-500/45">
              <OriginalMascot size="sm" :equipped-gear="progress?.equippedGear" />
            </div>
            <div class="min-w-0 grid gap-1">
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span class="font-display font-semibold text-sm leading-tight truncate text-zinc-100">{{ hero?.profile?.name || 'Seu herói' }}</span>
                <span class="text-xs font-semibold font-mono-tabular tabular-nums text-zinc-300 shrink-0">Nv. {{ progress?.level ?? '—' }}</span>
              </div>
              <button type="button" title="Alternar título entre Rank de Caçador e Reino Murim" aria-live="polite" class="group min-w-0 w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 text-left text-xs font-medium transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/60" @click="toggleRealm">
                <div class="min-w-0 overflow-hidden">
                  <Transition name="realm" mode="out-in">
                    <span :key="realm" class="inline-flex items-center gap-1.5 leading-snug" :class="realm === 'hunter' ? 'text-orange-400 group-hover:text-orange-300' : 'text-zinc-200 group-hover:text-white'">
                      <OriginalGlyph :name="realm === 'hunter' ? 'compass' : 'sword'" class="shrink-0" :class="{ 'text-emerald-400': realm === 'murim' }" />
                      <span class="truncate">{{ title }}</span>
                    </span>
                  </Transition>
                </div>
                <span class="text-zinc-500 group-hover:text-zinc-300" aria-hidden="true">⇄</span>
              </button>
            </div>
          </div>
          <div class="pt-2.5 border-t border-[#27272A] grid grid-cols-1 justify-items-center gap-2.5 min-w-0">
            <div v-if="level && progress" class="w-full min-w-0 mx-auto flex flex-col items-stretch font-mono-tabular">
              <div class="w-full flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs mb-1.5">
                <span class="font-semibold text-zinc-100 inline-flex items-center gap-1.5"><OriginalGlyph name="hiit" class="text-[#F97316]" />{{ progress.xp.toLocaleString('pt-BR') }} XP</span>
                <span class="text-[11px] font-medium text-zinc-400">{{ level.isMaxLevel ? 'Nível máximo' : 'Meta Nv. ' + (level.level + 1) }}</span>
              </div>
              <div role="progressbar" aria-label="Progresso de experiência" :aria-valuenow="level.progressPercent" aria-valuemin="0" aria-valuemax="100" class="relative w-full mx-auto bg-[#09090B] border border-[#27272A] rounded-sm overflow-hidden h-2">
                <div class="h-full bg-[#F97316] transition-all duration-700" :style="{ width: level.progressPercent + '%' }" />
                <span v-for="mark in ['left-1/4', 'left-1/2', 'left-3/4']" :key="mark" aria-hidden="true" class="pointer-events-none absolute inset-y-0 w-px bg-white/10" :class="mark" />
              </div>
              <div class="w-full mt-1.5 flex justify-between gap-2 text-[11px] text-zinc-400">
                <span>{{ level.isMaxLevel ? level.levelTitle : 'Faltam ' + level.xpNeededForNext.toLocaleString('pt-BR') + ' XP' }}</span><strong class="text-zinc-200">{{ level.progressPercent }}%</strong>
              </div>
            </div>
            <button type="button" class="w-full pt-2 border-t border-[#27272A] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-zinc-400 hover:text-zinc-100 transition-colors group rounded" @click="navigate('arsenal')">
              <span class="inline-flex items-center gap-1.5 font-semibold text-zinc-200 font-mono-tabular tabular-nums"><OriginalGlyph name="coins" class="text-[#F97316] shrink-0" />{{ progress?.coins.toLocaleString('pt-BR') ?? '—' }} moedas</span>
              <span class="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-400 group-hover:text-orange-400">Arsenal <span aria-hidden="true">›</span></span>
            </button>
          </div>
        </div>
        <nav aria-label="Menu principal" class="space-y-1">
          <button v-for="item in nav" :key="item.id" type="button" :aria-current="active === item.id ? 'page' : undefined" class="ui-press relative isolate flex min-h-10 w-full items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400" :class="active === item.id ? 'font-semibold text-zinc-100' : 'font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100'" @click="navigate(item.id)">
            <span v-if="active === item.id" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 rounded-md border border-orange-500/45 bg-orange-500/8 nav-active" />
            <OriginalGlyph :name="item.icon" :class="active === item.id ? 'text-[#F97316] shrink-0' : 'text-zinc-400 shrink-0'" /><span>{{ item.label }}</span>
          </button>
        </nav>
      </div>
      <div class="space-y-2.5">
        <div class="p-3 rounded-lg border flex items-center justify-between text-xs bg-[#18181B] border-[#27272A]">
          <span class="font-medium flex items-center gap-2 text-zinc-400"><OriginalGlyph name="corpo_inteiro" class="text-[#F97316]" />Sequência atual</span>
          <span class="font-semibold font-mono-tabular tabular-nums text-zinc-100">{{ progress?.currentStreak === undefined ? '—' : progress.currentStreak + (progress.currentStreak === 1 ? ' dia' : ' dias') }}</span>
        </div>
      </div>
    </aside>
    <div class="lg:pl-72">
      <header class="lg:hidden sticky top-0 z-20 border-b px-3.5 h-14 flex items-center justify-between gap-2 bg-[#111113] border-[#27272A]">
        <div class="flex min-w-0 items-center gap-2">
          <div class="w-8 h-8 rounded-md bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0"><OriginalGlyph name="sword" class="text-[#F97316]" /></div>
          <span class="truncate font-display text-sm font-bold tracking-tight text-zinc-100">FITNESS <span class="text-[#F97316]">RPG</span></span>
        </div>
        <div class="flex min-w-0 items-center justify-end gap-1.5 max-[420px]:shrink-0">
          <button type="button" aria-label="Abrir Arsenal e Moedas" class="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-sm bg-[#18181B] border border-[#27272A] text-[11px] font-semibold text-zinc-200 font-mono-tabular tabular-nums whitespace-nowrap" @click="navigate('arsenal')"><OriginalGlyph name="coins" class="text-[#F97316]" />{{ progress?.coins.toLocaleString('pt-BR') ?? '—' }}</button>
          <button type="button" title="Alternar título entre Rank de Caçador e Reino Marcial" aria-label="Alternar título entre Rank de Caçador e Reino Marcial" class="inline-flex min-w-9 items-center gap-1 px-2 py-1 rounded-sm border text-[11px] font-medium whitespace-nowrap max-w-[136px] transition-colors bg-[#18181B]" :class="realm === 'hunter' ? 'border-orange-500/40 text-orange-400' : 'border-[#27272A] text-zinc-200'" @click="toggleRealm">
            <OriginalGlyph :name="realm === 'hunter' ? 'compass' : 'sword'" class="shrink-0" :class="{ 'text-emerald-400': realm === 'murim' }" /><span class="truncate max-[420px]:hidden">{{ title }}</span>
          </button>
        </div>
      </header>
      <main id="main-content" tabindex="-1" class="max-w-6xl mx-auto px-4 sm:px-6 pt-5 lg:pt-7 focus:outline-none"><slot /></main>
    </div>
    <nav aria-label="Navegação principal mobile" class="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t px-2 pt-1.5 pb-[calc(.375rem+env(safe-area-inset-bottom))] h-[calc(4rem+env(safe-area-inset-bottom))] bg-[#111113] border-[#27272A]">
      <div class="grid grid-cols-6 gap-0.5 h-full">
        <button v-for="item in mobile" :key="item.id" type="button" :aria-current="active === item.id ? 'page' : undefined" class="ui-press relative isolate flex flex-col items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-orange-400" :class="active === item.id ? 'font-semibold text-orange-400' : 'font-medium text-zinc-400 hover:text-zinc-200'" @click="navigate(item.id)">
          <span v-if="active === item.id" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 rounded-md border border-orange-500/45 bg-orange-500/10 nav-active" />
          <OriginalGlyph :name="item.icon" /><span class="text-[10px] sm:text-[11px] mt-0.5 tracking-tight whitespace-nowrap">{{ item.label }}</span>
        </button>
        <button ref="more-trigger" type="button" aria-haspopup="dialog" :aria-expanded="moreOpen" class="ui-press relative isolate flex flex-col items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-orange-400" :class="moreActive ? 'font-semibold text-orange-400' : 'text-zinc-400 hover:text-zinc-200'" @click="moreOpen = true">
          <span aria-hidden="true" class="text-base leading-[18px]">···</span>
          <span class="mt-0.5 text-[10px] sm:text-[11px]">Mais</span>
        </button>
      </div>
    </nav>
    <UModal v-model:open="moreOpen" title="Mais opções" :content="{ onCloseAutoFocus: restoreMoreFocus }">
      <template #close="{ ui }"><UButton type="button" color="neutral" variant="ghost" aria-label="Fechar" :class="ui.close()"><span aria-hidden="true">×</span></UButton></template>
      <template #body>
        <nav aria-label="Destinos adicionais" class="space-y-2">
          <button v-for="item in moreItems" :key="item.id" type="button" :aria-current="active === item.id ? 'page' : undefined" class="flex min-h-11 w-full items-center gap-3 rounded-md border border-zinc-800 bg-[#18181B] px-3 text-left text-sm text-zinc-200 aria-[current=page]:border-orange-500/50 aria-[current=page]:text-orange-400" @click="chooseMore(item.id)">
            <OriginalGlyph :name="item.icon" />{{ item.label }}
          </button>
        </nav>
      </template>
    </UModal>
  </div>
</template>
<style scoped>
@media (width < 64rem) {
  #main-content :deep(:is(button, a, input, select, textarea)) {
    scroll-margin-block: 4rem calc(5rem + env(safe-area-inset-bottom));
  }
}
.original-shell { font-family: 'Plus Jakarta Sans Variable', system-ui, sans-serif; }
.original-shell :deep(.font-mono-tabular) { font-family: 'JetBrains Mono Variable', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.realm-enter-active, .realm-leave-active { transition: opacity 140ms, transform 140ms; }
.realm-enter-from { opacity: 0; transform: translateY(4px); }
.realm-leave-to { opacity: 0; transform: translateY(-4px); }
.nav-active { animation: appear 160ms ease-out; }
.ui-press { transition: color 160ms, background-color 160ms, scale 160ms; }
.ui-press:active { scale: .97; }
@keyframes appear { from { opacity: .55; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .realm-enter-active, .realm-leave-active, .ui-press { transition: none; } .nav-active { animation: none; } }
</style>
