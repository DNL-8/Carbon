<script setup lang="ts">
import { navigateTabs } from '../utils/tab-keyboard'

type AuthTab = 'login' | 'register' | 'recover'
const props = defineProps<{ busy: boolean, feedback: string }>()
const emit = defineEmits<{
  submit: [mode: AuthTab, credentials: { email: string, password: string, name: string }]
  google: []
  guest: []
  clear: []
}>()
const tab = ref<AuthTab>('login')
const selectedTab = computed(() => tab.value === 'register' ? 'register' : 'login')
const name = ref('')
const email = ref('')
const password = ref('')
const validation = ref('')
const pending = ref<'google' | 'credentials'>()
function select(mode: AuthTab) {
  tab.value = mode
  password.value = ''
  validation.value = ''
  emit('clear')
}
function submit() {
  if (props.busy) return
  validation.value = ''
  emit('clear')
  const cleanEmail = email.value.trim().toLowerCase()
  const cleanName = name.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    validation.value = 'Informe um endereço de e-mail válido.'
    return
  }
  if (tab.value !== 'recover' && password.value.length < 8) {
    validation.value = 'A senha deve ter pelo menos 8 caracteres.'
    return
  }
  if (tab.value === 'register' && cleanName.length < 2) {
    validation.value = 'Informe seu nome (mínimo 2 caracteres).'
    return
  }
  pending.value = 'credentials'
  emit('submit', tab.value, { email: cleanEmail, password: password.value, name: cleanName })
}
function google() {
  if (props.busy) return
  validation.value = ''
  pending.value = 'google'
  emit('google')
}
const inputClass = 'w-full min-h-11 pl-10 pr-3 py-2 rounded-md bg-[#111113] border border-[#27272A] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500'
const iconClass = 'text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'
</script>

