<script setup lang="ts">
import { getHunterRankForLevel, calculateMurimQiByXp, calculateMurimRealmByXp, MURIM_REALM_TIERS } from '../../../src/utils/rpgLogic'
import type { HunterRankProgress, MurimRealmProgress } from '../../../src/types/fitness'
const props = defineProps<{ xp: number, level: number, dual?: { hunter: HunterRankProgress, murim: MurimRealmProgress } | null }>()
const hunter = computed(() => props.dual?.hunter ?? getHunterRankForLevel(props.level, props.xp))
const murim = computed(() => {
  if (props.dual) return props.dual.murim
  const current = calculateMurimRealmByXp(props.xp)
  const qiPoints = calculateMurimQiByXp(props.xp)
  const next = MURIM_REALM_TIERS.find(item => item.order === current.order + 1) ?? null
  return { current, qiPoints, next, qiNeededForNext: next ? Math.max(0, next.minQi - qiPoints) : 0, progressPercent: next ? Math.round((qiPoints - current.minQi) / (next.minQi - current.minQi) * 100) : 100 }
})
</script>
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
    <div class="rounded-md bg-[#111113] border p-3.5 flex flex-col justify-between gap-2.5" :style="{ borderColor: hunter.current.accentHex + '45' }">
      <div class="flex items-center justify-between gap-2 text-[11px] font-semibold" :style="{ color: hunter.current.accentHex }"><span class="uppercase tracking-wider inline-flex items-center gap-1.5"><OriginalGlyph name="compass" />Mundo real · Caçador</span><span class="font-mono-tabular">{{ hunter.current.label }}</span></div>
      <div class="flex items-baseline justify-between gap-2"><span class="text-sm font-semibold text-zinc-100 font-mono-tabular">Nível {{ hunter.level }} <span class="text-xs font-normal text-zinc-400">(Nv. {{ hunter.current.minLevel }}–{{ hunter.current.maxLevel }})</span></span><span class="text-[11px] text-zinc-400">{{ hunter.next ? 'Meta: ' + hunter.next.label : 'Patente máxima' }}</span></div>
      <div class="space-y-1.5"><div role="progressbar" aria-label="Progresso no Rank de Caçador" :aria-valuenow="hunter.progressPercent" aria-valuemin="0" aria-valuemax="100" class="w-full h-1.5 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full transition-all duration-500" :style="{ width: hunter.progressPercent + '%', backgroundColor: hunter.current.accentHex }" /></div><div class="flex justify-between gap-2 text-[11px] text-zinc-400 font-mono-tabular"><span>{{ hunter.progressPercent }}% do rank</span><span class="truncate">{{ hunter.next ? 'Faltam ' + hunter.xpNeededForNextRank.toLocaleString('pt-BR') + ' XP' : 'Patente máxima (Rank S)' }}</span></div></div>
    </div>
    <div class="rounded-md bg-[#111113] border p-3.5 flex flex-col justify-between gap-2.5" :style="{ borderColor: murim.current.accentHex + '45' }">
      <div class="flex items-center justify-between gap-2 text-[11px] font-semibold" :style="{ color: murim.current.accentHex }"><span class="uppercase tracking-wider inline-flex items-center gap-1.5"><OriginalGlyph name="sword" />Murim · Reino marcial</span><span class="font-mono-tabular">{{ murim.qiPoints.toLocaleString('pt-BR') }} Qi</span></div>
      <div class="flex items-baseline justify-between gap-2"><span class="text-sm font-semibold text-zinc-100">{{ murim.current.name }}</span><span class="text-[11px] text-zinc-400 truncate max-w-[52%]">Técnica: {{ murim.current.qiTechnique }}</span></div>
      <div class="space-y-1.5"><div role="progressbar" aria-label="Progresso no Reino de Murim" :aria-valuenow="murim.progressPercent" aria-valuemin="0" aria-valuemax="100" class="w-full h-1.5 rounded-sm bg-[#09090B] border border-[#27272A] overflow-hidden"><div class="h-full transition-all duration-500" :style="{ width: murim.progressPercent + '%', backgroundColor: murim.current.accentHex }" /></div><div class="flex justify-between gap-2 text-[11px] text-zinc-400 font-mono-tabular"><span>{{ murim.progressPercent }}% do reino</span><span class="truncate">{{ murim.next ? 'Faltam ' + murim.qiNeededForNext.toLocaleString('pt-BR') + ' Qi' : 'Ápice de Murim alcançado' }}</span></div></div>
    </div>
  </div>
</template>
