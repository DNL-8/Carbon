<script setup lang="ts">
import type { HeroExperience, HunterRankLetter, WorkoutTemplate, WorkoutType } from '../../../src/types/fitness'
import { normalizeHunterRank, VALID_WORKOUT_RANKS, WARRIOR_AWAKENING_PROGRAM, WARRIOR_AWAKENING_WORKOUT_IDS } from '../../../src/utils/rpgLogic'

const props = defineProps<{
  workouts: WorkoutTemplate[]
  disabled: boolean
  records?: { exerciseId: string, bestWeightKg: number, bestReps: number }[]
}>()
const emit = defineEmits<{ start: [workout: WorkoutTemplate] }>()
const search = ref('')
const type = ref<'all' | WorkoutType>('all')
const difficulty = ref<'all' | HeroExperience>('all')
const rank = ref<'all' | HunterRankLetter>('all')
const expanded = ref<string | null>(null)
const typeFilters = [
  { id: 'all', label: 'Todos' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'forca', label: 'Força' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'core', label: 'Abdômen' },
  { id: 'mobilidade', label: 'Mobilidade' },
  { id: 'corpo_inteiro', label: 'Corpo inteiro' },
] as const
const difficultyFilters = ['all', 'Iniciante', 'Intermediário', 'Avançado'] as const
const ranks = ['all', ...VALID_WORKOUT_RANKS] as const
const smallFilter = (active: boolean) => active
  ? 'bg-orange-500/15 text-orange-400 border-orange-500/45'
  : 'bg-[#111113] text-zinc-400 border-[#27272A] hover:text-zinc-200'
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.workouts.filter((workout) => {
    const normalizedRank = normalizeHunterRank(workout.rank, 'F')
    if (type.value !== 'all' && workout.type !== type.value) return false
    if (difficulty.value !== 'all' && workout.difficulty !== difficulty.value) return false
    if (rank.value !== 'all' && normalizedRank !== rank.value) return false
    if (!query) return true
    return [workout.name, workout.description, 'rank ' + normalizedRank].some(value => value.toLowerCase().includes(query))
      || workout.exercises.some(exercise => [exercise.name, ...exercise.muscleGroups, exercise.equipment ?? '', exercise.loadNote ?? ''].some(value => value.toLowerCase().includes(query)))
  })
})
const starterIds: readonly string[] = WARRIOR_AWAKENING_WORKOUT_IDS
const isStarter = (workout: WorkoutTemplate) => normalizeHunterRank(workout.rank, 'F') === 'F' || starterIds.includes(workout.id)
function priority(workout: WorkoutTemplate) {
  const index = starterIds.indexOf(workout.id)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}
const starters = computed(() => filtered.value.filter(isStarter).sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name, 'pt-BR')))
const catalog = computed(() => filtered.value.filter(workout => !isStarter(workout)))
const activeFilters = computed(() => !!search.value.trim() || type.value !== 'all' || difficulty.value !== 'all' || rank.value !== 'all')
function reset() {
  search.value = ''
  type.value = 'all'
  difficulty.value = 'all'
  rank.value = 'all'
}
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}
</script>

