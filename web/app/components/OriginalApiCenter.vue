<script setup lang="ts">
import { consoleOperations as operations, consolePath, type ConsoleOperation as Operation } from '../../shared/console'
const emit = defineEmits<{ changed: [] }>()
const selected = ref<Operation>(operations[0]!)
const search = ref('')
const domain = ref('Todos')
const groups = ['Todos', ...new Set(operations.map(item => item.group))]
const visible = computed(() => operations.filter(item => (domain.value === 'Todos' || item.group === domain.value) && (item.label + ' ' + item.path + ' ' + item.method).toLowerCase().includes(search.value.toLowerCase().trim())))
const output = ref('')
const status = ref<number | null>(null)
const busy = ref(false)
const body = ref('{}')
const pathId = ref('')
const confirm = ref(false)
const elapsed = ref(0)
const executed = ref('')
const copied = ref(false)
function select(item: Operation) {
  if (busy.value) return
  selected.value = item
  output.value = ''
  status.value = null
  body.value = JSON.stringify(item.example ?? {}, null, 2)
  pathId.value = ''
  confirm.value = false
}
function createId() {
  if (selected.value.param) pathId.value = crypto.randomUUID()
  else {
    try {
      const data = JSON.parse(body.value)
      body.value = JSON.stringify({ ...data, id: crypto.randomUUID() }, null, 2)
    } catch { output.value = 'JSON inválido.' }
  }
}
async function run(item: Operation) {
  if (busy.value) return
  if (selected.value.id !== item.id) select(item)
  busy.value = true
  output.value = ''
  status.value = null
  const start = performance.now()
  try {
    const path = consolePath(item, pathId.value)
    const payload = item.example ? JSON.parse(body.value) : undefined
    // Same-origin fixed allowlist. Server routes validate payload and authenticated user.
    const response = await $fetch.raw(path, { method: item.method, body: payload, credentials: 'same-origin', ignoreResponseError: true, retry: 0 })
    status.value = response.status
    output.value = JSON.stringify(response._data, null, 2) ?? ''
    if (response.status < 400 && item.method !== 'GET') emit('changed')
  } catch (error) { output.value = error instanceof Error ? error.message : 'Não foi possível executar.' }
  finally { elapsed.value = Math.round(performance.now() - start); executed.value = new Date().toLocaleTimeString('pt-BR'); busy.value = false }
}
function requestRun() {
  if (selected.value.method === 'GET') return run(selected.value)
  confirm.value = true
}
async function copy() {
  try { await navigator.clipboard.writeText(output.value); copied.value = true } catch { copied.value = false }
}
</script>
<template>
  <div class="space-y-6 pb-8">
    <section class="rounded-lg bg-[#18181B] border border-[#27272A] p-5 md:p-6 space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="space-y-1.5 text-left">
          <div class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400"><OriginalGlyph name="terminal" />PostgreSQL + Better Auth + Nitro</div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">Central de comandos PostgreSQL &amp; API</h1>
          <p class="text-sm text-zinc-400 max-w-2xl">Execute operações HTTP do aplicativo com sua sessão autenticada. Alterações exigem confirmação; credenciais não são exibidas.</p>
        </div>
        <button type="button" :disabled="busy" class="min-h-[42px] px-4 py-2 rounded-md bg-[#111113] hover:bg-[#27272A] border border-[#F97316]/45 text-xs font-semibold text-orange-300 inline-flex items-center gap-2" @click="run(operations[0]!)"><OriginalGlyph name="core" />Testar /api/health</button>
      </div>
      <div class="pt-4 border-t border-[#27272A] flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mr-1 inline-flex items-center gap-1.5"><OriginalGlyph name="hiit" class="text-orange-400" />Comandos rápidos:</span>
        <button v-for="item in operations.filter(op => ['state', 'quest', 'gear', 'health-summary'].includes(op.id))" :key="item.id" type="button" :disabled="busy" class="min-h-[36px] px-3 py-1.5 rounded-md bg-[#111113] hover:bg-[#27272A] border border-[#27272A] text-xs font-semibold text-zinc-200 transition-colors" @click="run(item)">{{ item.label }}</button>
      </div>
    </section>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <aside class="lg:col-span-5 rounded-lg bg-[#18181B] border border-[#27272A] p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-300">Operações ({{ visible.length }})</h2><span class="text-[11px] font-mono-tabular text-zinc-500">Nitro &amp; /api/*</span>
        </div>
        <div class="relative">
          <OriginalGlyph name="search" class="text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input v-model="search" aria-label="Buscar operação" type="text" placeholder="Buscar coleção, rota ou comando..." class="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-md bg-[#111113] border border-[#27272A] focus:border-[#F97316] focus:outline-none text-xs text-zinc-100">
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="group in groups" :key="group" type="button" :aria-pressed="domain === group" class="px-2.5 py-1 rounded-sm text-[11px] border font-semibold" :class="domain === group ? 'bg-orange-500/15 text-orange-400 border-orange-500/45' : 'bg-[#111113] text-zinc-400 border-[#27272A]'" @click="domain = group">{{ group }}</button>
        </div>
        <button v-for="item in visible" :key="item.path" type="button" class="w-full text-left p-3 rounded-md border bg-[#111113] space-y-1" :class="selected.id === item.id ? 'border-orange-500/45' : 'border-[#27272A]'" @click="select(item)">
          <span class="text-xs font-semibold text-zinc-200">{{ item.label }}</span>
          <span class="block text-[11px] font-mono-tabular text-zinc-400"><span :class="item.method === 'GET' ? 'text-zinc-300' : item.method === 'DELETE' ? 'text-red-400' : 'text-emerald-400'">{{ item.method }}</span> {{ item.path }}</span>
        </button>
      </aside>
      <section class="lg:col-span-7 rounded-lg bg-[#18181B] border border-[#27272A] p-5 space-y-4">
        <h2 class="text-base font-bold text-white">Orquestrador Único de Comandos</h2>
        <div class="p-3 rounded-md bg-[#111113] border border-[#27272A] text-xs font-mono-tabular text-zinc-200"><span class="text-emerald-400">{{ selected.method }}</span> {{ selected.path }}</div>
        <div v-if="selected.param" class="space-y-1 text-xs"><label class="block text-zinc-400">ID do treino <input v-model="pathId" class="w-full p-2 rounded-md bg-[#111113] border border-[#27272A] text-zinc-100" /></label><button v-if="selected.method === 'PUT'" type="button" class="text-orange-400" @click="createId">Gerar novo UUID</button></div>
        <div v-if="selected.example" class="space-y-2"><div class="flex justify-between text-xs"><span class="text-zinc-400">Payload JSON</span><button v-if="['vow-create','loadout-save','finish'].includes(selected.id)" type="button" class="text-orange-400" @click="createId">Gerar UUID</button></div><textarea v-model="body" aria-label="Payload JSON" rows="10" spellcheck="false" class="w-full p-3 rounded-md bg-[#09090B] border border-[#27272A] text-xs font-mono-tabular text-zinc-100" /></div>
        <p class="text-xs text-zinc-400">{{ selected.note ?? (selected.method === 'GET' ? 'Consulta somente de leitura.' : 'Esta operação modifica a sua conta. Revise os dados antes de executar.') }}</p>
        <p class="text-[11px] text-zinc-500">Concessões arbitrárias de XP/HP e comandos SQL diretos não estão disponíveis; as regras RPG são validadas no servidor.</p>
        <button type="button" :disabled="busy" class="min-h-[42px] px-4 rounded-md bg-[#F97316] text-zinc-950 text-xs font-semibold disabled:opacity-50" @click="requestRun">{{ busy ? 'Executando...' : 'Executar comando' }}</button>
        <div v-if="status !== null" role="status" class="text-xs" :class="status < 400 ? 'text-emerald-400' : 'text-red-400'">HTTP {{ status }} · {{ elapsed }} ms · {{ executed }}</div>
        <button v-if="output" type="button" class="text-xs text-orange-400" @click="copy">{{ copied ? 'Copiado' : 'Copiar resposta' }}</button>
        <pre v-if="output" data-testid="api-response" class="max-h-[500px] overflow-auto whitespace-pre-wrap break-all p-3 rounded-md bg-[#09090B] border border-[#27272A] text-xs font-mono-tabular text-zinc-300">{{ output }}</pre>
      </section>
    </div>
    <UModal :open="confirm" title="Executar alteração na conta?" @update:open="confirm = $event"><template #body><div class="space-y-3 text-xs"><p>{{ selected.label }} · {{ selected.method }} {{ selected.path }}</p><p v-if="selected.note">{{ selected.note }}</p><p>Confirme somente se os dados estiverem corretos.</p><div class="flex gap-2"><button type="button" class="px-3 py-2 border border-zinc-700 rounded-md" @click="confirm = false">Cancelar</button><button type="button" class="px-3 py-2 bg-orange-500 text-zinc-950 rounded-md font-semibold" :disabled="busy" @click="confirm = false; run(selected)">Confirmar execução</button></div></div></template></UModal>
  </div>
</template>
