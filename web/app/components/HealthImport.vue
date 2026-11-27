<script setup lang="ts">
import type { ParsedHealthImport } from '../../../src/types/fitness'
import {
  parseAppleHealthXmlFile, parseCsvHealthContent, parseGpxContent, parseSamsungHealthFiles,
} from '../../../src/utils/healthParsers'
import type { z } from 'zod'
import type { manualHealthSource, healthSource } from '../../shared/health'

const emit = defineEmits<{ imported: [], sync: [] }>()
const props = withDefaults(defineProps<{ section?: 'overview' | 'activities' | 'sync' | 'evolution' }>(), { section: 'overview' })
const reportSource = ref<'all' | z.infer<typeof healthSource>>('all')
const trendMetric = ref<'durationMinutes' | 'distanceKm' | 'calories'>('durationMinutes')
const source = ref<z.infer<typeof manualHealthSource>>('csv')
const input = ref<HTMLInputElement>()
const busy = ref(false)
const message = ref('')
const warnings = ref<string[]>([])
const period = ref('28')
const { data: summary, error: summaryError, pending: summaryPending, refresh: refreshSummary } = await useFetch('/api/saude/resumo', {
  key: 'hero:health', query: { period, source: reportSource },
})
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const { data: overview } = useNuxtData<{ acwr: number | null, recovery: { score: number, statusLabel: string, acwrRatio: number, avgSleepHours: number | null, latestRestingHr: number | null } | null }>('hero:overview')
const totals = computed(() => summary.value?.totals)
const zoneValues = computed(() => { const t = totals.value; return t ? [t.z1, t.z2, t.z3, t.z4, t.z5] : [0, 0, 0, 0, 0] })
const zoneTotal = computed(() => zoneValues.value.reduce((a, b) => a + b, 0))
const reportCards = computed(() => [
  { label: 'Tempo de treino', value: totals.value?.durationMinutes, unit: 'min', icon: 'clock' as const, detail: totals.value ? totals.value.count + ' sessões importadas' : '' },
  { label: 'Distância', value: totals.value?.distanceKm, unit: 'km', icon: 'compass' as const, detail: '' },
  { label: 'Calorias estimadas', value: totals.value?.calories, unit: 'kcal', icon: 'corpo_inteiro' as const, detail: '' },
  { label: 'Frequência cardíaca média', value: totals.value?.avgHeartRate, unit: 'bpm', icon: 'cardio' as const, detail: totals.value?.avgHeartRate == null ? 'Sem medidas nos treinos' : 'Nos treinos com medição' },
])
const trendLabel = computed(() => trendMetric.value === 'durationMinutes' ? 'Minutos de atividade por dia' : trendMetric.value === 'distanceKm' ? 'Distância por dia (km)' : 'Calorias estimadas por dia')
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' })

async function parseFiles(files: File[]): Promise<ParsedHealthImport> {
  const file = files[0]!
  switch (source.value) {
    case 'samsung_health': return parseSamsungHealthFiles(files)
    case 'apple_health': return parseAppleHealthXmlFile(file)
    case 'gpx': return parseGpxContent(await file.text(), file.name)
    case 'csv': return parseCsvHealthContent(await file.text(), file.name)
  }
}

