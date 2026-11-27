<script setup lang="ts">
import { BOSS_REACTION_MS, HERO_IMPACT_MS } from '../utils/combat-animation'
import OriginalExerciseDemo from './OriginalExerciseDemo.vue'
import type { EquippedGear, ExerciseItem, WorkoutTemplate } from '../../../src/types/fitness'
import { formatSecondsMMSS, getExerciseInsight, getHunterRankBadgeClass, normalizeHunterRank, parseExercisePrescription } from '../../../src/utils/rpgLogic'
import { loadRestAlertPreferences, saveRestAlertPreferences, triggerRestCompleteAlert, unlockRestAudio } from '../../../src/utils/restAlert'
import type { getWorkoutCombat } from '../../shared/boss'
import type { FocusSet } from '../../shared/focus'
const props = defineProps<{ workout: WorkoutTemplate, sets: FocusSet[], combat: ReturnType<typeof getWorkoutCombat>, elapsed: number, paused: boolean, busy: boolean, feedback: string, equippedGear?: EquippedGear, locked: boolean }>()
const emit = defineEmits<{ 'update:sets': [sets: FocusSet[]], pause: [], finish: [], cancel: [] }>()
const dialogFocus = useDialogReturnFocus()
const exerciseIndex = ref(0)
const exercise = computed(() => props.workout.exercises[exerciseIndex.value])
const currentSets = computed(() => props.sets.map((set, index) => ({ ...set, index })).filter(set => set.exerciseId === exercise.value?.id))
const attack = ref(0)
const hit = ref(0)
const animatingImpact = ref(false)
const celebrating = ref(false)
const showBossDefeated = computed(() => props.combat.state.bossDefeated && !animatingImpact.value)
let attackSequence = 0
let impactTimer: ReturnType<typeof setTimeout> | undefined
let victoryTimer: ReturnType<typeof setTimeout> | undefined

