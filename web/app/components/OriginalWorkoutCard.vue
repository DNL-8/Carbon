<script setup lang="ts">
import type { WorkoutTemplate } from '../../../src/types/fitness'
import { calculateCoinsForWorkout, getBossForWorkout, getHunterRankBadgeClass, getHunterRankDefinition, normalizeHunterRank, WORKOUT_TYPE_LABELS } from '../../../src/utils/rpgLogic'

const props = defineProps<{
  workout: WorkoutTemplate
  starter: boolean
  expanded: boolean
  disabled: boolean
  records?: { exerciseId: string, bestWeightKg: number, bestReps: number }[]
}>()
const emit = defineEmits<{ toggle: [], start: [workout: WorkoutTemplate] }>()
const rank = computed(() => normalizeHunterRank(props.workout.rank, 'F'))
const rankDef = computed(() => getHunterRankDefinition(rank.value))
const boss = computed(() => getBossForWorkout(props.workout))
const coins = computed(() => calculateCoinsForWorkout(props.workout.baseXp, props.workout.exercises.length, props.workout.exercises.length, true))
const records = computed(() => new Map(props.records?.map(record => [record.exerciseId, record] as const) ?? []))
</script>

<template>
  <article :data-rank="rank" :data-starter-track="starter ? 'true' : undefined" class="bg-[#18181B] rounded-lg p-5 flex flex-col justify-between space-y-4 transition-colors border" :class="starter ? 'border-orange-500/45 hover:border-orange-400' : 'border-[#27272A] hover:border-zinc-600'">
    <div class="space-y-3 text-left">
      <div class="flex items-start justify-between gap-2">
        <div class="text-xs font-medium text-zinc-400 flex flex-wrap items-center gap-1.5">
          <span :title="rank === 'F' ? rankDef.label + ' · Trilha inicial' : rankDef.label" class="px-2 py-0.5 rounded-sm border font-mono-tabular font-semibold whitespace-nowrap shrink-0" :class="getHunterRankBadgeClass(rank)">RANK {{ rank }}</span>
          <template v-if="starter">
            <span class="text-orange-400 font-semibold whitespace-nowrap">Trilha inicial</span>
            <span aria-hidden="true" class="text-zinc-600">·</span>
          </template>
          <span class="inline-flex items-center gap-1 text-zinc-300">
            <OriginalGlyph :name="workout.type" class="text-zinc-400" />{{ WORKOUT_TYPE_LABELS[workout.type].label }}
          </span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="px-2 py-1 rounded-sm bg-[#111113] border border-[#27272A] text-emerald-400 font-semibold text-xs flex items-center gap-1 font-mono-tabular tabular-nums"><OriginalGlyph name="hiit" />+{{ workout.baseXp }} XP</span>
          <span class="px-2 py-1 rounded-sm bg-[#111113] border border-[#27272A] text-orange-400 font-semibold text-xs flex items-center gap-1 font-mono-tabular tabular-nums"><OriginalGlyph name="coins" />+{{ coins }}</span>
        </div>
      </div>
      <div>
        <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">{{ workout.name }}</h2>
        <p class="text-xs text-zinc-400 mt-1 leading-relaxed">{{ workout.description }}</p>
      </div>
      <div class="px-3 py-2 rounded-md bg-[#111113] border border-[#27272A] flex items-center justify-between gap-2 text-[11px]">
        <span class="text-red-400 font-medium flex items-center gap-1.5 truncate"><OriginalGlyph name="skull" class="shrink-0" />Chefe (Rank {{ boss.bossRank }}): {{ boss.name }}</span>
        <span class="font-mono-tabular tabular-nums font-semibold text-red-400 shrink-0">{{ boss.maxHp }} HP</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-medium">
        <span>{{ workout.difficulty }}</span><span aria-hidden="true">·</span>
        <span class="font-mono-tabular tabular-nums flex items-center gap-1"><OriginalGlyph name="clock" class="text-zinc-400" />{{ workout.durationMinutes }} min</span>
        <span aria-hidden="true">·</span><span class="font-mono-tabular tabular-nums">{{ workout.exercises.length }} exercícios</span>
      </div>
      <div class="rounded-md bg-[#111113] border border-[#27272A] overflow-hidden">
        <button type="button" :aria-expanded="expanded" class="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:bg-zinc-800/40 transition-colors cursor-pointer" @click="emit('toggle')">
          <span class="flex items-center gap-1.5"><OriginalGlyph name="book" class="text-orange-400" />Ver exercícios ({{ workout.exercises.length }})</span>
          <OriginalGlyph name="down" class="text-zinc-400" :class="{ 'rotate-180': expanded }" />
        </button>
        <div v-if="expanded" class="px-3.5 pb-3 pt-2 border-t border-[#27272A] space-y-2">
          <div v-for="(exercise, index) in workout.exercises" :key="exercise.id" class="p-2.5 rounded-md bg-[#18181B] border border-[#27272A] text-xs space-y-1.5">
            <div class="flex items-start justify-between gap-2">
              <div class="font-semibold text-white pt-1">
                {{ index + 1 }}. {{ exercise.name }}
                <span v-if="exercise.unilateral" class="ml-1.5 text-[10px] font-semibold uppercase text-zinc-400">· Unilateral</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span v-if="records.has(exercise.id)" class="text-[11px] font-semibold text-emerald-400 font-mono-tabular tabular-nums mr-1">PR {{ records.get(exercise.id)!.bestWeightKg > 0 ? records.get(exercise.id)!.bestWeightKg + 'kg' : records.get(exercise.id)!.bestReps + 'r' }}</span>
                <span v-if="exercise.loadKg !== undefined" class="text-[11px] font-semibold text-orange-400 font-mono-tabular tabular-nums">{{ exercise.loadKg > 0 ? exercise.loadKg + ' kg' : 'Peso corporal' }}</span>
              </div>
            </div>
            <div class="text-[11px] text-zinc-300 font-medium font-mono-tabular tabular-nums">{{ exercise.prescription }} · Descanso {{ exercise.restSeconds }}s</div>
            <div v-if="exercise.equipment" class="text-[11px] text-zinc-400 flex items-center gap-1.5"><OriginalGlyph name="forca" class="text-zinc-500 shrink-0" /><span>{{ exercise.equipment }}</span></div>
            <div v-if="exercise.loadNote" class="text-[10px] text-zinc-500 leading-relaxed">{{ exercise.loadNote }}</div>
            <div class="text-[10px] text-zinc-500">Músculos: {{ exercise.muscleGroups.join(', ') }}</div>
          </div>
        </div>
      </div>
    </div>
    <button type="button" :disabled="disabled" class="w-full min-h-[44px] py-2.5 px-4 rounded-md bg-[#F97316] hover:bg-orange-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" @click="emit('start', workout)">
      <OriginalGlyph name="play" />Iniciar treino · Enfrentar chefe
    </button>
  </article>
</template>
