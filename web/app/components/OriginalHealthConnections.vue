<script setup lang="ts">
const emit = defineEmits<{ imported: [] }>()
const { data: strava, refresh: refreshStrava } = await useFetch('/api/strava/status', { key: 'hero:strava-status', lazy: true })
const stravaBusy = ref(false)
const stravaMessage = ref('')
const days = ref<7 | 28 | 90>(28)
async function connect() {
  stravaBusy.value = true
  try {
    const response = await $fetch('/api/strava/auth-url', { method: 'POST' })
    const url = new URL(response.url)
    if (url.origin !== 'https://www.strava.com' || url.pathname !== '/oauth/authorize') throw Error('URL inválida')
    window.location.assign(url.href)
  } catch { stravaMessage.value = 'Não foi possível iniciar a autorização.'; stravaBusy.value = false }
}
async function sync() {
  stravaBusy.value = true
  stravaMessage.value = ''
  try {
    const result = await $fetch('/api/strava/sync', { method: 'POST', body: { days: days.value } })
    stravaMessage.value = result.imported + ' atividades novas, ' + result.duplicates + ' duplicadas. +' + result.xp + ' XP.' + (result.truncated ? ' Limite de 150 registros atingido.' : '')
    emit('imported')
  } catch { stravaMessage.value = 'Falha na sincronização. Confira a conexão e tente novamente.' }
  finally { stravaBusy.value = false }
}
async function disconnect() {
  stravaBusy.value = true
  try { await $fetch('/api/strava/disconnect', { method: 'POST' }); await refreshStrava(); stravaMessage.value = 'Conexão local removida. Dados importados preservados.' }
  catch { stravaMessage.value = 'Não foi possível desconectar.' }
  finally { stravaBusy.value = false }
}
const { data: hc, status: hcStatus, error: hcError, refresh: refreshHc } = await useFetch('/api/saude/health-connect', { key: 'hero:health-connect', lazy: true })
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
const formatDate = (date: string) => dateFormat.format(new Date(date))
const formatValue = (value: number | null, unit = '') =>
  value == null ? '—' : numberFormat.format(value) + (unit ? ' ' + unit : '')

const metricColumns = [
  { key: 'steps', label: 'Passos', unit: '' },
  { key: 'calories', label: 'Calorias totais', unit: 'kcal' },
  { key: 'sleepHours', label: 'Sono', unit: 'h' },
] as const
const latestMeasurements = computed(() => metricColumns.map(metric => {
  const row = hc.value?.dailyMetrics.find(day => day[metric.key] != null)
  return { ...metric, date: row?.dateKey, value: row?.[metric.key] ?? null }
}))
const hasHcData = computed(() => (hc.value?.daysCount ?? 0) + (hc.value?.activitiesCount ?? 0) > 0)