function stopCombatMotion() {
  clearTimeout(impactTimer)
  clearTimeout(victoryTimer)
  attack.value = 0
  hit.value = 0
  animatingImpact.value = false
  celebrating.value = false
}
function playAttack() {
  clearTimeout(impactTimer)
  clearTimeout(victoryTimer)
  animatingImpact.value = true
  attack.value = ++attackSequence
  impactTimer = setTimeout(() => { hit.value = attack.value }, HERO_IMPACT_MS)
  victoryTimer = setTimeout(() => {
    animatingImpact.value = false
    celebrating.value = props.combat.state.bossDefeated
  }, HERO_IMPACT_MS + BOSS_REACTION_MS)
}
onUnmounted(stopCombatMotion)
const showDemo = ref(false)
const info = ref<ExerciseItem | null>(null)
const finishDialog = ref(false)
const exitDialog = ref(false)
const settings = ref(false)
const restEnd = ref(0)
const now = ref(Date.now())
const restNotice = ref(false)
const prefs = reactive({ soundEnabled: false, vibrationEnabled: false })
onMounted(() => Object.assign(prefs, loadRestAlertPreferences()))
watch(prefs, value => saveRestAlertPreferences(value))
watch(exerciseIndex, () => { showDemo.value = false })
const remainingRest = computed(() => Math.max(0, Math.ceil((restEnd.value - now.value) / 1000)))
let interval: ReturnType<typeof setInterval> | undefined
onMounted(() => { interval = setInterval(() => { now.value = Date.now(); if (restEnd.value && now.value >= restEnd.value) { restEnd.value = 0; restNotice.value = true; triggerRestCompleteAlert(prefs) } }, 250) })
onUnmounted(() => { if (interval) clearInterval(interval) })
function startRest(seconds: number) { void unlockRestAudio(); now.value = Date.now(); restEnd.value = now.value + seconds * 1000; restNotice.value = false }
function adjustRest(seconds: number) { restEnd.value = Math.max(Date.now(), restEnd.value + seconds * 1000) }
function update(index: number, field: 'reps' | 'weightKg', event: Event) {
  if (props.locked || props.busy) return
  const value = (event.target as HTMLInputElement).valueAsNumber
  const old = props.sets[index]
  if (!old) return
  if (old.completed) stopCombatMotion()
  const sets = props.sets.map((s, i) => i === index ? { ...s, [field]: Number.isFinite(value) ? value : 0, completed: false } : s)
  emit('update:sets', sets)
}
function toggle(index: number) {
  if (props.busy || props.locked) return
  const set = props.sets[index]
  if (!set || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 500 || set.weightKg < 0 || set.weightKg > 2000) return
  emit('update:sets', props.sets.map((s, i) => i === index ? { ...s, completed: !s.completed } : s))
  if (set.completed) {
    stopCombatMotion()
  } else {
    if (!props.combat.state.bossDefeated) playAttack()
    if (exercise.value) startRest(exercise.value.restSeconds)
  }
}
function addSet() {
  if (!exercise.value || props.busy || props.locked || props.sets.length >= 150 || currentSets.value.length >= 12) return
  emit('update:sets', [...props.sets, { exerciseId: exercise.value.id, reps: parseExercisePrescription(exercise.value.prescription).targetReps, weightKg: currentSets.value.at(-1)?.weightKg ?? exercise.value.loadKg ?? 0, completed: false }])
}
function removeSet(index: number) { if (!props.busy && !props.locked && currentSets.value.length > 1 && !props.sets[index]?.completed) emit('update:sets', props.sets.filter((_, i) => i !== index)) }
const completed = computed(() => props.sets.filter(s => s.completed))
const nextSetIndex = computed(() => currentSets.value.find(set => !set.completed)?.index)
const count = computed(() => new Set(completed.value.map(s => s.exerciseId)).size)
const totalVolume = computed(() => completed.value.reduce((sum, s) => sum + s.reps * s.weightKg, 0))
const remaining = computed(() => Math.max(0, props.workout.durationMinutes * 60 - props.elapsed))
const circumference = 2 * Math.PI * 76
const ringOffset = computed(() => circumference * (1 - remaining.value / Math.max(1, props.workout.durationMinutes * 60)))
const insight = computed(() => info.value ? getExerciseInsight(info.value, props.workout) : null)
function allDone(id: string) { const rows = props.sets.filter(s => s.exerciseId === id); return rows.length > 0 && rows.every(s => s.completed) }
function nextExercise() { if (exerciseIndex.value < props.workout.exercises.length - 1) exerciseIndex.value++ }
const finishButton = useTemplateRef<HTMLButtonElement>('finish-button')
watch(() => props.busy, async (busy) => {
  if (!busy && props.locked) {
    await nextTick()
    finishButton.value?.focus()
  }
})
function finalize() { finishDialog.value = false; emit('finish') }
</script>
<template>
  <div id="treino-em-andamento" tabindex="-1" class="min-h-screen bg-[#09090B] text-zinc-100 pb-24 focus:outline-none">
    <header class="sticky top-0 z-20 bg-[#111113] border-b border-[#27272A] px-3 sm:px-4 py-2.5"><div class="max-w-2xl mx-auto flex items-center justify-between gap-2"><button type="button" aria-label="Retirar-se do treino" :disabled="busy || locked" class="focus-button min-w-11" @click="dialogFocus.remember($event); exitDialog = true">✕</button><div class="min-w-0 flex-1"><div class="text-[11px] font-mono-tabular font-semibold text-orange-400">Modo foco · Rank {{ normalizeHunterRank(workout.rank, 'F') }}</div><h1 class="text-sm font-bold text-white truncate">{{ workout.name }}</h1></div><span class="px-2.5 py-2 rounded-sm border border-[#27272A] text-emerald-400 text-xs font-mono-tabular">{{ count }}/{{ workout.exercises.length }} exercícios</span></div></header>
    <main class="focus-content max-w-2xl mx-auto px-4 pt-4 space-y-5">
      <p v-if="feedback" role="alert" class="rounded-lg border border-red-500/45 p-3 text-xs text-red-300">{{ feedback }}</p>
      <div v-if="restNotice" role="status" class="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-between gap-3 text-xs text-emerald-300">Descanso concluído — hora da próxima série <button type="button" class="focus-button" @click="restNotice = false">Ok</button></div>
      <section v-if="exercise" class="bg-[#18181B] border border-orange-500/55 rounded-lg p-4 sm:p-5 space-y-4 text-left"><div class="flex flex-wrap items-center justify-between gap-2"><span class="text-xs text-orange-400 font-semibold font-mono-tabular">Exercício atual · {{ exerciseIndex + 1 }}/{{ workout.exercises.length }}</span><button type="button" class="focus-button" @click="startRest(exercise.restSeconds)">Descanso ({{ exercise.restSeconds }}s)</button></div><div class="flex items-start justify-between gap-2"><div class="min-w-0 break-words"><h2 class="text-lg sm:text-xl font-bold text-white">{{ exercise.name }}</h2><p class="text-xs text-orange-400 mt-1">{{ exercise.prescription }} <span class="text-zinc-400">· {{ exercise.muscleGroups.join(', ') }}</span></p><p v-if="exercise.equipment" class="text-xs text-zinc-400">{{ exercise.equipment }}</p></div><div class="flex gap-1"><button type="button" class="focus-button" aria-label="Ajustar séries e alertas" @click="dialogFocus.remember($event); settings = true">⚙</button><button type="button" class="focus-button" aria-label="Guia técnico" @click="dialogFocus.remember($event); info = exercise">ⓘ</button></div></div>
        <div v-if="remainingRest" class="p-3.5 rounded-md bg-[#111113] border border-orange-500/45 flex flex-wrap items-center justify-between gap-2.5"><span class="text-xs font-semibold">Descanso: <strong class="text-lg font-mono-tabular">{{ formatSecondsMMSS(remainingRest) }}</strong></span><div class="flex gap-2"><button type="button" class="focus-button" aria-label="Reduzir 15 segundos de descanso" @click="adjustRest(-15)">− 15s</button><button type="button" class="focus-button" aria-label="Adicionar 15 segundos de descanso" @click="adjustRest(15)">+ 15s</button><button type="button" class="focus-button" @click="restEnd = 0">Pular</button></div></div>
        <div class="space-y-2"><div class="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 text-[11px] text-zinc-400"><span>Série</span><span>Carga (kg)</span><span>{{ parseExercisePrescription(exercise.prescription).isTimeBased ? 'Tempo (s)' : 'Repetições' }}</span><span>Feita</span></div><div v-for="(set, n) in currentSets" :key="set.index" class="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 items-center rounded-md" :class="{ 'bg-orange-500/10 ring-1 ring-orange-500/50': set.index === nextSetIndex }"><span class="text-center text-xs font-mono-tabular"><span v-if="set.index === nextSetIndex" class="sr-only">Próxima série: </span>{{ n + 1 }}</span><input :value="set.weightKg" type="number" min="0" max="2000" step=".01" :disabled="busy || locked" :aria-label="'Carga (kg) série ' + (n + 1)" class="focus-input" @input="update(set.index, 'weightKg', $event)"><input :value="set.reps" type="number" min="1" max="500" :disabled="busy || locked" :aria-label="'Repetições série ' + (n + 1)" class="focus-input" @input="update(set.index, 'reps', $event)"><button type="button" :aria-label="'Concluir série ' + (n + 1)" :aria-pressed="set.completed" :disabled="busy || locked" class="focus-button !px-0" :class="set.completed ? '!bg-emerald-500 !text-zinc-950' : ''" @click="toggle(set.index)">{{ set.completed ? '✓' : '○' }}</button></div></div>
        <div class="flex gap-2"><button type="button" :disabled="busy || locked || currentSets.length >= 12 || sets.length >= 150" class="focus-button flex-1" @click="addSet">Adicionar série</button><button type="button" :disabled="exerciseIndex === workout.exercises.length - 1" class="focus-button flex-1" @click="nextExercise">Próximo exercício</button></div>
        <button type="button" class="focus-button w-full flex justify-between" :aria-expanded="showDemo" @click="showDemo = !showDemo"><span>Demonstração do movimento</span><OriginalGlyph name="down"/></button><OriginalExerciseDemo v-if="showDemo" :exercise="exercise" compact/>
        <details class="rounded-md bg-[#111113] border border-[#27272A] p-3 text-xs"><summary class="cursor-pointer font-semibold">Dicas técnicas de execução</summary><p class="pt-2 text-zinc-300">{{ exercise.executionTip }}</p></details>
      </section>
      <section aria-label="Combate e tempo da sessão" class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 sm:p-6 space-y-5">
        <div class="flex flex-col items-center justify-center space-y-3"><div class="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center"><svg viewBox="0 0 180 180" class="w-full h-full -rotate-90"><circle cx="90" cy="90" r="76" fill="none" stroke="#27272A" stroke-width="8"/><circle cx="90" cy="90" r="76" fill="none" :stroke="remaining ? '#F97316' : '#10B981'" stroke-width="8" stroke-linecap="round" :stroke-dasharray="circumference" :stroke-dashoffset="ringOffset" class="transition-[stroke-dashoffset,stroke] duration-700"/></svg><div class="absolute inset-0 flex flex-col items-center justify-center"><span class="text-[10px] font-mono-tabular font-semibold uppercase px-2 py-0.5 rounded-sm border mb-1" :class="getHunterRankBadgeClass(workout.rank)">RANK {{ workout.rank }}</span><strong class="text-3xl font-mono-tabular tabular-nums">{{ formatSecondsMMSS(remaining || elapsed) }}</strong><span class="text-[11px] text-zinc-400">{{ remaining ? 'Decorrido: ' + formatSecondsMMSS(elapsed) : 'Tempo alvo atingido' }}</span></div></div><div class="flex gap-2.5"><button type="button" class="focus-button" :disabled="busy || locked" @click="emit('pause')">{{ paused ? 'Continuar' : 'Pausar' }}</button><button type="button" class="focus-button text-red-400" :disabled="busy || locked" @click="dialogFocus.remember($event); exitDialog = true">Recuar</button></div></div>
        <div class="p-4 sm:p-5 rounded-lg bg-[#111113] border border-[#27272A] space-y-4"><div class="flex justify-between gap-2 text-sm"><strong class="flex items-center gap-2"><OriginalGlyph name="skull" class="text-red-400"/>{{ combat.boss.name }}</strong><span class="font-mono-tabular text-xs" :class="combat.state.bossDefeated ? 'text-emerald-400' : 'text-red-400'">{{ combat.state.bossDefeated ? 'DERROTADO' : combat.state.currentHp + ' / ' + combat.boss.maxHp + ' HP' }}</span></div>
          <p class="sr-only" role="status">{{ combat.state.bossDefeated ? 'Chefe derrotado.' : '' }}</p>
          <progress :value="combat.state.currentHp" :max="combat.boss.maxHp" aria-label="HP do chefe" class="boss-progress w-full h-2"/>
          <div class="flex items-center justify-around py-2"><div class="flex flex-col items-center gap-1"><OriginalMascot :equipped-gear="equippedGear" size="lg" :attack-id="attack" :is-celebrating="celebrating" game-motion /><span class="text-[11px] text-zinc-300">Seu herói</span></div><div class="flex flex-col items-center gap-1 text-zinc-400"><OriginalGlyph name="sword"/><span class="text-[10px] font-mono-tabular">{{ combat.completedSets }}/{{ combat.totalSets }} séries</span></div><div class="flex flex-col items-center gap-1"><OriginalBossSprite :variant="combat.boss.variant" :hit-id="hit" :is-defeated="showBossDefeated"/><span class="text-[11px] text-zinc-400">Chefe Rank {{ combat.boss.bossRank }}</span></div></div>
          <div class="flex flex-wrap justify-between gap-2 text-[11px] text-zinc-400 pt-2 border-t border-[#27272A]"><span>{{ combat.boss.subtitle }}</span><span class="text-orange-400 font-semibold">Recompensa calculada ao salvar</span></div>
        </div>
      </section>
      <section class="space-y-2.5"><h3 class="text-xs font-semibold text-zinc-400">Lista de exercícios ({{ count }}/{{ workout.exercises.length }})</h3><button v-for="(ex, i) in workout.exercises" :key="ex.id" type="button" :aria-current="exerciseIndex === i" class="w-full p-4 rounded-lg border text-left flex items-center gap-3.5 bg-[#18181B]" :class="allDone(ex.id) ? 'border-emerald-500/40' : exerciseIndex === i ? 'border-orange-500/55' : 'border-[#27272A]'" @click="exerciseIndex = i"><span :class="allDone(ex.id) ? 'text-emerald-400' : 'text-zinc-500'">{{ allDone(ex.id) ? '✓' : '○' }}</span><span class="flex-1"><strong class="text-sm">{{ i + 1 }}. {{ ex.name }}</strong><span class="block text-xs text-zinc-400">{{ ex.prescription }} · {{ sets.filter(s => s.exerciseId === ex.id && s.completed).length }}/{{ sets.filter(s => s.exerciseId === ex.id).length }} séries · Descanso {{ ex.restSeconds }}s</span></span></button></section>
    </main>
    <footer class="fixed bottom-0 inset-x-0 z-20 bg-[#111113]/95 border-t border-[#27272A] px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"><div class="max-w-2xl mx-auto"><button ref="finish-button" type="button" :disabled="busy || !completed.length" class="w-full min-h-[44px] rounded-md bg-[#F97316] text-zinc-950 font-semibold text-sm disabled:opacity-40" @click="dialogFocus.remember($event); finishDialog = true">{{ locked ? 'Reenviar treino' : completed.length ? 'Finalizar treino' : 'Conclua 1 exercício para finalizar' }}</button></div></footer>
    <UModal :content="dialogFocus.content" :open="finishDialog" title="Finalizar sessão?" @update:open="finishDialog = $event"><template #close="{ ui }"><UButton type="button" color="neutral" variant="ghost" aria-label="Fechar" :class="ui.close()"><span aria-hidden="true" class="text-lg leading-none">×</span></UButton></template><template #body><div class="space-y-3 text-sm"><p>Revise o resumo antes de salvar o treino.</p><div class="p-3 rounded-md bg-[#111113] border border-[#27272A] space-y-2"><p>Exercícios: {{ count }}/{{ workout.exercises.length }}</p><p>Séries: {{ completed.length }} · Volume: {{ totalVolume.toLocaleString('pt-BR') }} kg</p><p>Tempo: {{ formatSecondsMMSS(elapsed) }}</p><p>{{ combat.state.bossDefeated ? 'Chefe derrotado' : 'Chefe ainda ativo' }}</p></div><p class="text-xs text-zinc-400">XP, moedas e recordes são calculados no servidor ao concluir.</p><button type="button" class="focus-button !bg-orange-500 !text-zinc-950 w-full" :disabled="busy" @click="finalize">Concluir treino</button></div></template></UModal>
    <UModal :content="dialogFocus.content" :open="exitDialog" title="Retirar-se do treino?" @update:open="exitDialog = $event"><template #close="{ ui }"><UButton type="button" color="neutral" variant="ghost" aria-label="Fechar" :class="ui.close()"><span aria-hidden="true" class="text-lg leading-none">×</span></UButton></template><template #body><p class="text-sm">As séries desta sessão não serão salvas.</p><div class="flex gap-2 mt-3"><button class="focus-button" @click="exitDialog = false">Continuar treino</button><button class="focus-button text-red-400" @click="emit('cancel')">Cancelar treino</button></div></template></UModal>
    <UModal :content="dialogFocus.content" :open="settings" title="Séries, carga e alertas" @update:open="settings = $event"><template #close="{ ui }"><UButton type="button" color="neutral" variant="ghost" aria-label="Fechar" :class="ui.close()"><span aria-hidden="true" class="text-lg leading-none">×</span></UButton></template><template #body><div class="space-y-3 text-xs"><label class="flex gap-2"><input v-model="prefs.soundEnabled" type="checkbox" @change="unlockRestAudio">Som de descanso</label><label class="flex gap-2"><input v-model="prefs.vibrationEnabled" type="checkbox">Vibração (quando suportada)</label><div v-for="(s, i) in currentSets" :key="s.index" class="flex justify-between items-center"><span>Série {{ i + 1 }}</span><button type="button" :disabled="s.completed || currentSets.length <= 1 || locked" class="focus-button" @click="removeSet(s.index)">Remover série</button></div></div></template></UModal>
    <UModal :content="dialogFocus.content" :open="!!info" :title="info?.name ?? 'Guia técnico'" @update:open="value => { if (!value) info = null }"><template #close="{ ui }"><UButton type="button" color="neutral" variant="ghost" aria-label="Fechar" :class="ui.close()"><span aria-hidden="true" class="text-lg leading-none">×</span></UButton></template><template #body><div v-if="info && insight" class="space-y-3 text-xs"><OriginalExerciseDemo :exercise="info"/><p class="text-orange-400 font-semibold">{{ insight.primaryFocus }}</p><p>{{ info.executionTip }}</p><ul class="list-disc pl-4"><li v-for="cue in insight.activationCues" :key="cue">{{ cue }}</li></ul></div></template></UModal>
  </div>
</template>
<style scoped>
.focus-content :is(button, input) { scroll-margin-block: 5rem; }
:deep([role="dialog"]) { overscroll-behavior: contain; }
@media (prefers-reduced-motion: reduce) {
  .focus-content circle { transition: none; }
  .boss-progress::-webkit-progress-value { transition: none; }
}
.focus-button { min-height:44px; padding:.5rem .75rem; border:1px solid #27272a; border-radius:.375rem; background:#111113; color:#e4e4e7; font-size:.75rem; font-weight:600; }
.focus-button:disabled { opacity:.45; }
.focus-input { min-width:0; width:100%; min-height:44px; border:1px solid #27272a; border-radius:.375rem; background:#111113; padding:.5rem; color:#f4f4f5; font-size:.875rem; }
.boss-progress { appearance:none; border-radius:.25rem; overflow:hidden; background:#09090b; border:1px solid #27272a; }
.boss-progress::-webkit-progress-bar { background:#09090b; }
.boss-progress::-webkit-progress-value { background:#f97316; transition:width .5s; }
.boss-progress::-moz-progress-bar { background:#f97316; }
</style>
