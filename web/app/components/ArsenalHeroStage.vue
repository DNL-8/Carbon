<script setup lang="ts">
import type { EquippedGear, EquipmentItem, EquipmentSlot } from '../../../src/types/fitness'
import { ARSENAL_CONFIG, EQUIPMENT_CATALOG } from '../../../src/utils/rpgLogic'

const props = defineProps<{
  gear: EquippedGear
  name: string
  rank?: string
  realm?: string
  rarity: string
  auraColor: string
  auraMultiplier: number
  preview?: Pick<EquipmentItem, 'id' | 'name' | 'slot'>
  equipped?: { id: number, name: string } | null
}>()
const emit = defineEmits<{ filter: [slot: EquipmentSlot], clear: [] }>()

const icons = { elmo: 'compass', armadura: 'core', capa: 'mobilidade', arma: 'sword' } as const
const slots = computed(() => ARSENAL_CONFIG.slots.map(slot => ({
  ...slot,
  item: EQUIPMENT_CATALOG.find(item => item.id === props.gear[slot.id]),
})))
const activeSlots = computed(() => slots.value.filter(slot => slot.item).length)
const attackId = ref(0)
const attacking = ref(false)
const attackMessage = ref('')
function testStrike() {
  if (attacking.value) return
  attacking.value = true
  attackMessage.value = ''
  attackId.value++
}
function finishStrike() {
  attacking.value = false
  attackMessage.value = 'Golpe de teste concluído.'
}
</script>

