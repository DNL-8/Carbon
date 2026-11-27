<script setup lang="ts">
defineExpose({ refresh })

const { data, error, refresh: refreshPage } = await useFetch('/api/extrato', { key: 'hero:ledger' })
type Entry = NonNullable<typeof data.value>['entries'][number]
const moreEntries = ref<Entry[]>([])
const nextCursor = ref<number | null>(null)
const busy = ref(false)
const loadError = ref(false)
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
})
const signed = new Intl.NumberFormat('pt-BR', { signDisplay: 'exceptZero' })
const cursor = computed(() => moreEntries.value.length ? nextCursor.value : data.value?.nextCursor)

async function refresh() {
  moreEntries.value = []
  nextCursor.value = null
  await refreshPage()
}

async function loadMore() {
  if (!cursor.value || busy.value) return
  busy.value = true
  loadError.value = false
  try {
    const page = await $fetch('/api/extrato', { query: { cursor: cursor.value } })
    moreEntries.value.push(...page.entries)
    nextCursor.value = page.nextCursor
  } catch {
    loadError.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <details class="ledger">
    <summary>Extrato de recompensas</summary>
    <p v-if="error" role="alert">Falha ao carregar. <button @click="refresh()">Tentar novamente</button></p>
    <p v-else-if="!data?.entries.length">Seus ganhos e gastos vão aparecer aqui.</p>
    <ol v-else>
      <li v-for="entry in [...data.entries, ...moreEntries]" :key="entry.id">
        <strong>{{ entry.title }}</strong>
        <span>{{ signed.format(entry.xpDelta) }} XP · {{ signed.format(entry.coinDelta) }} moedas</span>
        <small>{{ dateFormat.format(new Date(entry.createdAt)) }} · Saldo: {{ entry.totalXp }} XP e {{ entry.goldCoins }} moedas</small>
      </li>
    </ol>
    <p v-if="loadError" role="alert">Falha ao carregar mais lançamentos.</p>
    <button v-if="cursor" :disabled="busy" @click="loadMore">Ver lançamentos anteriores</button>
  </details>
</template>

<style scoped>
summary { cursor: pointer; color: #addf9e; padding-block: .5rem; }
ol { padding: 0; list-style: none; }
li { display: grid; gap: .2rem; padding: .6rem 0; border-top: 1px solid #47615b; }
</style>
