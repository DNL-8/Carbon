<script setup lang="ts">
import { createAuthClient } from 'better-auth/vue'

const auth = createAuthClient()
const route = useRoute()
const password = ref('')
const message = ref('')
const busy = ref(false)
const valid = computed(() => typeof route.query.token === 'string' && !!route.query.token)

async function reset() {
  busy.value = true
  try {
    const { error } = await auth.resetPassword({ token: String(route.query.token), newPassword: password.value })
    if (error) {
      message.value = error.message ?? 'Não foi possível redefinir a senha.'
      return
    }
    await navigateTo('/')
  } catch {
    message.value = 'Não foi possível redefinir a senha.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main>
    <h1>Redefinir senha</h1>
    <form v-if="valid" @submit.prevent="reset">
      <label>Nova senha <input v-model="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <button :disabled="busy">Salvar nova senha</button>
    </form>
    <p v-else>Solicite um novo link de redefinição.</p>
    <p v-if="message" role="status">{{ message }}</p>
    <NuxtLink to="/">Voltar</NuxtLink>
  </main>
</template>
