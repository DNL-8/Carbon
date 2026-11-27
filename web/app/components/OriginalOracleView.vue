<script setup lang="ts">
import type { ProfileInput } from '../../shared/training'
defineProps<{ progress?: { level: number, xp: number, currentStreak?: number } | null }>()
const { data: overview } = useNuxtData<{ recovery: { score: number, statusLabel: string, acwrRatio: number } | null }>('hero:overview')
const { data: hero } = useNuxtData<{ profile: ProfileInput | null }>('hero:profile')
const prompts = [
  'Minha recuperação permite treino intenso hoje?',
  'Como distribuir meu tempo entre Zonas 2 e 4?',
  'Qual treino combina com meu objetivo agora?',
  'Como interpretar minha carga aguda/crônica?',
]
const input = ref('')
const includeHealth = ref(false)
const sending = ref(false)
const cooldown = ref(0)
const feedback = ref('')
const messages = ref<{ id: number, role: 'user' | 'oracle', content: string }[]>([])
const bottom = ref<HTMLElement>()
let nextId = 0
let timer: ReturnType<typeof setInterval> | undefined
const canSend = computed(() => !sending.value && cooldown.value === 0)
async function send(question = input.value) {
  const text = question.trim()
  if (!text || text.length > 300 || !canSend.value) return
  feedback.value = ''
  sending.value = true
  input.value = ''
  messages.value.push({ id: nextId++, role: 'user', content: text })
  cooldown.value = 5
  if (timer) clearInterval(timer)
  timer = setInterval(() => { cooldown.value = Math.max(0, cooldown.value - 1); if (!cooldown.value && timer) clearInterval(timer) }, 1000)
  try {
    const result = await $fetch('/api/oracle/ask', { method: 'POST', body: { question: text, includeHealth: includeHealth.value } })
    messages.value.push({ id: nextId++, role: 'oracle', content: result.reply })
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    feedback.value = status === 503 ? 'Oráculo indisponível: configure GEMINI_API_KEY e GEMINI_MODEL no servidor.' : status === 429 ? 'Limite de consultas atingido. Aguarde.' : 'Falha ao consultar o Oráculo.'
  } finally { sending.value = false }
}
watch([() => messages.value.length, sending], async () => { await nextTick(); bottom.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <div class="flex flex-col h-[calc(100vh-9.5rem)] md:h-[calc(100vh-6rem)] max-h-[780px] space-y-3">
    <header class="bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-2 shrink-0 text-left">
      <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-md bg-[#111113] border border-[#27272A] flex items-center justify-center shrink-0"><OriginalGlyph name="compass" class="text-orange-400" /></div><div><h1 class="text-base font-bold tracking-tight text-white">Oráculo · Análise de treino</h1><p class="text-xs text-zinc-400">Conectado ao seu nível e aos dados de treino que você autorizar compartilhar.</p></div></div>
      <div class="text-[11px] text-zinc-400 font-mono-tabular flex flex-wrap gap-x-2 gap-y-1"><span class="text-zinc-200">Nível {{ progress?.level ?? '—' }}</span><span>·</span><span>{{ progress?.xp ?? '—' }} XP</span><span>·</span><span>Streak {{ progress?.currentStreak ?? '—' }}d</span><span>·</span><span class="text-orange-400">Prontidão {{ overview?.recovery ? overview.recovery.score + '%' : '—' }}</span><span>·</span><span>ACWR {{ overview?.recovery?.acwrRatio ?? '—' }}</span></div>
    </header>
    <p v-if="feedback" role="alert" class="bg-[#18181B] border border-red-500/45 rounded-md p-3 text-xs text-red-400">{{ feedback }}</p>
    <div class="flex-1 overflow-y-auto bg-[#18181B] border border-[#27272A] rounded-lg p-4 space-y-3.5">
      <div v-if="!messages.length" class="h-full flex flex-col items-start justify-center text-left px-2 py-6 space-y-4 max-w-lg">
        <div class="w-10 h-10 rounded-md bg-[#111113] border border-[#27272A] flex items-center justify-center"><OriginalGlyph name="sparkle" class="text-orange-400" /></div>
        <div class="space-y-1"><h2 class="font-bold text-white text-sm">Consulta fisiológica para {{ hero?.profile?.name || 'seu herói' }}</h2><p class="text-xs text-zinc-400 leading-relaxed">Orientação sobre treinos, sono, zonas cardíacas e recuperação. Os dados de saúde são opcionais.</p></div>
        <div class="flex flex-wrap gap-2"><button v-for="prompt in prompts" :key="prompt" type="button" :disabled="!canSend" class="text-xs font-medium px-3 py-2 rounded-md bg-[#111113] hover:bg-zinc-800 border border-[#27272A] hover:border-orange-500/45 text-zinc-200 transition-colors text-left disabled:opacity-50" @click="send(prompt)">{{ prompt }}</button></div>
      </div>
      <div v-for="msg in messages" :key="msg.id" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"><div class="max-w-[85%] rounded-lg px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line text-left" :class="msg.role === 'user' ? 'bg-[#F97316] text-zinc-950 font-semibold rounded-br-sm' : 'bg-[#111113] border border-[#27272A] text-zinc-200 rounded-bl-sm'"><div v-if="msg.role === 'oracle'" class="text-[11px] font-semibold uppercase tracking-wider text-orange-400 mb-1">Oráculo</div>{{ msg.content }}</div></div>
      <div v-if="sending" class="flex justify-start"><div class="bg-[#111113] border border-[#27272A] rounded-lg px-4 py-3 text-xs text-zinc-300 flex items-center gap-2"><OriginalGlyph name="compass" class="animate-spin text-orange-400" />Analisando sua consulta...</div></div>
      <div ref="bottom" />
    </div>
    <div v-if="messages.length" class="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0"><button v-for="prompt in prompts" :key="prompt" type="button" :disabled="!canSend" class="text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1.5 rounded-md bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] text-zinc-300 disabled:opacity-50" @click="send(prompt)">{{ prompt }}</button></div>
    <form class="bg-[#18181B] border border-[#27272A] rounded-lg p-2.5 space-y-1.5 shrink-0" @submit.prevent="send()">
      <label class="flex gap-2 items-center text-[11px] text-zinc-400"><input v-model="includeHealth" type="checkbox" :disabled="sending">Autorizar envio de resumo de recuperação e carga dos últimos 28 dias ao Gemini nesta consulta.</label>
      <div class="flex items-center gap-2"><input v-model="input" type="text" maxlength="300" placeholder="Pergunte sobre carga, zonas ou recuperação..." aria-label="Pergunta ao Oráculo" :disabled="sending" class="flex-1 min-w-0 bg-[#111113] border border-[#27272A] rounded-md px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"><button type="submit" :disabled="!input.trim() || !canSend" aria-label="Enviar mensagem ao Oráculo" class="min-h-[42px] px-4 py-2 rounded-md bg-[#F97316] hover:bg-orange-400 disabled:bg-[#111113] disabled:text-zinc-500 text-zinc-950 font-semibold text-xs flex items-center gap-1.5"><OriginalGlyph name="play" />{{ cooldown ? cooldown + 's' : 'Enviar' }}</button></div>
      <div class="flex items-center justify-between px-1 text-[11px] text-zinc-500"><span>Orientação educativa · Em caso de dor, procure um médico · Conversa mantida nesta sessão.</span><span>{{ input.length }}/300</span></div>
    </form>
  </div>
</template>