<template>
  <main class="original-auth min-h-screen bg-[#09090b] px-5 py-7 text-zinc-100 sm:px-8 lg:grid lg:place-items-center lg:py-12">
    <div class="mx-auto grid w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-zinc-800 bg-[#141416] lg:grid-cols-[1.15fr_1fr]">
      <section class="auth-intro relative isolate flex flex-col overflow-hidden px-6 py-7 sm:px-9 lg:min-h-[660px] lg:p-11" aria-labelledby="auth-title">
        <div class="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-100">
          <span class="grid size-8 place-items-center rounded-lg border border-orange-400/30 bg-orange-400/10 text-orange-300">
            <OriginalGlyph name="hiit" />
          </span>
          Fitness RPG
        </div>
        <div class="relative z-10 mt-6 max-w-lg lg:mt-12">
          <h1 id="auth-title" class="text-4xl font-extrabold leading-[1.03] tracking-[-0.06em] text-zinc-50 sm:text-5xl lg:text-6xl">
            Seu treino.<br><span class="text-orange-300">Sua evolução.</span>
          </h1>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-zinc-300 sm:text-base">
            Registre seus treinos, acompanhe a saúde pelo Health Connect e evolua seu personagem no Murim.
          </p>
        </div>
        <img src="/assets/mascote-murim.svg" width="490" height="490" alt="" class="pointer-events-none relative mt-4 hidden w-[290px] self-center lg:block" decoding="async">
      </section>
      <section class="flex flex-col justify-center border-t border-zinc-800 px-6 py-7 sm:px-9 lg:border-l lg:border-t-0 lg:px-11" aria-labelledby="auth-access-title">
        <div class="space-y-4">
          <div>
            <h2 id="auth-access-title" class="text-2xl font-bold tracking-tight text-zinc-50">Acessar o Murim</h2>
            <p class="mt-1 text-sm text-zinc-400">Entre para continuar sua jornada.</p>
          </div>
          <div class="space-y-1.5">
            <button type="button" :disabled="busy" class="w-full min-h-11 py-2 px-4 rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 border border-zinc-700 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 cursor-pointer disabled:cursor-not-allowed" @click="google">
              <span v-if="busy && pending === 'google'" class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden="true" />
              <span v-else class="w-5 h-5 rounded-sm font-bold text-xs flex items-center justify-center bg-white text-blue-700" aria-hidden="true">G</span>
              {{ busy && pending === 'google' ? 'Conectando...' : 'Entrar com Google' }}
            </button>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-[#27272A]" />
            <span class="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">ou com e-mail</span>
            <div class="h-px flex-1 bg-[#27272A]" />
          </div>
          <div v-if="validation" role="alert" class="flex items-start justify-between gap-3 p-3.5 rounded-lg bg-red-950/35 border border-red-500/40 text-red-200 text-sm">
            <span>{{ validation }}</span>
            <button type="button" aria-label="Fechar aviso de erro" @click="validation = ''">×</button>
          </div>
          <div v-if="feedback" role="status" class="p-3 rounded-md bg-[#111113] border border-[#27272A] text-xs text-zinc-300">{{ feedback }}</div>
          <div class="grid grid-cols-2 gap-1 p-1 rounded-md bg-[#111113] border border-[#27272A]" role="tablist" aria-label="Modo de acesso por e-mail" @keydown="navigateTabs">
            <button id="auth-tab-login" type="button" role="tab" :disabled="busy" aria-controls="auth-panel-login" :tabindex="selectedTab === 'login' ? 0 : -1" :aria-selected="selectedTab === 'login'" class="min-h-11 rounded-sm text-xs font-semibold transition-colors cursor-pointer" :class="tab !== 'register' ? 'bg-[#27272A] text-white' : 'text-zinc-400 hover:text-zinc-200'" @click="select('login')">Entrar</button>
            <button id="auth-tab-register" type="button" role="tab" :disabled="busy" aria-controls="auth-panel-register" :tabindex="selectedTab === 'register' ? 0 : -1" :aria-selected="selectedTab === 'register'" class="min-h-11 rounded-sm text-xs font-semibold transition-colors cursor-pointer" :class="tab === 'register' ? 'bg-[#27272A] text-white' : 'text-zinc-400 hover:text-zinc-200'" @click="select('register')">Criar conta</button>
          </div>
          <div v-if="selectedTab !== 'login'" id="auth-panel-login" role="tabpanel" aria-labelledby="auth-tab-login" hidden />
          <div v-if="selectedTab !== 'register'" id="auth-panel-register" role="tabpanel" aria-labelledby="auth-tab-register" hidden />
          <div :id="`auth-panel-${selectedTab}`" role="tabpanel" :aria-labelledby="`auth-tab-${selectedTab}`">
            <form class="space-y-3 text-left" novalidate @submit.prevent="submit">
              <div v-if="tab === 'register'" class="space-y-1">
                <label for="auth-name" class="block text-xs font-semibold text-zinc-300">Nome do jogador</label>
                <div class="relative">
                  <svg :class="iconClass" width="18" height="18" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" aria-hidden="true"><circle cx="128" cy="88" r="48" /><path d="M32 216c0-40 40-72 96-72s96 32 96 72" /></svg>
                  <input id="auth-name" v-model="name" name="name" type="text" autocomplete="name" placeholder="Seu nome ou apelido" maxlength="80" :class="inputClass">
                </div>
              </div>
              <div class="space-y-1">
                <label for="auth-email" class="block text-xs font-semibold text-zinc-300">E-mail</label>
                <div class="relative">
                  <svg :class="iconClass" width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z" /></svg>
                  <input id="auth-email" v-model="email" name="email" type="email" spellcheck="false" autocomplete="email" placeholder="voce@exemplo.com" :class="inputClass">
                </div>
              </div>
              <div v-if="tab !== 'recover'" class="space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <label for="auth-password" class="block text-xs font-semibold text-zinc-300">Senha</label>
                  <button v-if="tab === 'login'" type="button" :disabled="busy" class="text-[11px] font-medium text-orange-400 hover:text-orange-300 cursor-pointer" @click="select('recover')">Esqueci minha senha</button>
                </div>
                <div class="relative">
                  <svg :class="iconClass" width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" /></svg>
                  <input id="auth-password" v-model="password" name="password" type="password" :autocomplete="tab === 'register' ? 'new-password' : 'current-password'" :placeholder="tab === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'" :class="inputClass">
                </div>
              </div>
              <div v-if="tab === 'recover'" class="flex items-center justify-between gap-2 text-xs">
                <button type="button" :disabled="busy" class="text-zinc-400 hover:text-zinc-200 cursor-pointer" @click="select('login')">Voltar ao login</button>

              </div>
              <button type="submit" :disabled="busy" class="w-full min-h-11 py-2 px-4 rounded-md disabled:opacity-50 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer bg-orange-400 hover:bg-orange-300 text-zinc-950">
                <span v-if="busy && pending === 'credentials'" class="w-4 h-4 rounded-full border-2 border-orange-400 border-r-transparent animate-spin" aria-hidden="true" />
                {{ busy && pending === 'credentials' ? (tab === 'register' ? 'Criando conta...' : tab === 'recover' ? 'Enviando...' : 'Entrando...') : (tab === 'register' ? 'Criar conta e entrar' : tab === 'recover' ? 'Enviar link de recuperação' : 'Entrar com e-mail') }}
              </button>
            </form>
          </div>
        </div>
        <div class="mt-5 border-t border-zinc-800 pt-3 text-center">
          <button type="button" :disabled="busy" class="min-h-11 rounded-md px-3 text-sm font-semibold text-zinc-300 hover:text-white disabled:opacity-50" @click="emit('guest')">Entrar como visitante</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.original-auth { font-family: 'Plus Jakarta Sans Variable', system-ui, sans-serif; }
.auth-intro {
  background: radial-gradient(ellipse at 82% 82%, #3a281d 0%, #1d1715 48%, #171518 76%);
}
.original-auth :is(button, input):focus-visible {
  outline: 2px solid #fdba74;
  outline-offset: 3px;
}
.original-auth :is(h1, h2, h3) { text-wrap: balance; }
@media (prefers-reduced-motion: reduce) {
  .original-auth *, .original-auth *::before, .original-auth *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
</style>
