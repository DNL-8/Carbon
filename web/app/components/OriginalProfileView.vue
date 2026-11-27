<script setup lang="ts">
import type { EquippedGear, HunterRankProgress, MurimRealmProgress } from '../../../src/types/fitness'
import type { ProfileInput } from '../../shared/training'
import { calculateMurimQiByXp, computeBmiSummary, getHunterRankStartXp, getHunterRankForLevel, HUNTER_RANK_TIERS, MURIM_REALM_TIERS, calculateMurimRealmByXp, DAYS_PER_RANK_BASELINE, WEEKLY_PACE_BASELINE_LABEL } from '../../../src/utils/rpgLogic'

const props = defineProps<{ profile?: ProfileInput | null, draft: ProfileInput, progress?: { xp: number, level: number, rank: string, realm: string, coins: number, hp: number, equippedGear?: EquippedGear } | null, achievements: { id: string, title: string, description: string, bonusXp: number, unlockedAt: string | null }[], editing: boolean, busy: boolean, feedback?: string, overview?: { dual: { hunter: HunterRankProgress, murim: MurimRealmProgress }, attributes: { forca: number, resistencia: number, agilidade: number, disciplina: number } | null } | null }>()
const emit = defineEmits<{ edit: [], cancel: [], save: [profile: ProfileInput], signOut: [] }>()
const dualTab = ref<'hunter' | 'murim'>('hunter')
const hunter = computed(() => props.overview?.dual.hunter ?? (props.progress ? getHunterRankForLevel(props.progress.level, props.progress.xp) : null))
const qi = computed(() => props.overview?.dual.murim.qiPoints ?? (props.progress ? calculateMurimQiByXp(props.progress.xp) : null))
const realm = computed(() => props.overview?.dual.murim.current ?? (props.progress ? calculateMurimRealmByXp(props.progress.xp) : null))
const nextRealm = computed(() => realm.value ? MURIM_REALM_TIERS.find(tier => tier.order === realm.value!.order + 1) : undefined)
const realmPercent = computed(() => qi.value === null || !realm.value ? 0 : nextRealm.value ? Math.min(100, Math.max(0, Math.round((qi.value - realm.value.minQi) / (nextRealm.value.minQi - realm.value.minQi) * 100))) : 100)
const bmi = computed(() => computeBmiSummary(props.profile?.heightCm, props.profile?.weightKg))
const fields = computed(() => [
  { label: 'Classe', value: props.profile?.heroClass ?? '—' },
  { label: 'Objetivo', value: props.profile?.objective ?? '—' },
  { label: 'Experiência', value: props.profile?.experience ?? '—' },
  { label: 'FC repouso', value: props.profile?.restingHrBaseline ? props.profile.restingHrBaseline + ' bpm' : '—' },
  { label: 'FC máxima', value: props.profile?.maxHrEstimated ? props.profile.maxHrEstimated + ' bpm' : '—' },
])
const bio = computed(() => [
  { label: 'Altura', value: props.profile?.heightCm ? props.profile.heightCm + ' cm' : '—' },
  { label: 'Peso', value: props.profile?.weightKg ? props.profile.weightKg + ' kg' : '—' },
  { label: 'IMC', value: bmi.value ? bmi.value.bmi + ' · ' + bmi.value.label : '—' },
])
const attrs = computed(() => {
  const a = props.overview?.attributes
  return a ? [
    { key: 'forca', label: 'Força', value: a.forca, color: '#F97316', hint: 'Força e corpo inteiro' },
    { key: 'resistencia', label: 'Resistência', value: a.resistencia, color: '#10B981', hint: 'Cardio, HIIT e minutos' },
    { key: 'agilidade', label: 'Agilidade', value: a.agilidade, color: '#fbbf24', hint: 'HIIT e mobilidade' },
    { key: 'disciplina', label: 'Disciplina', value: a.disciplina, color: '#d4d4d8', hint: 'Streaks e consistência' },
  ] : []
})
const radarPoints = computed(() => attrs.value.map((item, i) => {
  const angle = (i * 90 - 90) * Math.PI / 180
  return (100 + Math.cos(angle) * item.value * .7) + ',' + (100 + Math.sin(angle) * item.value * .7)
}).join(' '))
const dialogFocus = useDialogReturnFocus()
function cancel() { if (!props.busy) emit('cancel') }
</script>
<template>
  <div class="space-y-5 text-left">
    <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-lg border border-orange-500/45 bg-[#111113] flex items-center justify-center shrink-0"><OriginalMascot :equipped-gear="progress?.equippedGear" size="md" /></div>
          <div><h1 id="profile-heading" class="text-xl font-bold tracking-tight text-white">{{ profile?.name || 'Seu herói' }}</h1><div class="mt-1 inline-flex px-2 py-0.5 rounded-sm border border-[#27272A] text-xs font-mono-tabular text-zinc-200">Nível {{ progress?.level ?? '—' }} · {{ hunter?.current.label ?? '—' }}</div></div>
        </div>
        <button type="button" class="min-h-[40px] px-3.5 py-2 rounded-md bg-[#111113] hover:bg-zinc-800 border border-[#27272A] text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" @click="dialogFocus.remember($event); emit('edit')">Editar</button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        <div v-for="item in fields" :key="item.label" class="p-3 rounded-md bg-[#111113] border border-[#27272A]"><div class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{{ item.label }}</div><div class="text-xs font-bold text-white mt-1">{{ item.value }}</div></div>
      </div>
      <div class="grid grid-cols-3 gap-2"><div v-for="item in bio" :key="item.label" class="p-3 rounded-md bg-[#111113] border border-[#27272A]"><div class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{{ item.label }}</div><div class="text-xs font-bold text-white mt-1 font-mono-tabular tabular-nums">{{ item.value }}</div></div></div>
    </section>
    <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 class="text-sm font-bold text-white flex items-center gap-2"><OriginalGlyph name="compass" class="text-orange-400" />Jornada nos dois mundos</h2><p class="text-xs text-zinc-400 mt-0.5 font-mono-tabular">Evolução paralela entre Caçador (XP) e Reinos de Murim (Qi) · ~{{ DAYS_PER_RANK_BASELINE }} dias por estágio ({{ WEEKLY_PACE_BASELINE_LABEL }}).</p></div>
        <div class="inline-grid grid-cols-2 p-1 rounded-md bg-[#111113] border border-[#27272A] gap-1 shrink-0"><button type="button" class="px-3 py-1.5 rounded-sm text-xs font-semibold" :class="dualTab === 'hunter' ? 'bg-[#F97316] text-zinc-950' : 'text-zinc-400'" @click="dualTab = 'hunter'">Mundo Real (F–S)</button><button type="button" class="px-3 py-1.5 rounded-sm text-xs font-semibold" :class="dualTab === 'murim' ? 'bg-[#F97316] text-zinc-950' : 'text-zinc-400'" @click="dualTab = 'murim'">Murim (8 Reinos)</button></div>
      </div>
      <div v-if="hunter && realm && progress" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-3.5 rounded-md bg-[#111113] border border-[#27272A] space-y-2"><div class="flex justify-between text-xs"><span class="text-orange-400 uppercase font-semibold">Mundo Real · Caçador</span><strong>{{ hunter.current.label }}</strong></div><div class="flex justify-between text-xs font-mono-tabular"><span>Nível {{ hunter.level }} · Nv. {{ hunter.current.minLevel }}–{{ hunter.current.maxLevel }}</span><span>{{ progress.xp }} XP</span></div><div class="w-full h-1.5 rounded-sm bg-[#09090B] overflow-hidden border border-[#27272A]"><div class="h-full bg-[#F97316] transition-all duration-500" :style="{ width: hunter.progressPercent + '%' }" /></div><div class="flex justify-between text-[11px] text-zinc-400"><span>{{ hunter.progressPercent }}% do rank atual</span><span>{{ hunter.next ? 'Próx: ' + hunter.next.label + ' (' + hunter.xpNeededForNextRank + ' XP)' : 'Rank S alcançado' }}</span></div></div>
        <div class="p-3.5 rounded-md bg-[#111113] border border-[#27272A] space-y-2"><div class="flex justify-between text-xs"><span class="text-emerald-400 uppercase font-semibold">Mundo de Murim</span><strong>{{ realm.name }}</strong></div><div class="flex justify-between text-xs font-mono-tabular"><span>{{ realm.qiTechnique }}</span><span>{{ qi }} Qi</span></div><div class="w-full h-1.5 rounded-sm bg-[#09090B] overflow-hidden border border-[#27272A]"><div class="h-full bg-emerald-400 transition-all duration-500" :style="{ width: realmPercent + '%' }" /></div><div class="flex justify-between text-[11px] text-zinc-400"><span>{{ realmPercent }}% do reino atual</span><span>{{ nextRealm ? 'Próx: ' + nextRealm.name : 'Reino Supremo alcançado' }}</span></div></div>
      </div>
      <div v-if="dualTab === 'hunter'" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div v-for="(tier, idx) in HUNTER_RANK_TIERS" :key="tier.rank" class="p-3 rounded-md border transition-colors" :class="hunter?.current.rank === tier.rank ? 'bg-[#111113] border-[#F97316]' : 'bg-[#09090B] border-[#27272A]'"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0"><span class="px-2 py-0.5 rounded-sm bg-[#09090B] border border-[#27272A] text-xs font-bold text-white shrink-0">{{ tier.label }}</span><span class="text-[11px] text-zinc-400 truncate">Nv. {{ tier.minLevel }}–{{ tier.maxLevel }} · {{ getHunterRankStartXp(tier.rank) }} XP</span></div><span class="text-[11px] font-semibold text-orange-400 shrink-0">{{ hunter?.current.rank === tier.rank ? 'Atual' : progress && progress.level >= tier.minLevel ? 'Conquistado' : 'Dia ~' + (idx === 0 ? 1 : idx * DAYS_PER_RANK_BASELINE) }}</span></div><p class="text-[11px] text-zinc-400 mt-1.5">{{ tier.description }}</p></div>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2.5"><div v-for="tier in MURIM_REALM_TIERS" :key="tier.id" class="p-3 rounded-md border" :class="realm?.id === tier.id ? 'bg-[#111113] border-[#F97316]' : 'bg-[#09090B] border-[#27272A]'"><div class="flex justify-between gap-2"><div><div class="text-xs font-bold text-white">{{ tier.order }}. {{ tier.name }}</div><div class="text-[11px] text-zinc-400">{{ tier.qiTechnique }}</div></div><span class="text-[11px] font-semibold text-orange-400">{{ realm?.id === tier.id ? 'Atual' : tier.minQi + ' Qi' }}</span></div><p class="text-[11px] text-zinc-400 mt-1.5">{{ tier.description }}</p></div></div>
    </section>
    <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
      <div class="flex justify-between"><h2 class="text-sm font-bold text-white">Matriz de atributos</h2><span class="text-xs text-zinc-500 font-mono-tabular">Escala 10–100</span></div>
      <p v-if="!attrs.length" class="text-xs text-zinc-400">Preencha a ficha do herói para calcular os atributos.</p>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <svg viewBox="0 0 200 200" role="img" aria-label="Radar dos atributos do herói" class="w-full max-w-[280px] mx-auto">
          <polygon v-for="r in [17.5,35,52.5,70]" :key="r" :points="(100) + ',' + (100-r) + ' ' + (100+r) + ',100 100,' + (100+r) + ' ' + (100-r) + ',100'" fill="none" stroke="#3f3f46" />
          <path d="M100 30V170 M30 100H170" stroke="#3f3f46" fill="none"/>
          <polygon :points="radarPoints" fill="#F97316" fill-opacity=".2" stroke="#F97316" stroke-width="2" />
          <g fill="#a1a1aa" font-size="9" text-anchor="middle"><text x="100" y="19">Força</text><text x="100" y="187">Agilidade</text><text x="174" y="91">Resist.</text><text x="25" y="91">Disc.</text></g>
        </svg>
        <div class="space-y-3"><div v-for="attr in attrs" :key="attr.key" class="space-y-1"><div class="flex justify-between text-xs"><span class="font-semibold text-zinc-200">{{ attr.label }}</span><span class="font-bold font-mono-tabular">{{ attr.value }}</span></div><div class="h-2 rounded-sm overflow-hidden bg-[#111113] border border-[#27272A]"><div class="h-full transition-all duration-500" :style="{ width: attr.value + '%', backgroundColor: attr.color }" /></div><p class="text-[11px] text-zinc-500">{{ attr.hint }}</p></div></div>
      </div>
    </section>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-sm font-bold text-white">Estatísticas gerais</h2><div class="grid grid-cols-2 gap-2 text-xs"><div v-for="stat in [{ label: 'XP total', value: progress?.xp }, { label: 'Moedas', value: progress?.coins }, { label: 'Vitalidade', value: progress?.hp }, { label: 'Nível', value: progress?.level }]" :key="stat.label" class="p-3 rounded-md bg-[#111113] border border-[#27272A] flex justify-between"><span class="text-zinc-400">{{ stat.label }}</span><strong class="text-emerald-400">{{ stat.value ?? '—' }}</strong></div></div></section>
      <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-sm font-bold text-white">Vitrine de conquistas</h2><div class="grid gap-2"><div v-for="item in achievements" :key="item.id" class="p-3 rounded-md bg-[#111113] border border-[#27272A] text-xs"><strong :class="item.unlockedAt ? 'text-emerald-400' : 'text-zinc-400'">{{ item.title }}</strong><p class="text-zinc-400">{{ item.description }}</p><span class="text-[11px]">{{ item.unlockedAt ? 'Desbloqueada' : 'Pendente' }} · {{ item.bonusXp }} XP</span></div></div></section>
    </div>
    <button type="button" class="min-h-[44px] py-2.5 px-4 rounded-md bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] text-zinc-200 font-semibold text-xs" @click="emit('signOut')">Sair da conta</button>
    <UModal :content="dialogFocus.content" :open="editing" title="Editar ficha e zonas FC" @update:open="value => { if (!value) cancel() }">
      <template #body>
        <OriginalHeroProfileForm v-if="editing" :initial="draft" :busy="busy" :feedback="feedback" cancel-label="Cancelar" @cancel="cancel" @save="emit('save', $event)" />
      </template>
    </UModal>
  </div>
</template>
