<script setup lang="ts">
defineProps<{ message: string, kind: 'loading' | 'error' | 'empty', retry?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-[#111113] p-3 text-sm text-zinc-300">
    <p :role="kind === 'error' ? 'alert' : 'status'">{{ message }}</p>
    <button v-if="retry" type="button" class="min-h-11 rounded-md border border-zinc-700 px-3 text-xs font-semibold text-orange-400 focus-visible:outline-2 focus-visible:outline-orange-400" @click="emit('retry')">Tentar novamente</button>
    <slot />
  </div>
</template>