<template>
  <div class="original-catalog space-y-5">
    <div class="space-y-1 text-left">
      <div class="text-[11px] font-mono-tabular uppercase tracking-wider text-orange-400">Sessões disponíveis</div>
      <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2"><OriginalGlyph name="sword" class="text-orange-400" />Catálogo de treinos</h1>
      <p class="text-xs text-zinc-400">Cada sessão abre um combate em Modo Foco contra um chefe: conclua os exercícios no tempo alvo para ganhar XP e Moedas.</p>
    </div>
    <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-3">
      <div class="relative">
        <OriginalGlyph name="search" class="text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input v-model="search" type="text" aria-label="Buscar treino" placeholder="Buscar treino, exercício, equipamento ou músculo..." class="w-full pl-10 pr-9 py-2.5 rounded-md bg-[#111113] border border-[#27272A] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500">
        <button v-if="search" type="button" aria-label="Limpar busca" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer" @click="search = ''">×</button>
      </div>
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Categoria">
        <button v-for="filter in typeFilters" :key="filter.id" type="button" :aria-pressed="type === filter.id" class="px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer" :class="type === filter.id ? 'bg-[#F97316] text-zinc-950 border-[#F97316]' : 'bg-[#111113] text-zinc-400 border-[#27272A] hover:text-zinc-200'" @click="type = filter.id">{{ filter.label }}</button>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span class="text-[11px] font-medium text-zinc-500 flex items-center gap-1 mr-1"><OriginalGlyph name="sliders" />Dificuldade:</span>
        <button v-for="option in difficultyFilters" :key="option" type="button" :aria-pressed="difficulty === option" class="px-2.5 py-1 rounded-sm text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer" :class="smallFilter(difficulty === option)" @click="difficulty = option">{{ option === 'all' ? 'Todas' : option }}</button>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span class="text-[11px] font-medium text-zinc-500 mr-1">Rank:</span>
        <button v-for="option in ranks" :key="option" type="button" :aria-pressed="rank === option" :title="option === 'F' ? 'Rank F · Trilha inicial' : undefined" :aria-label="option === 'all' ? 'Mostrar todos os ranks' : option === 'F' ? 'Filtrar por Rank F (Trilha inicial)' : 'Filtrar por Rank ' + option" class="px-2.5 py-1 rounded-sm text-[11px] font-mono-tabular tabular-nums font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer" :class="smallFilter(rank === option)" @click="rank = option">{{ option === 'all' ? 'Todos' : option }}</button>
      </div>
    </section>
    <p role="status" aria-atomic="true" class="text-xs font-medium text-zinc-400">
      {{ activeFilters ? `${filtered.length} de ${workouts.length} treinos` : `${workouts.length} treinos disponíveis` }}
    </p>
    <div v-if="!filtered.length" class="bg-[#18181B] border border-[#27272A] rounded-lg p-8 text-left space-y-3">
      <OriginalGlyph name="forca" class="text-zinc-500" />
      <div class="space-y-1">
        <h3 class="text-sm font-bold text-white">Nenhum treino encontrado</h3>
        <p class="text-xs text-zinc-400">Ajuste os filtros de categoria, dificuldade, rank ou limpe o termo de busca.</p>
      </div>
      <button v-if="activeFilters" type="button" class="min-h-[40px] px-4 py-2 rounded-md bg-[#111113] hover:bg-zinc-800 border border-[#27272A] text-orange-400 text-xs font-semibold transition-colors cursor-pointer" @click="reset">Limpar filtros</button>
    </div>
    <div v-else class="space-y-6">
      <section v-if="starters.length" aria-label="Trilha inicial Rank F — Despertar do Guerreiro" class="space-y-4" :class="{ 'pb-6 border-b border-[#27272A]': catalog.length }">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-left">
          <div class="space-y-1">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1.5"><OriginalGlyph name="compass" />Trilha inicial · Rank F</div>
            <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">Despertar do guerreiro — Treinos A e B</h2>
            <p class="text-xs text-zinc-400">Alternância recomendada para Rank F e iniciantes · 40 min · Equipamentos: {{ WARRIOR_AWAKENING_PROGRAM.equipments.join(' · ') }}</p>
          </div>
          <span class="text-xs font-mono-tabular tabular-nums font-medium text-zinc-400 whitespace-nowrap shrink-0">Cargas leves 5–10 kg editáveis</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OriginalWorkoutCard v-for="workout in starters" :key="workout.id" :workout="workout" :records="records" :starter="true" :expanded="expanded === workout.id" :disabled="disabled" @toggle="toggle(workout.id)" @start="emit('start', $event)" />
        </div>
      </section>
      <section v-if="catalog.length" aria-label="Catálogo geral de portais de treino" class="space-y-3">
        <div v-if="starters.length" class="flex items-center justify-between text-left">
          <h2 class="text-sm font-bold text-zinc-200">Demais portais de combate (Ranks E–S)</h2>
          <span class="text-xs font-mono-tabular tabular-nums text-zinc-400">{{ catalog.length }} treinos</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OriginalWorkoutCard v-for="workout in catalog" :key="workout.id" :workout="workout" :records="records" :starter="false" :expanded="expanded === workout.id" :disabled="disabled" @toggle="toggle(workout.id)" @start="emit('start', $event)" />
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.original-catalog { font-family: 'Plus Jakarta Sans Variable', system-ui, sans-serif; }
.original-catalog :deep(.font-mono-tabular) { font-family: 'JetBrains Mono Variable', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
</style>
