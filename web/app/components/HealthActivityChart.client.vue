<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js'
import type { ChartOptions } from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

const props = withDefaults(defineProps<{ activities: { dateKey: string, durationMinutes: number }[], label?: string }>(), { label: 'Minutos de atividade por dia' })
const dates = computed(() => {
  const totals = new Map<string, number>()
  for (const { dateKey, durationMinutes } of props.activities) {
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + durationMinutes)
  }
  return [...totals].sort(([left], [right]) => left.localeCompare(right))
})
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const numberFormat = new Intl.NumberFormat('pt-BR')
const data = computed(() => ({
  labels: dates.value.map(([date]) => dateFormat.format(new Date(date))),
  datasets: [{
    label: props.label,
    data: dates.value.map(([, minutes]) => minutes),
    backgroundColor: '#fb923c',
    borderRadius: 4,
  }],
}))
const reducedMotion = usePreferredReducedMotion()
const options = computed<ChartOptions<'bar'>>(() => ({
  animation: reducedMotion.value === 'reduce' ? false : undefined,
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { ticks: { color: '#d4d4d8' }, grid: { display: false } },
    y: { beginAtZero: true, ticks: { color: '#d4d4d8' }, grid: { color: '#27272a' } },
  },
}))
</script>

<template>
  <figure>
    <figcaption>{{ label }}</figcaption>
    <div class="chart">
      <Bar :data="data" :options="options" :aria-label="label" role="img" />
    </div>
    <details class="mt-2 text-xs text-zinc-300">
      <summary class="cursor-pointer">Ver dados do gráfico</summary>
      <table class="mt-2 w-full text-left tabular-nums">
        <caption class="sr-only">{{ label }}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">{{ label }}</th></tr></thead>
        <tbody>
          <tr v-for="[date, value] in dates" :key="date">
            <th scope="row">{{ dateFormat.format(new Date(date)) }}</th>
            <td>{{ numberFormat.format(value) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>

<style scoped>
figure { margin: 1rem 0; }
figcaption { margin-bottom: .5rem; }
.chart { height: 12rem; position: relative; }
</style>