<template>
  <section id="arsenal-ficha" tabindex="-1" aria-labelledby="arsenal-hero-name" class="hero-sheet rounded-lg border border-orange-500/30 bg-[#18181B] p-3 sm:p-5">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
      <div class="min-w-0">
        <h2 id="arsenal-hero-name" class="break-words text-lg font-bold text-zinc-100">{{ name }}</h2>
        <p class="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-400"><span>{{ rank ?? '—' }}</span><span>{{ realm ?? '—' }}</span></p>
      </div>
      <div class="flex flex-wrap gap-2 text-xs font-semibold">
        <span class="rounded border border-zinc-700 bg-[#111113] px-2 py-1 text-zinc-300">{{ activeSlots }}/4 slots</span>
        <span class="rounded border border-orange-500/35 bg-[#111113] px-2 py-1 text-orange-300">Aura {{ rarity }} · {{ auraMultiplier.toFixed(2) }}×</span>
      </div>
    </header>

    <div class="equipment-grid mt-3">
      <div class="arena" :style="{ '--arena-aura': auraColor }">
        <div class="arena-stage">
          <div class="arena-seal" aria-hidden="true"><span /></div>
          <div class="arena-floor" aria-hidden="true" />
          <span v-if="preview || equipped" :key="preview ? 'preview-' + preview.id : 'equip-' + equipped?.id" aria-hidden="true" class="arena-pulse" :class="{ 'arena-pulse-confirmed': !preview }" />
          <OriginalMascot :equipped-gear="gear" size="2xl" :attack-id="attackId" game-motion @strike-finished="finishStrike" />
        </div>
        <div class="arena-actions">
          <button type="button" :aria-disabled="attacking" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-[#21160f] px-4 text-sm font-semibold text-orange-200 hover:border-orange-300 focus-visible:outline-2 focus-visible:outline-orange-300 aria-disabled:opacity-60" @click="testStrike">
            <OriginalGlyph name="sword" /> Testar golpe
          </button>
          <span role="status" class="sr-only">{{ attackMessage }}</span>
        </div>
      </div>

      <button
        v-for="slot in slots" :key="slot.id" type="button"
        class="equipment-slot min-w-0 rounded-md border border-zinc-700 bg-[#111113] p-2.5 text-left hover:border-orange-400/60 focus-visible:outline-2 focus-visible:outline-orange-300 sm:p-3"
        :class="{ 'slot-preview': preview?.slot === slot.id }"
        :data-slot-id="slot.id"
        @click="emit('filter', slot.id)"
      >
        <span class="flex items-center gap-1.5 text-xs font-medium text-zinc-300"><OriginalGlyph :name="icons[slot.id]" :size="15" class="shrink-0 text-orange-300" />{{ slot.nome }}</span>
        <span class="mt-1 block break-words text-xs font-semibold text-zinc-100">{{ slot.item?.name ?? 'Sem peça' }}</span>
        <span v-if="slot.item" class="mt-0.5 block text-xs" :class="preview?.slot === slot.id ? 'text-orange-300' : 'text-zinc-400'">{{ preview?.slot === slot.id ? 'Prévia' : 'Equipado' }}</span>
      </button>
    </div>

    <div v-if="preview || equipped" class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p role="status" :class="preview ? 'text-orange-300' : 'text-emerald-300'">
        {{ preview ? 'Prévia: ' + preview.name : 'Equipado: ' + equipped?.name }}
      </p>
      <button v-if="preview" type="button" class="min-h-11 rounded-md border border-zinc-700 bg-[#111113] px-3 text-xs font-semibold text-zinc-100 hover:border-orange-300 focus-visible:outline-2 focus-visible:outline-orange-300" @click="emit('clear')">Limpar prévia</button>
    </div>
  </section>
</template>

<style scoped>
.hero-sheet { background: linear-gradient(150deg, #231912, #18181b 45%); }
.equipment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas: "arena arena" "elmo armadura" "capa arma";
  gap: .625rem;
}
.arena {
  grid-area: arena;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: grid;
  justify-items: center;
  border: 1px solid #543723;
  border-radius: .5rem;
  background:
    radial-gradient(ellipse at 50% 66%, color-mix(in srgb, var(--arena-aura) 24%, transparent), transparent 60%),
    linear-gradient(160deg, #17110e, #0c0b0d 70%);
}
.arena-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 13rem;
  padding: 1.25rem 1rem;
  animation: reveal .34s ease-out;
}
.arena-seal, .arena-floor, .arena-pulse {
  pointer-events: none;
  position: absolute;
  inset-inline: 0;
  margin-inline: auto;
}
.arena-seal {
  top: .9rem;
  width: min(59%, 11rem);
  aspect-ratio: 1;
  border: 1px dashed color-mix(in srgb, var(--arena-aura) 40%, transparent);
  border-radius: 50%;
}
.arena-seal span {
  position: absolute;
  inset: 13%;
  border: 1px solid #ae75464d;
  transform: rotate(45deg);
}
.arena-floor {
  bottom: 1.5rem;
  width: 68%;
  max-width: 14rem;
  height: 2.9rem;
  border: 1px solid #f59e6370;
  border-radius: 50%;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--arena-aura) 42%, transparent), transparent 70%);
  box-shadow: 0 0 1.5rem #ec864f2a, inset 0 0 .8rem #ed864f32;
  animation: settle .8s ease-out;
}
.arena-floor::after { content: ""; position: absolute; inset: .32rem; border: 1px dashed #eab18580; border-radius: 50%; }
.arena-pulse {
  bottom: 1.4rem;
  width: 63%;
  max-width: 13rem;
  height: 3.1rem;
  border: 2px solid var(--arena-aura);
  border-radius: 50%;
  opacity: 0;
  animation: pulse .52s ease-out;
}
.arena-pulse-confirmed { border-color: #86efac; }
.arena-actions { position: relative; padding: 0 .75rem .8rem; }
.equipment-slot { min-height: 4.75rem; }
.slot-preview { border-color: #f97316; background: #251810; }
.equipment-slot[data-slot-id="elmo"] { grid-area: elmo; }
.equipment-slot[data-slot-id="armadura"] { grid-area: armadura; }
.equipment-slot[data-slot-id="capa"] { grid-area: capa; }
.equipment-slot[data-slot-id="arma"] { grid-area: arma; }
@media (min-width: 64rem) {
  .equipment-grid {
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 1.65fr) minmax(0, 1fr);
    grid-template-areas: "elmo arena armadura" "capa arena arma";
    align-items: center;
    gap: 1rem;
  }
}
@keyframes reveal {
  from { opacity: .45; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes settle {
  from { opacity: .38; transform: scale(.82); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pulse {
  from { opacity: .85; transform: scale(.85); }
  to { opacity: 0; transform: scale(1.28); }
}
@media (prefers-reduced-motion: reduce) {
  .arena-stage, .arena-floor, .arena-pulse { animation: none; }
}
</style>
