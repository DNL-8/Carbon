<script setup lang="ts">
import type { WorkoutTemplate } from '../../../src/types/fitness'
import { customWorkoutSchema, type CustomWorkoutInput } from '../../shared/training'

defineProps<{ workouts: WorkoutTemplate[] }>()
const emit = defineEmits<{ saved: [] }>()
const deleteId = ref<string | null>(null)
const blank = (): CustomWorkoutInput => ({
  name: '', description: '', type: 'forca', durationMinutes: 30,
  exercises: [{ name: '', prescription: '' }],
})
const id = ref('')
const form = ref(blank())
const busy = ref(false)
const message = ref('')

function edit(workout?: WorkoutTemplate) {
  id.value = workout?.id ?? ''
  form.value = workout ? {
    name: workout.name, description: workout.description, type: workout.type,
    durationMinutes: workout.durationMinutes,
    exercises: workout.exercises.map(({ id, name, prescription, restSeconds, muscleGroups, executionTip, loadKg, equipment, unilateral }) => ({ id, name, prescription, restSeconds, muscleGroups, executionTip, loadKg, equipment, unilateral })),
  } : blank()
  message.value = ''
}

async function remove() {
  if (!deleteId.value || busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/treinos/personalizados/${deleteId.value}`, { method: 'DELETE' })
    edit()
    deleteId.value = null
    message.value = 'Treino excluído. Seu histórico foi preservado.'
    emit('saved')
  } catch { message.value = 'Não foi possível excluir o treino.' }
  finally { busy.value = false }
}
async function save() {
  const input = customWorkoutSchema.safeParse(form.value)
  if (!input.success) {
    message.value = 'Preencha o nome, a duração e os exercícios.'
    return
  }
  id.value ||= crypto.randomUUID()
  busy.value = true
  try {
    const saved = await $fetch(`/api/treinos/personalizados/${id.value}`, { method: 'PUT', body: input.data })
    edit(saved)
    message.value = 'Treino salvo.'
    emit('saved')
  } catch {
    message.value = 'Não foi possível salvar o treino. Tente novamente.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <details class="editor">
    <summary>Montar ou editar treino</summary>
    <div class="actions">
      <button type="button" :disabled="busy" @click="edit()">Novo treino</button>
      <button v-for="workout in workouts" :key="workout.id" type="button" :disabled="busy" @click="edit(workout)">
        Editar {{ workout.name }}
      </button>
    </div>
    <form @submit.prevent="save">
      <label>Nome do treino <input v-model="form.name" maxlength="120" required></label>
      <label>Descrição <input v-model="form.description" maxlength="600"></label>
      <label>Tipo
        <select v-model="form.type">
          <option value="forca">Força</option><option value="cardio">Cardio</option><option value="hiit">HIIT</option>
          <option value="core">Core</option><option value="mobilidade">Mobilidade</option><option value="corpo_inteiro">Corpo inteiro</option>
        </select>
      </label>
      <label>Duração (min) <input v-model.number="form.durationMinutes" type="number" min="1" max="300" required></label>
      <fieldset v-for="(exercise, index) in form.exercises" :key="exercise.id ?? index">
        <legend>Exercício {{ index + 1 }}</legend>
        <label>Nome do exercício <input v-model="exercise.name" maxlength="120" required></label>
        <label>Prescrição <input v-model="exercise.prescription" maxlength="120" placeholder="3 séries x 12 repetições" required></label>
        <label>Descanso (s) <input v-model.number="exercise.restSeconds" type="number" min="0" max="900" placeholder="60"></label>
        <label>Carga (kg) <input v-model.number="exercise.loadKg" type="number" min="0" max="2000" step=".01"></label>
        <label>Equipamento <input v-model="exercise.equipment" maxlength="120"></label>
        <label>Dicas técnicas <textarea v-model="exercise.executionTip" maxlength="600" rows="2" /></label>
        <label><input v-model="exercise.unilateral" type="checkbox"> Unilateral</label>
        <button v-if="form.exercises.length > 1" type="button" :disabled="busy" @click="form.exercises.splice(index, 1)">Remover exercício</button>
      </fieldset>
      <button type="button" :disabled="busy || form.exercises.length >= 30" @click="form.exercises.push({ name: '', prescription: '' })">Adicionar exercício</button>
      <button :disabled="busy">Salvar treino</button>
      <button v-if="id" type="button" :disabled="busy" class="text-red-400" @click="deleteId = id">Excluir treino</button>
    </form>
    <UModal :open="!!deleteId" title="Excluir treino personalizado?" @update:open="value => { if (!value) deleteId = null }"><template #body><p class="text-xs text-zinc-300">Seu histórico e recordes serão preservados.</p><div class="flex gap-2 mt-3"><button type="button" @click="deleteId = null">Cancelar</button><button type="button" :disabled="busy" class="text-red-400" @click="remove">Confirmar exclusão</button></div></template></UModal>
    <p v-if="message" role="status">{{ message }}</p>
  </details>
</template>

<style scoped>
.editor { margin-block: 1rem; background:#18181b; border:1px solid #27272a; border-radius:.5rem; padding:1rem; }
summary { color: #fb923c; cursor: pointer; }
.actions, form, fieldset { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; }
.actions { margin-block: .75rem; }
fieldset { width: 100%; }
label { display: grid; gap: .25rem; }
input, select, textarea, button { padding: .45rem; border:1px solid #27272a; background:#111113; border-radius:.375rem; color:#e4e4e7; }
</style>