async function importFiles() {
  const files = Array.from(input.value?.files ?? [])
  if (!files.length || busy.value) return
  busy.value = true
  message.value = ''
  warnings.value = []
  let imported = 0
  let duplicates = 0
  let days = 0
  let xp = 0
  try {
    const parsed = await parseFiles(files)
    warnings.value = parsed.warnings
    const total = Math.max(parsed.activities.length, parsed.dailyMetrics.length)
    if (!total) {
      message.value = 'Nenhum registro de saúde encontrado.'
      return
    }
    for (let offset = 0; offset < total; offset += 25) {
      const result = await $fetch('/api/saude/importar', {
        method: 'POST',
        body: {
          source: source.value,
          activities: parsed.activities.slice(offset, offset + 25),
          dailyMetrics: parsed.dailyMetrics.slice(offset, offset + 25),
        },
      })
      imported += result.imported
      duplicates += result.duplicates
      days += result.days
      xp += result.xp
    }
    message.value = `${imported} atividades novas, ${duplicates} duplicadas e ${days} dias de métricas processados. +${xp} XP.`
    if (input.value) input.value.value = ''
  } catch {
    message.value = `A importação parou após salvar ${imported} atividades e processar ${days} dias. Confira o formato e tente novamente.`
  } finally {
    if (imported || days) {
      emit('imported')
      await refreshSummary()
    }
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-show="props.section === 'overview' || props.section === 'activities'" class="flex flex-wrap items-end gap-x-4 gap-y-3 max-[480px]:flex-col max-[480px]:items-stretch rounded-xl border border-zinc-800 bg-[#111113] p-3 sm:p-4">
      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-medium text-zinc-400">Período</span>
        <div role="group" aria-label="Período" class="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-zinc-900 p-1">
          <button v-for="days in ['7', '28', '90']" :key="days" type="button" :aria-pressed="period === days" class="min-h-9 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 aria-pressed:bg-orange-400 aria-pressed:text-zinc-950" @click="period = days">{{ days }} dias</button>
        </div>
      </div>
      <label class="flex min-w-36 flex-1 flex-col gap-1.5 text-xs font-medium text-zinc-400 sm:flex-none">Origem
        <select v-model="reportSource" class="min-h-11 max-w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 sm:w-48">
          <option value="all">Todas as fontes</option><option value="strava">Strava</option><option value="health_connect">Health Connect</option><option value="apple_health">Apple Health</option><option value="samsung_health">Samsung Health</option><option value="gpx">GPX</option><option value="csv">CSV</option>
        </select>
      </label>
      <p v-if="summary" class="w-full text-xs text-zinc-400 sm:ml-auto sm:w-auto sm:pb-3">{{ dateFormatter.format(new Date(summary.since)) }} a {{ dateFormatter.format(new Date(summary.today)) }}</p>
    </div>
    <MurimDataState v-if="props.section === 'overview' || props.section === 'activities'" v-show="summaryPending" kind="loading" message="Carregando dados do período…" />
    <MurimDataState v-if="summary && !summaryPending && !summaryError && !totals?.count && (props.section === 'overview' || props.section === 'activities')" kind="empty" message="Nenhuma atividade nesta combinação de período e origem.">
      <button type="button" class="min-h-11 rounded-md border border-zinc-700 px-3 text-xs font-semibold text-orange-400" @click="emit('sync')">Abrir sincronização</button>
    </MurimDataState>
    <div v-if="summary && !summaryError" v-show="props.section === 'overview'" class="space-y-4 sm:space-y-5">
      <dl aria-label="Resumo do período" class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <div v-for="card in reportCards" :key="card.label" class="min-w-0 rounded-xl border border-zinc-800 bg-[#151518] p-3.5 sm:p-4"><dt class="flex items-start gap-2 text-xs font-medium text-zinc-400"><OriginalGlyph :name="card.icon" class="shrink-0 text-orange-300" />{{ card.label }}</dt><dd class="mt-2 text-xl font-bold tabular-nums text-zinc-50 sm:text-2xl">{{ card.value == null ? '—' : numberFormatter.format(card.value) }} <span v-if="card.value != null" class="text-xs font-medium text-zinc-400">{{ card.unit }}</span></dd><dd v-if="card.detail" class="mt-0.5 text-xs text-zinc-400">{{ card.detail }}</dd></div>
      </dl>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section class="min-w-0 space-y-4 rounded-xl border border-zinc-800 bg-[#151518] p-4 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-sm font-semibold text-zinc-100">Tendência de atividades</h2><div role="group" aria-label="Métrica do gráfico" class="flex gap-1 rounded-lg bg-[#101012] p-1"><button v-for="metric in [{ id: 'durationMinutes' as const, label: 'Tempo' }, { id: 'distanceKm' as const, label: 'Distância' }, { id: 'calories' as const, label: 'Calorias' }]" :key="metric.id" type="button" :aria-pressed="trendMetric === metric.id" class="min-h-8 rounded-md px-2.5 text-xs font-medium text-zinc-400 aria-pressed:bg-zinc-800 aria-pressed:text-orange-300" @click="trendMetric = metric.id">{{ metric.label }}</button></div></div>
          <LazyHealthActivityChart v-if="summary?.trend.length" :activities="summary.trend.map(entry => ({ dateKey: entry.dateKey, durationMinutes: entry[trendMetric] }))" :label="trendLabel" />
          <div v-else class="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-center text-sm text-zinc-400">Sem registros para esta métrica no período.</div>
        </section>
        <section class="rounded-xl border border-zinc-800 bg-[#151518] p-4 space-y-3"><h2 class="text-sm font-bold text-white">Recuperação e prontidão</h2><p class="text-xs text-zinc-400">{{ overview?.recovery ? 'Índice estimado pelo jogo: ' + overview.recovery.score + '% · ' + overview.recovery.statusLabel + '. Não é avaliação clínica.' : 'Dados insuficientes para estimar a prontidão.' }}</p><p class="text-xs text-zinc-400">{{ overview?.acwr == null ? 'Dados insuficientes para calcular ACWR.' : 'ACWR: ' + numberFormatter.format(overview.acwr) }}</p><p class="text-xs text-zinc-400">O ACWR compara a carga dos últimos 7 dias à média semanal dos últimos 28 dias.</p><div class="grid grid-cols-2 gap-2 text-xs"><div class="p-3 rounded-md bg-[#111113] border border-[#27272A]"><p class="text-zinc-500">Sono registrado mais recente</p><strong>{{ summary?.dailyMetrics.find(item => (item.data.sleepHours ?? 0) > 0)?.data.sleepHours ?? '—' }} h</strong></div><div class="p-3 rounded-md bg-[#111113] border border-[#27272A]"><p class="text-zinc-500">FC repouso recente</p><strong>{{ summary?.dailyMetrics.find(item => item.data.restingHeartRate != null)?.data.restingHeartRate ?? '—' }} bpm</strong></div></div></section>
      </div>
      <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><h2 class="text-sm font-bold text-white">Zonas de frequência cardíaca (Z1–Z5)</h2><p v-if="!zoneTotal" class="text-xs text-zinc-400">Sem minutos registrados em zonas cardíacas no período.</p><div v-for="(minutes, idx) in zoneValues" :key="idx" class="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-2 text-xs"><span class="font-semibold text-zinc-300">Z{{ idx + 1 }}</span><div class="h-2 rounded-sm bg-[#111113] overflow-hidden border border-[#27272A]"><div class="h-full transition-[width] duration-500 motion-reduce:transition-none" :style="{ width: (zoneTotal ? minutes / zoneTotal * 100 : 0) + '%', backgroundColor: ['#94a3b8', '#60a5fa', '#10b981', '#f97316', '#ef4444'][idx] }" /></div><span class="text-right text-zinc-400">{{ numberFormatter.format(minutes) }} min</span></div></section>
    </div>
    <OriginalHealthConnections v-if="props.section === 'sync'" @imported="refreshSummary(); emit('imported')" />
    <section v-show="props.section === 'sync'" aria-labelledby="saude" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-4">
    <h2 id="saude" class="text-sm font-bold text-white">Importar dados de saúde</h2>
    <form class="flex flex-wrap items-end gap-3 text-xs" @submit.prevent="importFiles">
      <label>Formato
        <select v-model="source" :disabled="busy">
          <option value="apple_health">Apple Health (XML)</option>
          <option value="samsung_health">Samsung Health (CSV ou JSON)</option>
          <option value="gpx">GPX</option>
          <option value="csv">CSV</option>
        </select>
      </label>
      <label class="min-w-0 max-w-full">Arquivo
        <input
          :key="source" ref="input" class="block max-w-full" type="file" required :disabled="busy"
          :multiple="source === 'samsung_health'"
          :accept="{ apple_health: '.xml', samsung_health: '.csv,.json', gpx: '.gpx', csv: '.csv' }[source]">
      </label>
      <button class="rounded-md bg-[#F97316] text-zinc-950 font-semibold px-4 py-2 disabled:opacity-50" :disabled="busy">{{ busy ? 'Importando…' : 'Importar' }}</button>
    </form>
    <p v-if="message" role="status">{{ message }}</p>
    <ul v-if="warnings.length">
      <li v-for="(warning, index) in warnings.slice(0, 10)" :key="index">{{ warning }}</li>
    </ul>
    </section>
    <MurimDataState v-if="summaryError && (props.section === 'overview' || props.section === 'activities')" kind="error" message="Falha ao carregar o resumo." retry @retry="refreshSummary()" />
    <section v-else-if="summary" v-show="props.section === 'activities'" class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3">
      <h3 class="text-sm font-bold text-white">Atividades recentes</h3>
      <p v-if="!summary.activities.length">Suas atividades importadas vão aparecer aqui.</p>
      <ul v-if="summary.activities.length" class="space-y-2 text-xs">
        <li v-for="activity in summary.activities" :key="`${activity.source}:${activity.id}`" class="p-3 rounded-md bg-[#111113] border border-[#27272A]">
          {{ activity.data.title }} · {{ dateFormatter.format(new Date(activity.data.dateKey)) }}
          · {{ numberFormatter.format(activity.data.durationMinutes) }} min
          <template v-if="activity.data.distanceKm"> · {{ numberFormatter.format(activity.data.distanceKm) }} km</template>
        </li>
      </ul>
      <details v-if="summary.dailyMetrics.length">
        <summary>Métricas diárias recentes</summary>
        <ul>
          <li v-for="metric in summary.dailyMetrics" :key="`${metric.source}:${metric.date}`">
            {{ dateFormatter.format(new Date(metric.date)) }}<template v-if="metric.data.steps != null"> · {{ numberFormatter.format(metric.data.steps) }} passos</template>
            <template v-if="metric.data.sleepHours != null"> · {{ numberFormatter.format(metric.data.sleepHours) }} h de sono</template>
            · {{ { csv: 'CSV', gpx: 'GPX', apple_health: 'Apple Health', samsung_health: 'Samsung Health', strava: 'Strava', health_connect: 'Health Connect' }[metric.source] ?? metric.source }}
          </li>
        </ul>
      </details>
    </section>
  </div>
</template>

<style scoped>

form { display: flex; flex-wrap: wrap; align-items: end; gap: .75rem; }
label { display: grid; gap: .25rem; min-width: 0; }
input, select { padding: .45rem; background: #111113; color: #e4e4e7; border: 1px solid #27272a; border-radius: .375rem; }
</style>
