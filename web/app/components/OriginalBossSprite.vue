<script setup lang="ts">
import { BOSS_REACTION_MS } from '../utils/combat-animation'

const props = withDefaults(defineProps<{ variant: 'golem' | 'hydra' | 'sentinel' | 'dragon', hitId?: number, isDefeated?: boolean }>(), { hitId: 0, isDefeated: false })
const heads = [{ x: 26, y: 42 }, { x: 44, y: 26 }, { x: 60, y: 20 }, { x: 76, y: 26 }, { x: 94, y: 42 }]
const hit = ref(false)
watch(() => props.hitId, async (id, _previous, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  hit.value = false
  if (!id) return
  await nextTick()
  if (cancelled) return
  hit.value = true
  const timer = setTimeout(() => { hit.value = false }, BOSS_REACTION_MS)
  onCleanup(() => clearTimeout(timer))
})
</script>
<template>
  <div
    class="relative inline-flex h-24 w-24 select-none items-center justify-center transition-[opacity,scale] duration-300 motion-reduce:transition-none"
    :class="{ 'opacity-30 scale-90': isDefeated, 'boss-hit': hit && !isDefeated }"
    :data-motion="isDefeated ? 'defeat' : hit ? 'hit' : 'idle'"
    :style="{ '--reaction-duration': BOSS_REACTION_MS + 'ms' }"
  >
      <svg
        
        viewBox="0 0 120 120"
        class="w-full h-full overflow-visible" :class="{ 'boss-idle': !isDefeated && !hit }"
        role="img"
         :aria-label="`Chefe de Masmorra (${variant})`"
      >
        <ellipse cx="60" cy="108" rx="38" ry="7" fill="rgba(249, 115, 22, 0.14)" />

        <g v-if="variant === 'golem'">
            <rect x="14" y="46" width="18" height="40" rx="7" fill="#3F3F46" stroke="#71717A" stroke-width="2" />
            <rect x="88" y="46" width="18" height="40" rx="7" fill="#3F3F46" stroke="#71717A" stroke-width="2" />
            <rect x="38" y="84" width="16" height="22" rx="5" fill="#27272A" stroke="#52525B" stroke-width="2" />
            <rect x="66" y="84" width="16" height="22" rx="5" fill="#27272A" stroke="#52525B" stroke-width="2" />
            <rect x="30" y="34" width="60" height="54" rx="14" fill="#27272A" stroke="#71717A" stroke-width="2.4" />
            <path d="M 46 42 L 60 56 L 54 66 L 68 78" fill="none" stroke="#F97316" stroke-width="2.2" />
            <circle cx="60" cy="60" r="8" fill="#EA580C" stroke="#FED7AA" stroke-width="2" />
            <rect x="40" y="20" width="40" height="20" rx="8" fill="#18181B" stroke="#71717A" stroke-width="2" />
            <rect x="46" y="27" width="28" height="6" rx="3" fill="#09090B" />
            <circle cx="52" cy="30" r="2.6" fill="#F97316" />
            <circle cx="68" cy="30" r="2.6" fill="#F97316" />
          </g>

        <g v-if="variant === 'hydra'">
            <path d="M 32 100 Q 32 68 60 68 Q 88 68 88 100 Z" fill="#18181B" stroke="#71717A" stroke-width="2.2" />
            <circle cx="60" cy="86" r="7" fill="#EF4444" stroke="#FCA5A5" stroke-width="1.5" />
            <g v-for="(h, idx) in heads" :key="idx">
                <path
                  :d="`M 60 72 Q ${(60 + h.x) / 2} 54 ${h.x} ${h.y + 8}`"
                  fill="none"
                  stroke="#3F3F46"
                  stroke-width="8"
                  stroke-linecap="round"
                />
                <circle :cx="h.x" :cy="h.y" r="10" fill="#111113" stroke="#71717A" stroke-width="2" />
                <circle :cx="h.x - 3" :cy="h.y" r="1.8" fill="#F97316" />
                <circle :cx="h.x + 3" :cy="h.y" r="1.8" fill="#F97316" />
              </g>
            
          </g>

        <g v-if="variant === 'sentinel'">
            <polygon points="60,12 92,48 78,100 42,100 28,48" fill="#18181B" stroke="#71717A" stroke-width="2.4" />
            <polygon points="60,28 76,52 60,82 44,52" fill="#27272A" stroke="#F97316" stroke-width="1.8" />
            <circle cx="51" cy="48" r="3.5" fill="#FB923C" />
            <circle cx="69" cy="48" r="3.5" fill="#FB923C" />
          </g>

        <g v-if="variant === 'dragon'">
            <path d="M 28 52 L 8 28 L 20 68 Z" fill="#7F1D1D" stroke="#F87171" stroke-width="2" />
            <path d="M 92 52 L 112 28 L 100 68 Z" fill="#7F1D1D" stroke="#F87171" stroke-width="2" />
            <rect x="34" y="34" width="52" height="62" rx="16" fill="#450A0A" stroke="#EF4444" stroke-width="2.4" />
            <path d="M 40 30 L 30 10 L 48 24" fill="#FBBF24" />
            <path d="M 80 30 L 90 10 L 72 24" fill="#FBBF24" />
            <circle cx="50" cy="46" r="3.8" fill="#FDE047" />
            <circle cx="70" cy="46" r="3.8" fill="#FDE047" />
            <polygon points="60,58 68,72 60,86 52,72" fill="#F97316" stroke="#FDE047" stroke-width="1.5" />
          </g>

      </svg>
  </div>
</template>
<style scoped>
.boss-idle { animation: idle 2.2s ease-in-out 2; }
.boss-hit { animation: hit var(--reaction-duration) ease-out; }
@keyframes idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes hit { 0%,100% { transform: translateX(0) scale(1); } 28% { transform: translateX(7px) scale(.95); } 62% { transform: translateX(-2px) scale(1.02); } }
@media (prefers-reduced-motion: reduce) { .boss-idle, .boss-hit { animation: none; } }
</style>
