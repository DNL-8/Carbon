<script setup lang="ts">
import { computeBmiSummary } from '../../../src/utils/rpgLogic'
const props = defineProps<{ weights: { dateKey: string, kg: number }[], today: string, heightCm?: number | null, profileWeight?: number | null, busy: boolean }>()
const emit = defineEmits<{ save: [kg: number, dateKey: string], remove: [dateKey: string], profile: [] }>()
const date = ref(props.today)
const input = ref<number | string>(props.weights[0]?.kg ?? props.profileWeight ?? '')
const selected = ref<string | null>(null)
const confirm = ref<string | null>(null)
const expanded = ref(false)
watch([date, () => props.weights], () => { input.value = props.weights.find(item => item.dateKey === date.value)?.kg ?? props.weights[0]?.kg ?? props.profileWeight ?? '' })
const current = computed(() => props.weights[0]?.kg ?? props.profileWeight ?? null)
const bmi = computed(() => computeBmiSummary(props.heightCm, current.value))
const delta = computed(() => props.weights.length > 1 ? props.weights[0]!.kg - props.weights[1]!.kg : null)
const points = computed(() => {
  const rows = [...props.weights].reverse()
  if (!rows.length) return []
  const min = Math.min(...rows.map(item => item.kg)), max = Math.max(...rows.map(item => item.kg))
  const first = Date.parse(rows[0]!.dateKey), span = Math.max(1, Date.parse(rows.at(-1)!.dateKey) - first)
  return rows.map(item => ({ ...item, x: rows.length === 1 ? 160 : 18 + (Date.parse(item.dateKey) - first) / span * 284, y: max === min ? 64 : 112 - (item.kg - min) / (max - min) * 94 }))
})
const activePoint = computed(() => points.value.find(item => item.dateKey === selected.value) ?? points.value.at(-1))
const format = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
function save() {
  const kg = Number(input.value)
  if (input.value !== '' && Number.isFinite(kg) && kg >= 20 && kg <= 500 && date.value <= props.today) emit('save', kg, date.value)
}
</script>
<template>
  <section aria-label="Controle de peso e progresso físico" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3"><div class="space-y-1 text-left"><div class="text-xs font-semibold text-[#F97316] flex items-center gap-2"><OriginalGlyph name="core" />Peso corporal e evolução física</div><p class="text-xs text-zinc-400">Registre suas pesagens para acompanhar a curva de progresso e manter o IMC atualizado.</p></div><span v-if="delta !== null" class="px-2.5 py-1 rounded-sm border text-[11px] font-semibold font-mono-tabular bg-[#111113] border-[#27272A]" :class="delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-orange-400' : 'text-zinc-300'">{{ delta > 0 ? '+' : '' }}{{ format(delta) }} kg vs. anterior</span></div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div class="lg:col-span-5 space-y-3.5">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-[#111113] border border-[#27272A] rounded-md p-3.5"><div class="text-[11px] text-zinc-400">Peso atual</div><div class="text-2xl font-bold text-zinc-100 font-mono-tabular mt-1">{{ current === null ? '—' : format(current) }} <span class="text-xs text-zinc-400">kg</span></div><div class="text-[11px] text-zinc-500 mt-1">{{ weights[0]?.dateKey ?? (profileWeight ? 'Da ficha do herói' : 'Sem registro ainda') }}</div></div>
          <div class="bg-[#111113] border border-[#27272A] rounded-md p-3.5"><div class="text-[11px] text-zinc-400">IMC calculado</div><div class="text-2xl font-bold text-orange-400 font-mono-tabular mt-1">{{ bmi?.bmi ?? '—' }}</div><p v-if="bmi" class="text-[11px] text-zinc-400">{{ bmi.label }}</p><button v-else type="button" class="text-[11px] text-orange-400" @click="emit('profile')">Editar ficha</button></div>
        </div>
        <form class="grid grid-cols-2 gap-2 text-xs" @submit.prevent="save">
          <label class="space-y-1 text-zinc-400">Data <input v-model="date" :max="today" required type="date" class="w-full rounded-md border border-[#27272A] bg-[#111113] p-2 text-white"></label>
          <label class="space-y-1 text-zinc-400">Peso (kg) <input v-model.number="input" required type="number" min="20" max="500" step="0.1" class="w-full rounded-md border border-[#27272A] bg-[#111113] p-2 text-white"></label>
          <button type="submit" :disabled="busy" class="col-span-2 min-h-[40px] rounded-md bg-[#F97316] text-zinc-950 font-semibold disabled:opacity-50">Registrar peso</button>
        </form>
      </div>
      <div class="lg:col-span-7 bg-[#111113] border border-[#27272A] rounded-md p-3.5 space-y-2">
        <div class="flex justify-between gap-2 text-xs"><strong class="text-zinc-100">Curva de evolução</strong><span class="font-mono-tabular text-zinc-400">{{ activePoint ? activePoint.dateKey + ' · ' + format(activePoint.kg) + ' kg' : 'Sem registros' }}</span></div>
        <svg v-if="points.length" viewBox="0 0 320 128" class="w-full h-32" role="img" aria-label="Histórico de peso corporal"><line v-for="y in [24, 64, 104]" :key="y" x1="12" x2="308" :y1="y" :y2="y" stroke="#27272A" /><polyline :points="points.map(p => p.x + ',' + p.y).join(' ')" fill="none" stroke="#F97316" stroke-width="2" /><circle v-for="p in points" :key="p.dateKey" :cx="p.x" :cy="p.y" :r="activePoint?.dateKey === p.dateKey ? 4 : 2.5" fill="#fb923c"><title>{{ p.dateKey }} · {{ p.kg }} kg</title></circle></svg>
        <p v-else class="text-xs text-zinc-400 min-h-28 grid place-items-center">Registre sua primeira pesagem.</p>
        <div v-if="weights.length" class="space-y-2"><div v-for="item in (expanded ? weights : weights.slice(0, 3))" :key="item.dateKey" class="flex justify-between gap-2 text-xs text-zinc-300 border-t border-[#27272A] pt-2"><button type="button" @click="selected = item.dateKey; date = item.dateKey">{{ item.dateKey }} · {{ format(item.kg) }} kg</button><button v-if="confirm !== item.dateKey" type="button" class="text-zinc-500 hover:text-red-400" :disabled="busy" @click="confirm = item.dateKey">Excluir</button><span v-else class="flex gap-2"><button type="button" class="text-red-400" :disabled="busy" @click="emit('remove', item.dateKey); confirm = null">Confirmar exclusão</button><button type="button" @click="confirm = null">Cancelar</button></span></div><button v-if="weights.length > 3" type="button" class="text-xs text-orange-400" @click="expanded = !expanded">{{ expanded ? 'Mostrar menos' : 'Ver histórico' }}</button></div>
      </div>
    </div>
  </section>
</template>