async function updateHealthConnect() {
  await refreshHc()
  if (!hcError.value) emit('imported')
}
</script>
<template>
  <div class="space-y-4">
    <section aria-labelledby="health-connect-title" class="rounded-xl border border-emerald-950 bg-[#18181B] p-4 sm:p-5 space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h2 id="health-connect-title" class="flex items-center gap-2 text-base font-semibold text-white">
            <OriginalGlyph name="cardio" class="text-emerald-400" /> Health Connect
          </h2>
          <p class="text-sm text-zinc-400">Métricas enviadas pelo app Android para sua conta Murim.</p>
        </div>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-zinc-700 px-3 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50"
          :disabled="hcStatus === 'pending'"
          @click="updateHealthConnect"
        >
          {{ hcStatus === 'pending' ? 'Atualizando…' : 'Atualizar dados' }}
        </button>
      </header>
      <p v-if="hcStatus === 'pending'" role="status" class="text-sm text-zinc-400">Buscando dados sincronizados…</p>
      <p v-else-if="hcError" role="alert" class="text-sm text-amber-300">
        {{ hcError.statusCode === 401 ? 'Entre na sua conta Murim para consultar seus dados.' : hcError.statusCode === 403 ? 'Verifique seu e-mail para consultar seus dados.' : 'Não foi possível carregar os dados. Tente atualizar novamente.' }}
      </p>
      <p v-else-if="!hasHcData" class="rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
        Entre no app Android com a mesma conta Murim, permita o acesso ao Health Connect e toque em <strong>Sincronizar agora</strong>. Depois, atualize esta página.
      </p>
      <template v-else-if="hc">
        <p role="status" class="text-sm text-zinc-300">
          {{ numberFormat.format(hc.daysCount) }} {{ hc.daysCount === 1 ? 'dia com métricas' : 'dias com métricas' }}
          <span aria-hidden="true" class="mx-1 text-zinc-500">·</span>
          {{ numberFormat.format(hc.activitiesCount) }} {{ hc.activitiesCount === 1 ? 'atividade importada' : 'atividades importadas' }}
        </p>
        <div v-if="hc.dailyMetrics.length" class="space-y-4">
          <dl class="grid gap-2 sm:grid-cols-3">
            <div v-for="metric in latestMeasurements" :key="metric.key" class="rounded-lg border border-zinc-800 bg-[#111113] p-3">
              <dt class="text-xs text-zinc-400">{{ metric.label }}</dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{{ formatValue(metric.value, metric.unit) }}</dd>
              <dd class="text-xs text-zinc-400">{{ metric.date ? formatDate(metric.date) : 'Sem registro recente' }}</dd>
            </div>
          </dl>
          <details class="rounded-lg border border-zinc-800 bg-[#111113]">
            <summary class="cursor-pointer px-3 py-3 text-sm font-medium text-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-400">
              Histórico diário
            </summary>
            <div class="overflow-x-auto">
              <table class="w-full whitespace-nowrap text-left text-sm tabular-nums">
                <caption class="sr-only">Até 30 dias registrados no Health Connect</caption>
                <thead class="text-xs text-zinc-400">
                  <tr>
                    <th scope="col" class="px-3 py-2">Data</th>
                    <th v-for="metric in metricColumns" :key="metric.key" scope="col" class="px-3 py-2 text-right">{{ metric.label }}</th>
                  </tr>
                </thead>
                <tbody class="text-zinc-200">
                  <tr v-for="day in hc.dailyMetrics" :key="day.dateKey" class="border-t border-zinc-800">
                    <th scope="row" class="px-3 py-2 font-medium">{{ formatDate(day.dateKey) }}</th>
                    <td v-for="metric in metricColumns" :key="metric.key" class="px-3 py-2 text-right">{{ formatValue(day[metric.key], metric.unit) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="px-3 py-2 text-xs text-zinc-400">— indica que o Android não enviou essa métrica para o dia.</p>
          </details>
        </div>
        <p v-else class="text-sm text-zinc-400">As atividades estão em Relatórios › Atividades. Ainda não há métricas diárias.</p>
      </template>
    </section>
  <section class="bg-[#18181B] border border-[#27272A] rounded-lg p-5 space-y-3"><div class="flex justify-between flex-wrap gap-2"><div><h2 class="text-sm font-bold text-white">Strava · OAuth</h2><p class="text-xs text-zinc-400">Importe suas atividades diretamente do Strava. A conexão é autorizada por você.</p></div><span class="text-xs" :class="strava?.connected ? 'text-emerald-400' : 'text-zinc-400'">{{ strava?.connected ? 'Conectado' : strava?.configured ? 'Desconectado' : 'Não configurado' }}</span></div><p v-if="!strava?.configured" class="text-xs text-zinc-400">Configure as credenciais OAuth no servidor.</p><div v-else-if="!strava.connected"><button type="button" :disabled="stravaBusy" class="px-4 py-2 rounded-md bg-orange-500 text-zinc-950 text-xs font-semibold" @click="connect">Conectar Strava</button></div><div v-else class="flex flex-wrap items-center gap-2"><select v-model.number="days" aria-label="Período Strava" class="bg-[#111113] border border-zinc-700 rounded-md text-xs p-2"><option :value="7">7 dias</option><option :value="28">28 dias</option><option :value="90">90 dias</option></select><button type="button" :disabled="stravaBusy" class="px-3 py-2 rounded-md bg-orange-500 text-zinc-950 text-xs font-semibold" @click="sync">{{ stravaBusy ? 'Sincronizando...' : 'Sincronizar Strava' }}</button><button type="button" :disabled="stravaBusy" class="px-3 py-2 rounded-md border border-zinc-700 text-xs" @click="disconnect">Desconectar</button></div><p v-if="stravaMessage" role="status" class="text-xs text-zinc-300">{{ stravaMessage }}</p><p class="text-[11px] text-zinc-500">FC média e máxima quando fornecidas; zonas cardíacas sem amostras permanecem não registradas. Desconectar não apaga atividades anteriores.</p></section>
  </div>
</template>
