<script setup lang="ts">
import type { ExerciseItem } from '../../../src/types/fitness'
import { BODY_ZONE_LABELS, buildAthleticBodyGeometry, computeMuscleHeatmapLevel } from '../../../src/utils/athleticAnatomy'
import { type BodyZone, CYCLE_PHASE_BOUNDARIES, getExerciseMotionSpec, interpolatePose } from '../../../src/utils/exerciseMotion'
const props = defineProps<{ exercise: ExerciseItem, compact?: boolean }>()
const uid = useId().replace(/:/g, '')
const spec = computed(() => getExerciseMotionSpec(props.exercise))
const playing = ref(false)
const rate = ref<0.5 | 1>(1)
const progress = ref(0)
const selectedMuscle = ref<BodyZone | 'all'>('all')
const [holdStart, holdEnd] = CYCLE_PHASE_BOUNDARIES
const checkpoints = [holdStart / 2, (holdStart + holdEnd) / 2, (1 + holdEnd) / 2]
let frame = 0
let last = 0
function step(now: number) {
  if (!playing.value) return
  if (last) progress.value = (progress.value + Math.min(.1, (now - last) / 1000) * rate.value / spec.value.cycleSeconds) % 1
  last = now
  frame = requestAnimationFrame(step)
}
function stop() { cancelAnimationFrame(frame); last = 0 }
watch(playing, value => { stop(); if (value) frame = requestAnimationFrame(step) })
function reset() { progress.value = 0; selectedMuscle.value = 'all' }
watch(() => props.exercise.id, reset)
onMounted(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) progress.value = .5; else playing.value = true })
onUnmounted(stop)
const motion = computed(() => interpolatePose(spec.value.keyFrames, progress.value))
const pose = computed(() => motion.value.pose)
const geometry = computed(() => buildAthleticBodyGeometry(pose.value, spec.value.archetype, spec.value.highlightZones))
const heatmap = computed(() => new Map(spec.value.highlightZones.map(zone => [zone, computeMuscleHeatmapLevel(spec.value.highlightZones, zone, selectedMuscle.value, motion.value.contractionIntensity, motion.value.phaseIndex)])))
const heatZones = computed(() => [...heatmap.value].map(([zone, state]) => ({ zone, colors: state.colors })))
function overlays(layers: string[]) {
  return geometry.value.muscleOverlays.flatMap(m => {
    const state = heatmap.value.get(m.zone)
    if (!state || !layers.includes(m.layer)) return []
    const selected = selectedMuscle.value === m.zone
    return [{ zone: m.zone, d: m.d, striationD: m.striationD ?? undefined, glow: state.colors.glow, stroke: state.colors.stroke, highlight: state.colors.highlight, selected,
      halo: state.isDimmed ? 0 : Math.max(0, (state.intensity - .32) * (selected ? .72 : .48)),
      fillOpacity: state.isDimmed ? .14 : selected ? .68 + state.intensity * .30 : .48 + state.intensity * .46,
      striationOpacity: state.isDimmed ? .08 : .25 + state.intensity * .55 }]
  })
}
const lowerOverlays = computed(() => overlays(['torso', 'leg']))
const armOverlays = computed(() => overlays(['arm']))
const rearFill = `url(#body-rear-${uid})`
const rearStroke = computed(() => geometry.value.isFrontal ? '#A9816C' : '#73564B')
const surfaceFill = (surface: string) => `url(#surface-${surface}-${uid})`
const supportFoot = computed(() => pose.value.foot2 && pose.value.foot2.y > pose.value.foot.y ? pose.value.foot2 : pose.value.foot)
const phase = computed(() => spec.value.phaseLabels[motion.value.phaseIndex].split(' · '))
function seek(event: Event) { playing.value = false; progress.value = Number((event.target as HTMLInputElement).value) / 1000 }
function jump(i: number) { playing.value = false; progress.value = checkpoints[i] ?? 0 }
</script>
<template>
  <div class="overflow-hidden rounded-xl border border-zinc-800 bg-[#09090B]">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 bg-[#111113] px-3.5 py-3"><div><p class="text-sm font-semibold text-zinc-50">{{ phase[0] }}</p><p class="text-xs text-zinc-400">{{ phase[1] }}</p></div><span class="text-xs font-mono-tabular text-zinc-200">{{ Math.round(progress * 100) }}%</span></div>
    <div class="relative aspect-[272/162] w-full select-none bg-[#09090B]" :class="compact ? 'max-h-[185px]' : 'max-h-[328px]'">
<svg
          viewBox="24 0 272 162"
          role="img"
          :aria-label="`Demonstração anatômica com mapa de calor muscular do exercício ${exercise.name}`"
          class="w-full h-full block"
        >
          <defs>
            <radialGradient :id="`stage-spot-${uid}`" cx="50%" cy="48%" r="48%">
              <stop offset="0%" stop-color="#2A201B" stop-opacity="0.82" />
              <stop offset="100%" stop-color="#09090B" stop-opacity="0" />
            </radialGradient>
            <linearGradient :id="`body-material-${uid}`">
              <stop offset="0%" stop-color="#A97C69" />
              <stop offset="32%" stop-color="#F1D8BD" />
              <stop offset="58%" stop-color="#D3AA91" />
              <stop offset="100%" stop-color="#8D6256" />
            </linearGradient>
            <linearGradient v-for="(coords, surface) in geometry.surfaceLighting" :key="surface" :id="`surface-${surface}-${uid}`" :href="`#body-material-${uid}`" gradientUnits="userSpaceOnUse" v-bind="coords" />
            <radialGradient :id="`body-head-${uid}`" cx="34%" cy="29%" r="73%">
              <stop offset="0%" stop-color="#F7E1C9" />
              <stop offset="59%" stop-color="#D5A991" />
              <stop offset="100%" stop-color="#956858" />
            </radialGradient>
            <linearGradient :id="`body-rear-${uid}`" x2="100%" y2="70%">
              <stop offset="0%" :stop-color="geometry.isFrontal ? '#C99881' : '#AE8270'" />
              <stop offset="50%" :stop-color="geometry.isFrontal ? '#DDB8A0' : '#906B5E'" />
              <stop offset="100%" stop-color="#60433E" />
            </linearGradient>
            <linearGradient :id="`equipment-${uid}`" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#818B98" />
              <stop offset="36%" stop-color="#39414E" />
              <stop offset="100%" stop-color="#141821" />
            </linearGradient>
            <linearGradient :id="`shorts-${uid}`" x2="90%" y2="30%">
              <stop offset="0%" stop-color="#293449" />
              <stop offset="45%" stop-color="#475978" />
              <stop offset="100%" stop-color="#233047" />
            </linearGradient>
            <radialGradient v-for="zone in heatZones" :key="zone.zone" :id="`heat-zone-${zone.zone}-${uid}`" cx="46%" cy="42%" r="72%"><stop offset="0%" :stop-color="zone.colors.highlight" /><stop offset="52%" :stop-color="zone.colors.mid" /><stop offset="100%" :stop-color="zone.colors.edge" /></radialGradient>
            <filter :id="`heat-glow-${uid}`" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
            <radialGradient :id="`floor-shadow-${uid}`">
              <stop offset="0%" stop-color="#000" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#000" stop-opacity="0" />
            </radialGradient>
            <pattern :id="`stage-grid-${uid}`" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="#27272A" stroke-width="0.45" />
            </pattern>
          </defs>

          <!-- Subtle arena floor & studio spotlight -->
          <rect x="0" y="0" width="320" height="180" :fill="`url(#stage-spot-${uid})`" />
          <rect x="0" y="0" width="320" height="152" opacity="0.45" :fill="`url(#stage-grid-${uid})`" />
          <line x1="20" y1="152" x2="300" y2="152" stroke="#27272A" stroke-width="1.5" />
          <line
            x1="48"
            y1="156"
            x2="272"
            y2="156"
            stroke="#18181B"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
          <ellipse
            :cx="supportFoot.x + 2"
            cy="154"
            rx="22"
            ry="3.6"
            :fill="`url(#floor-shadow-${uid})`"
            :opacity="Math.max(0.14, Math.min(1, (supportFoot.y - 120) / 27))"
          />

          <!-- Equipment behind/supporting athlete -->
          <template v-if="spec.equipmentProp === 'parallel_bars'"><g stroke="#52525B" stroke-width="3.5" stroke-linecap="round">
              <line x1="126" y1="92" x2="194" y2="92" stroke="#F97316" stroke-width="4" />
              <line x1="130" y1="92" x2="130" y2="152" />
              <line x1="190" y1="92" x2="190" y2="152" />
            </g>

</template>

          <template v-if="spec.equipmentProp === 'bench_step' && spec.archetype === 'bulgarian_squat'"><g>
              <rect
                x="96"
                y="118"
                width="34"
                height="8"
                rx="2.5"
                fill="#18181B"
                stroke="#52525B"
                stroke-width="1.5"
              />
              <line x1="104" y1="126" x2="104" y2="152" stroke="#3F3F46" stroke-width="3" />
              <line x1="122" y1="126" x2="122" y2="152" stroke="#3F3F46" stroke-width="3" />
            </g>

</template>

          <template v-if="spec.equipmentProp === 'bench_step' && spec.archetype === 'calf_raise'"><rect
              x="146"
              y="144"
              width="34"
              height="8"
              rx="2"
              fill="#18181B"
              stroke="#F97316"
              stroke-width="1.5"
            />

</template>

          <!-- Rear limbs (depth silhouette) -->
          <template v-if="geometry.backThighPath && geometry.backShinPath && geometry.backFootPath"><g :fill="rearFill" :stroke="rearStroke" stroke-width="0.8">
              <path :d="geometry.backThighPath" />
              <path :d="geometry.backShinPath" />
              <path :d="geometry.backFootPath" />
              <template v-if="geometry.backShoeSolePath"><path :d="geometry.backShoeSolePath" fill="none" stroke="#94A3B8" stroke-width="0.9" stroke-linecap="round" opacity="0.7" />

</template>

              <template v-if="geometry.backShortsPath"><path :d="geometry.backShortsPath" fill="#293143" stroke="#3C465B" /></template>
            </g>

</template>

          <template v-if="geometry.backUpperArmPath && geometry.backForearmPath"><g :fill="rearFill" :stroke="rearStroke" stroke-width="0.8">
              <path :d="geometry.backUpperArmPath" />
              <path :d="geometry.backForearmPath" />
              <template v-if="geometry.backHandPath"><path :d="geometry.backHandPath" /></template>
            </g>

</template>

          <!-- Torso & Neck -->
          <path
            :d="geometry.neckPath"
            :fill="surfaceFill('torso')"
            stroke="#3F3F46"
            stroke-width="0.6"
          />
          <path
            :d="geometry.torsoPath"
            :fill="surfaceFill('torso')"
            stroke="#52525B"
            stroke-width="0.8"
          />
          <path
            :d="geometry.torsoContourPath"
            fill="none"
            stroke="#80594D"
            stroke-width="0.75"
            stroke-linecap="round"
            opacity="0.4"
          />

          <!-- Sculpted Head -->
          <path
            :d="geometry.headPath"
            :fill="`url(#body-head-${uid})`"
            stroke="#52525B"
            stroke-width="0.8"
          />
          <path :d="geometry.hairPath" fill="#302820" />
          <path
            :d="geometry.facePath"
            fill="none"
            stroke="#614238"
            stroke-width="0.85"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            :d="geometry.headHighlightPath"
            fill="none"
            stroke="#FFFFFF"
            stroke-width="1"
            stroke-linecap="round"
            opacity="0.27"
          />

          <!-- Foreground Leg & Athletic Shoe -->
          <g stroke="#525D6B" stroke-width="0.65" stroke-linejoin="round">
            <path :d="geometry.frontThighPath" :fill="surfaceFill('thigh')" />
            <path :d="geometry.frontShinPath" :fill="surfaceFill('shin')" />
          </g>
          <path :d="geometry.frontShortsPath" :fill="`url(#shorts-${uid})`" stroke="#65748D" stroke-width="0.55" />
          <path
            :d="geometry.shortsWaistbandPath"
            fill="none"
            stroke="#94A3B8"
            stroke-width="1"
            stroke-linecap="round"
            opacity="0.48"
          />
          <path
            :d="geometry.frontFootPath"
            :fill="`url(#equipment-${uid})`"
            stroke="#BCC7D8"
            stroke-width="0.9"
          />
          <path
            :d="geometry.frontShoeSolePath"
            fill="none"
            stroke="#E2E8F0"
            stroke-width="1.05"
            stroke-linecap="round"
            opacity="0.8"
          />

          <!-- Anatomical Contour Seams -->
          <g fill="none" stroke="#785245" stroke-width="0.65" stroke-linecap="round" opacity="0.32" pointer-events="none">
            <path v-for="(d, index) in geometry.anatomicalDetailPaths" :key="index" :d="d" />
          </g>

          <!-- Torso & Leg Heatmap Layer -->
          <OriginalMuscleOverlay :items="lowerOverlays" :uid="uid" />

          <!-- Foreground Arm -->
          <g stroke="#525D6B" stroke-width="0.65" stroke-linejoin="round">
            <path :d="geometry.frontUpperArmPath" :fill="surfaceFill('upperArm')" />
            <path :d="geometry.frontForearmPath" :fill="surfaceFill('forearm')" />
            <path :d="geometry.frontHandPath" :fill="`url(#body-head-${uid})`" />
          </g>

          <!-- Upper-limb Heatmap Layer (Shoulders / Biceps / Triceps) -->
          <OriginalMuscleOverlay :items="armOverlays" :uid="uid" />

          <!-- Foreground Weight / Barbell / Goblet Props -->
          <template v-if="pose.barCenter && (spec.equipmentProp === 'barbell_floor' || spec.equipmentProp === 'barbell_rack')"><g>
                <line
                  :x1="pose.barCenter.x - 16"
                  :y1="pose.barCenter.y"
                  :x2="pose.barCenter.x + 16"
                  :y2="pose.barCenter.y"
                  stroke="#A1A1AA"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
                <circle
                  :cx="pose.barCenter.x"
                  :cy="pose.barCenter.y"
                  r="8.5"
                  :fill="`url(#equipment-${uid})`"
                  stroke="#F97316"
                  stroke-width="2"
                />
                <circle :cx="pose.barCenter.x" :cy="pose.barCenter.y" r="2.2" fill="#FAFAFA" />
              </g>

</template>

          <template v-if="pose.barCenter && spec.equipmentProp === 'goblet_weight'"><g>
              <rect
                :x="pose.barCenter.x - 3"
                :y="pose.barCenter.y - 7"
                width="6"
                height="14"
                rx="1.5"
                :fill="`url(#body-head-${uid})`"
              />
              <rect
                :x="pose.barCenter.x - 6.5"
                :y="pose.barCenter.y - 10"
                width="13"
                height="4.5"
                rx="1.5"
                :fill="`url(#equipment-${uid})`"
                stroke="#F97316"
                stroke-width="1.6"
              />
              <rect
                :x="pose.barCenter.x - 5.5"
                :y="pose.barCenter.y + 5.5"
                width="11"
                height="4"
                rx="1.5"
                :fill="`url(#equipment-${uid})`"
                stroke="#F97316"
                stroke-width="1.6"
              />
            </g>

</template>

          <template v-if="pose.barCenter && (spec.equipmentProp === 'short_bar' || (spec.equipmentProp === 'bench_step' && spec.archetype !== 'hip_thrust'))"><g>
                <rect
                  :x="pose.barCenter.x - 5.5"
                  :y="pose.barCenter.y - 5.5"
                  width="11"
                  height="11"
                  rx="2.5"
                  fill="#18181B"
                  stroke="#F97316"
                  stroke-width="1.8"
                />
              </g>

</template>

          <template v-if="pose.barCenter && spec.equipmentProp === 'hip_plate'"><ellipse
              :cx="pose.barCenter.x"
              :cy="pose.barCenter.y"
              rx="10"
              ry="5"
              fill="#18181B"
              stroke="#F97316"
              stroke-width="2"
            />

</template>

        </svg>
    </div>
    <div class="space-y-3 p-3 bg-[#111113]">
      <div class="flex flex-wrap gap-2 text-xs"><button type="button" class="rounded-md border border-zinc-700 px-3 py-2" @click="playing = !playing">{{ playing ? 'Pausar demonstração' : 'Reproduzir' }}</button><button type="button" class="rounded-md border border-zinc-700 px-3 py-2" @click="rate = rate === 1 ? .5 : 1">{{ rate }}x</button><button type="button" class="rounded-md border border-zinc-700 px-3 py-2" @click="reset">Reiniciar</button></div>
      <input type="range" min="0" max="999" :value="Math.floor(progress * 1000)" aria-label="Posição do movimento" class="w-full accent-orange-500" @input="seek">
      <div class="grid grid-cols-3 gap-1"><button v-for="(label, i) in spec.phaseLabels" :key="i" type="button" class="rounded-md border border-zinc-800 px-2 py-1.5 text-[11px]" :class="motion.phaseIndex === i ? 'text-orange-400 border-orange-500' : 'text-zinc-400'" @click="jump(i)">{{ label.split('·')[0] }}</button></div>
      <div class="flex flex-wrap gap-1.5"><button v-for="zone in spec.highlightZones" :key="zone" type="button" :aria-pressed="selectedMuscle === zone" class="rounded-md bg-[#09090B] border border-zinc-800 px-2 py-1 text-[11px]" :class="selectedMuscle === zone ? 'text-orange-400' : 'text-zinc-300'" @click="selectedMuscle = selectedMuscle === zone ? 'all' : zone">{{ BODY_ZONE_LABELS[zone] }} · {{ heatmap.get(zone)?.colors.levelLabel }}</button></div>
    </div>
  </div>
</template>
