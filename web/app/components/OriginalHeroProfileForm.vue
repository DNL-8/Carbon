<script setup lang="ts">
import { experienceLevels, type ProfileInput } from '../../shared/training'
import { HERO_AVATARS } from '../../../src/utils/rpgLogic'

const props = defineProps<{ initial: ProfileInput, busy: boolean, feedback?: string, cancelLabel?: string, submitLabel?: string }>()
const emit = defineEmits<{ save: [profile: ProfileInput], cancel: [] }>()
const draft = reactive<ProfileInput>({ ...props.initial })
const inputClass = 'w-full px-3 py-2 rounded-md bg-[#111113] border border-[#27272A] focus:outline-none focus:border-orange-500 text-white text-sm'
function optionalNumber(field: 'heightCm' | 'weightKg' | 'restingHrBaseline' | 'maxHrEstimated', event: Event) {
  const input = event.target as HTMLInputElement
  draft[field] = input.value === '' ? null : input.valueAsNumber
}
</script>

<template>
  <form class="space-y-4 text-left" @submit.prevent="emit('save', { ...draft })">
    <p v-if="feedback" role="status" class="text-xs text-orange-400">{{ feedback }}</p>
    <label class="block text-xs font-semibold text-zinc-300">Nome do herói <input v-model="draft.name" required autocomplete="nickname" name="hero-name" minlength="2" maxlength="80" :class="inputClass"></label>
    <div class="grid grid-cols-2 gap-3">
      <label v-for="field in [{ key: 'heightCm' as const, label: 'Altura (cm)', min: 100, max: 250, step: 1 }, { key: 'weightKg' as const, label: 'Peso (kg)', min: 25, max: 350, step: 0.1 }, { key: 'restingHrBaseline' as const, label: 'FC repouso (bpm)', min: 30, max: 120, step: 1 }, { key: 'maxHrEstimated' as const, label: 'FC máxima (bpm)', min: 120, max: 220, step: 1 }]" :key="field.key" class="block text-xs font-semibold text-zinc-300">{{ field.label }}<input type="number" :value="draft[field.key] ?? ''" :min="field.min" :max="field.max" :step="field.step" :class="inputClass" @input="optionalNumber(field.key, $event)"></label>
    </div>
    <div><span class="block text-xs font-semibold text-zinc-300 mb-1.5">Emblema</span><div class="grid grid-cols-6 gap-2"><button v-for="item in HERO_AVATARS" :key="item.id" type="button" :aria-label="item.label" :aria-pressed="draft.avatar === item.emoji" class="h-10 rounded-md border bg-[#111113] border-[#27272A]" :class="{ 'border-orange-500 text-orange-400': draft.avatar === item.emoji }" @click="draft.avatar = item.emoji">{{ item.emoji }}</button></div></div>
    <div><span class="block text-xs font-semibold text-zinc-300 mb-1.5">Classe</span><div class="grid grid-cols-3 gap-2"><button v-for="cls in ['Guerreiro', 'Arqueiro', 'Mago'] as const" :key="cls" type="button" class="py-2 px-2 rounded-md text-xs font-semibold border" :aria-pressed="draft.heroClass === cls" :class="draft.heroClass === cls ? 'bg-[#F97316] text-zinc-950 border-[#F97316]' : 'bg-[#111113] text-zinc-400 border-[#27272A]'" @click="draft.heroClass = cls">{{ cls }}</button></div></div>
    <div><span class="block text-xs font-semibold text-zinc-300 mb-1.5">Objetivo</span><div class="grid grid-cols-3 gap-2"><button v-for="obj in ['Emagrecer', 'Condicionamento', 'Ambos'] as const" :key="obj" type="button" class="py-2 rounded-md text-xs font-semibold border" :aria-pressed="draft.objective === obj" :class="draft.objective === obj ? 'bg-[#F97316] text-zinc-950 border-[#F97316]' : 'bg-[#111113] text-zinc-400 border-[#27272A]'" @click="draft.objective = obj">{{ obj }}</button></div></div>
    <div><span class="block text-xs font-semibold text-zinc-300 mb-1.5">Experiência</span><div class="grid grid-cols-3 gap-2"><button v-for="exp in experienceLevels" :key="exp" type="button" class="py-2 rounded-md text-xs font-semibold border" :aria-pressed="draft.experience === exp" :class="draft.experience === exp ? 'bg-orange-500/15 text-orange-400 border-orange-500/45' : 'bg-[#111113] text-zinc-400 border-[#27272A]'" @click="draft.experience = exp">{{ exp }}</button></div></div>
    <div class="flex gap-3"><button v-if="cancelLabel" type="button" :disabled="busy" class="flex-1 py-2.5 rounded-md bg-[#111113] border border-[#27272A] text-zinc-300 text-xs" @click="emit('cancel')">{{ cancelLabel }}</button><button type="submit" :disabled="busy" class="flex-1 py-2.5 rounded-md bg-[#F97316] text-zinc-950 font-semibold text-xs">{{ submitLabel ?? 'Salvar perfil' }}</button></div>
  </form>
</template>
