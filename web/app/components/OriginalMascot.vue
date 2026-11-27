<script setup lang="ts">
import { HERO_SWING_MS } from '../utils/combat-animation'
import type { EquippedGear } from '../../../src/types/fitness'
import { ARSENAL_CONFIG, DEFAULT_EQUIPPED_GEAR, EQUIPMENT_CATALOG, calculateGearBonusSummary, migrateEquippedGear } from '../../../src/utils/rpgLogic'

// SVG layers and equipment geometry ported from ShadowKnightSprite.tsx.
const props = withDefaults(defineProps<{ equippedGear?: EquippedGear, size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl', attackId?: number, isCelebrating?: boolean, gameMotion?: boolean }>(), { equippedGear: undefined, size: 'md', attackId: 0, isCelebrating: false, gameMotion: false })
const emit = defineEmits<{ strikeFinished: [] }>()
const murimMascotUrl = '/assets/mascote-murim.svg'
const bladeOutlines: Partial<Record<string, string>> = {
  arma_adaga_mercador: 'M0 -34 L5.5 -13 L3.5 -10 H-4.5 L-5.5 -13 Z',
  arma_faca_incursao_f: 'M0 -35 L5.5 -24 L4 -10 H-5 L-5.5 -26 Z',
  arma_presas_monarca: 'M1 -49 Q10 -31 5 -10 H-4 Q-1 -32 1 -49 Z',
}

// Normaliza a cena quadrada do SVG enviado para as coordenadas dos equipamentos.
const murimArtworkTransform = 'scale(0.244897959) translate(-95 -30)'

const auraId = useId() + '-aura'
const model = computed(() => {
  const { size, equippedGear = DEFAULT_EQUIPPED_GEAR } = props
  const safeGear = migrateEquippedGear(equippedGear)
  const helmItem = EQUIPMENT_CATALOG.find(i => i.id === safeGear.elmo) ?? null
  const armorItem = EQUIPMENT_CATALOG.find((i) => i.id === safeGear.armadura) ?? null
  const capeItem = EQUIPMENT_CATALOG.find((i) => i.id === safeGear.capa) ?? null
  const weaponItem = EQUIPMENT_CATALOG.find((i) => i.id === safeGear.arma) ?? null
  const eyeColor = helmItem?.id === 'elmo_presa_carmesim'
    ? '#FDA4AF'
    : helmItem?.id === 'elmo_monarca'
      ? '#FDE047'
      : helmItem && (helmItem.rarity === 'Épico' || helmItem.rarity === 'Lendário')
        ? helmItem.secondaryHex
        : undefined
  const showScene = size === '2xl' && !props.gameMotion

  const weaponId = weaponItem?.id ?? ''
  const isStaff = weaponId === 'arma_cajado_abissal'
  const usesPole = isStaff || weaponId.startsWith('arma_lanca_')
  const isTrainingSword = weaponId === 'arma_bastao_treino'
  const bladeOutline = bladeOutlines[weaponId] ?? (
    weaponItem?.iconName === 'Swords'
      ? 'M2 -46 Q9 -31 5 -10 H-5 Q-2 -31 2 -46 Z'
      : 'M0 -46 L6 -33 L5 -10 H-5 L-6 -33 Z'
  )

  const bonusSummary = calculateGearBonusSummary(safeGear)
  const activeFourPiece = bonusSummary.activeSets.find(s => s.fourPieceActive)
  const activeTwoPiece = bonusSummary.activeSets.find((s) => s.twoPieceActive)

  const sizeClass =
    size === 'sm'
      ? 'w-12 h-12'
      : size === 'md'
      ? 'w-16 h-16'
      : size === 'lg'
      ? 'w-24 h-24'
      : size === 'xl'
      ? 'w-32 h-32'
      : 'w-44 h-44 sm:w-52 sm:h-52'

  const rarityConfig = ARSENAL_CONFIG.raridades[bonusSummary.dominantRarityKey]
  const auraHex = activeFourPiece
    ? activeFourPiece.set.themeColorHex
    : rarityConfig?.cor ?? '#a1a1aa'

  const auraMultiplier = bonusSummary.auraMultiplier
  const auraOpacity = Math.min(0.42, 0.16 * auraMultiplier).toFixed(2)
  const haloRadius = Math.round(36 + auraMultiplier * 5)
  const hasEnhancedAura = auraMultiplier >= 1.25 || Boolean(activeTwoPiece)

  return { helmItem, armorItem, capeItem, weaponItem, eyeColor, showScene, weaponId, isStaff, usesPole, isTrainingSword, bladeOutline, activeFourPiece, activeTwoPiece, sizeClass, auraHex, auraMultiplier, auraOpacity, haloRadius, hasEnhancedAura }
})
const helmItem = computed(() => model.value.helmItem)
const armorItem = computed(() => model.value.armorItem)
const capeItem = computed(() => model.value.capeItem)
const weaponItem = computed(() => model.value.weaponItem)
const eyeColor = computed(() => model.value.eyeColor)
const showScene = computed(() => model.value.showScene)
const weaponId = computed(() => model.value.weaponId)
const isStaff = computed(() => model.value.isStaff)
const usesPole = computed(() => model.value.usesPole)
const isTrainingSword = computed(() => model.value.isTrainingSword)
const bladeOutline = computed(() => model.value.bladeOutline)
const activeFourPiece = computed(() => model.value.activeFourPiece)
const activeTwoPiece = computed(() => model.value.activeTwoPiece)
const sizeClass = computed(() => model.value.sizeClass)
const auraHex = computed(() => model.value.auraHex)
const auraMultiplier = computed(() => model.value.auraMultiplier)
const auraOpacity = computed(() => model.value.auraOpacity)
const haloRadius = computed(() => model.value.haloRadius)
const hasEnhancedAura = computed(() => model.value.hasEnhancedAura)
const strike = ref(false)
watch(() => props.attackId, async (id, _previous, onCleanup) => {
  let cancelled = false
  onCleanup(() => { cancelled = true })
  strike.value = false
  if (!id) return
  await nextTick()
  if (cancelled) return
  strike.value = true
  const timer = setTimeout(() => {
    strike.value = false
    emit('strikeFinished')
  }, HERO_SWING_MS)
  onCleanup(() => clearTimeout(timer))
})
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center select-none"
    :class="[sizeClass, { 'sprite-game': gameMotion, 'sprite-strike': strike, 'sprite-celebrate': isCelebrating }]"
    :data-motion="strike ? 'strike' : isCelebrating ? 'victory' : 'idle'"
    :style="{ '--swing-duration': HERO_SWING_MS + 'ms' }"
  >
      <svg
        :viewBox="showScene ? '0 0 120 120' : '8 5 104 106'"
        class="h-full w-full overflow-visible" :class="{ 'ui-sprite-idle': size !== 'sm' && !gameMotion }"
        role="img"
        aria-label="Avatar Cavaleiro das Sombras"
      >
        <defs>
          <radialGradient :id="auraId" cx="50%" cy="55%" r="50%">
            <stop offset="0%" :stop-color="auraHex" :stop-opacity="auraOpacity" />
            <stop offset="100%" stop-color="#09090B" stop-opacity="0" />
          </radialGradient>
        </defs>

        <template v-if="showScene">
          <use :href="`${murimMascotUrl}#scene`" :transform="murimArtworkTransform" />
        </template>

        <template v-if="hasEnhancedAura">
          <circle cx="60" cy="60" :r="haloRadius" :fill="`url(#${auraId})`" />
        </template>
        <template v-if="(activeTwoPiece || activeFourPiece || auraMultiplier >= 1.5)">
          <ellipse
            cx="60"
            cy="107"
            :rx="activeFourPiece ? 40 : 32"
            :ry="activeFourPiece ? 9 : 7"
            fill="none"
            :stroke="auraHex"
            :stroke-width="activeFourPiece || auraMultiplier >= 2.0 ? '1.6' : '1.1'"
            :stroke-dasharray="activeFourPiece ? undefined : '4 3'"
            opacity="0.68"
          />
        </template>

        <use v-if="gameMotion" :href="`${murimMascotUrl}#shadow`" :transform="murimArtworkTransform" />
        <g class="sprite-motion">
        <!-- CAPA (camada traseira) -->
        <g v-if="capeItem" class="sprite-cape">
          <g :key="capeItem.id" class="ui-preview-piece">
            <template v-if="capeItem.id === 'capa_monarca'">
                <path
                  d="M 42 52 Q 8 32 14 76 Q 27 72 40 84 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.9"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="2"
                />
                <path
                  d="M 78 52 Q 112 32 106 76 Q 93 72 80 84 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.9"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="2"
                />
                <path
                  d="M 38 50 L 24 98 Q 60 107 96 98 L 82 50 Z"
                  fill="#111113"
                  opacity="0.9"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="1.6"
                />
            </template>
            <template v-else-if="capeItem.id === 'capa_asa_carmesim'">
                <path
                  d="M 40 50 L 12 38 L 19 66 L 28 74 L 38 82 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.9"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="1.8"
                />
                <path
                  d="M 80 50 L 108 38 L 101 66 L 92 74 L 82 82 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.9"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="1.8"
                />
            </template>
            <template v-else-if="capeItem.id === 'capa_mercador_sombrio'">
                <path
                  d="M 36 48 L 16 98 Q 60 107 104 98 L 84 48 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.88"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="2.4"
                />
                <circle
                  cx="60"
                  cy="93"
                  r="4.5"
                  :fill="capeItem.secondaryHex"
                  opacity="0.92"
                />
            </template>
            <template v-else-if="capeItem.id === 'capa_sabio_astral'">
                <path
                  d="M 37 49 L 20 96 Q 60 104 100 96 L 83 49 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.88"
                  :stroke="capeItem.secondaryHex"
                  stroke-width="2"
                />
                <circle cx="29" cy="84" r="2.2" fill="#FB923C" />
                <circle cx="91" cy="84" r="2.2" fill="#FB923C" />
            </template>
            <template v-else>
                <path
                  d="M 38 50 L 22 96 Q 60 105 98 96 L 82 50 Z"
                  :fill="capeItem.accentHex"
                  opacity="0.88"
                  :stroke="capeItem.secondaryHex"
                  :stroke-width="capeItem.rarity === 'Lendário' || capeItem.rarity === 'Épico' ? '2.2' : '1.8'"
                />
                <template v-if="(capeItem.rarity === 'Épico' || capeItem.rarity === 'Lendário')">
                    <path
                      d="M 34 62 L 26 92"
                      fill="none"
                      :stroke="capeItem.secondaryHex"
                      stroke-width="1.4"
                      opacity="0.7"
                    />
                    <path
                      d="M 86 62 L 94 92"
                      fill="none"
                      :stroke="capeItem.secondaryHex"
                      stroke-width="1.4"
                      opacity="0.7"
                    />
                </template>
            </template>
          </g>
        </g>

        <g :transform="murimArtworkTransform">
          <use v-if="!gameMotion" :href="`${murimMascotUrl}#shadow`" />
          <use :href="`${murimMascotUrl}#qi`" />
          <use :href="`${murimMascotUrl}#body`" />
        </g>

        <!-- ARMADURA EQUIPADA -->
        <template v-if="armorItem">
          <g :key="armorItem.id" class="ui-preview-piece">
            <rect
              x="43"
              y="51"
              width="34"
              height="29"
              rx="8"
              :fill="armorItem.accentHex"
              :stroke="armorItem.secondaryHex"
              stroke-width="1.6"
            />
            <!-- Ombreiras -->
            <path
              :d="armorItem.id === 'armadura_couraca_rubra' || armorItem.id === 'armadura_monarca' || armorItem.rarity === 'Lendário' || armorItem.rarity === 'Épico' ? 'M 22 54 L 34 42 L 45 53 L 40 66 Q 27 66 22 54 Z' : 'M 27 56 Q 35 45 45 53 L 40 66 Q 30 66 27 56 Z'"
              :fill="armorItem.accentHex"
              :stroke="armorItem.secondaryHex"
              stroke-width="1.8"
            />
            <path
              :d="armorItem.id === 'armadura_couraca_rubra' || armorItem.id === 'armadura_monarca' || armorItem.rarity === 'Lendário' || armorItem.rarity === 'Épico' ? 'M 98 54 L 86 42 L 75 53 L 80 66 Q 93 66 98 54 Z' : 'M 93 56 Q 85 45 75 53 L 80 66 Q 90 66 93 56 Z'"
              :fill="armorItem.accentHex"
              :stroke="armorItem.secondaryHex"
              stroke-width="1.8"
            />
            <!-- Detalhes peitorais específicos -->
            <template v-if="armorItem.id === 'armadura_monarca'">
                <circle cx="60" cy="65" r="7.5" fill="#09090B" stroke="#FBBF24" stroke-width="2" />
                <polygon points="60,59 64.5,65 60,71 55.5,65" fill="#F97316" />
            </template>
            <template v-else-if="armorItem.id === 'armadura_manto_alquimista'">
                <circle cx="60" cy="65" r="6.5" fill="#27272A" stroke="#EAB308" stroke-width="2" />
                <circle cx="60" cy="65" r="3" fill="#FACC15" />
            </template>
            <template v-else-if="armorItem.id === 'armadura_couraca_rubra'">
                <path d="M 48 60 L 60 74 L 72 60" fill="none" :stroke="armorItem.secondaryHex" stroke-width="2.2" />
                <polygon points="60,61 65,67 60,73 55,67" fill="#FBBF24" />
            </template>
            <template v-else>
              <polygon
                points="60,59 68,68 60,77 52,68"
                :fill="armorItem.secondaryHex"
                stroke="#09090B"
                stroke-width="1.5"
              />
            </template>
          </g>
        </template>

        <g :transform="murimArtworkTransform">
          <use :href="`${murimMascotUrl}#belt`" />
          <template v-if="!armorItem"><use :href="`${murimMascotUrl}#shoulders`" /></template>
        </g>

        <!-- A arma e a mão giram juntas, usando o ombro do novo desenho como pivô. -->
        <g class="sprite-arm" style="transform-origin: 79px 58px; transform-box: view-box">
          <use :href="`${murimMascotUrl}#arm`" :transform="murimArtworkTransform" />

          <template v-if="isTrainingSword">
            <use
              :key="weaponId"
              :href="`${murimMascotUrl}#training-sword`"
              :transform="murimArtworkTransform"
              class="ui-preview-piece"
            />
          </template>
          <template v-else-if="weaponItem">
            <g :key="weaponId" class="ui-preview-piece" transform="translate(87 69.5) rotate(18)">
              <template v-if="usesPole">
                  <rect x="-2.8" y="-38" width="5.6" height="52" rx="2.5" :fill="weaponItem.accentHex" :stroke="weaponItem.secondaryHex" stroke-width="1.5" />
                  <template v-if="isStaff">
                      <circle cy="-44" r="7" fill="#7C3AED" :stroke="weaponItem.secondaryHex" stroke-width="2" />
                      <circle cy="-44" r="3" fill="#E0F2FE" />
                  </template>
                  <template v-else>
                    <path d="M0 -53 L6 -40 L0 -32 L-6 -40 Z" :fill="weaponItem.secondaryHex" stroke="#FFF1DB" stroke-width="1.5" stroke-linejoin="round" />
                  </template>
              </template>
              <template v-else>
                  <rect x="-3.8" y="-12" width="7.6" height="22" rx="2.4" fill="#27272A" :stroke="weaponItem.secondaryHex" stroke-width="1.5" />
                  <path :d="bladeOutline" :fill="weaponItem.accentHex" :stroke="weaponItem.secondaryHex" stroke-width="2" stroke-linejoin="round" />
                  <template v-if="weaponItem.id === 'arma_presas_monarca'">
                    <path d="M8 -38 Q15 -23 8 -11 H4 Z" fill="#17171C" stroke="#F59E0B" stroke-width="1.4" stroke-linejoin="round" />
                  </template>
                  <template v-if="weaponItem.iconName === 'Sparkles'"><path d="M0 -35 V-12" stroke="#FFF" stroke-width="1.6" /></template>
                  <rect x="-10.5" y="-10" width="21" height="5.5" rx="2.2" :fill="weaponItem.secondaryHex" stroke="#27272A" stroke-width="1.2" />
              </template>
            </g>
          </template>

          <use :href="`${murimMascotUrl}#hand`" :transform="murimArtworkTransform" />
        </g>

        <use :href="`${murimMascotUrl}#helmet`" :transform="murimArtworkTransform" />
        <!-- ELMO EQUIPADO -->
        <template v-if="helmItem && helmItem.id !== 'elmo_couro_novato'">
          <g :key="helmItem.id" class="ui-preview-piece" transform="translate(0 -3)">
            <template v-if="helmItem.id === 'elmo_mercador_vidente'">
                <path
                  d="M 34 29 Q 36 12 60 12 Q 84 12 86 29 Q 72 21 60 21 Q 48 21 34 29 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.6"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <!-- Monóculo dourado no olho direito -->
                <circle
                  cx="71"
                  cy="36"
                  r="7.5"
                  fill="rgba(234,179,8,0.18)"
                  stroke="#FACC15"
                  stroke-width="2"
                />
                <line x1="78" y1="39" x2="84" y2="48" stroke="#FACC15" stroke-width="1.4" />
            </template>
            <template v-else-if="helmItem.id === 'elmo_sabio_abissal'">
                <path
                  d="M 33 31 Q 36 11 60 11 Q 84 11 87 31 L 83 39 Q 60 25 37 39 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.58"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <polygon
                  points="60,3 65,15 60,22 55,15"
                  fill="#F97316"
                  stroke="#FED7AA"
                  stroke-width="1.4"
                />
            </template>
            <template v-else-if="helmItem.id === 'elmo_presa_carmesim'">
                <path
                  d="M 33 33 Q 35 12 60 12 Q 85 12 87 33 L 83 48 Q 60 54 37 48 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.64"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <path d="M 39 19 L 27 4 L 45 15 Z" fill="#FBBF24" stroke="#FEF08A" stroke-width="1.2" />
                <path d="M 81 19 L 93 4 L 75 15 Z" fill="#FBBF24" stroke="#FEF08A" stroke-width="1.2" />
                <path d="M 46 43 L 60 46 L 74 43" fill="none" stroke="#FEF08A" stroke-width="1.8" stroke-linecap="round" />
            </template>
            <template v-else-if="helmItem.id === 'elmo_monarca'">
                <path
                  d="M 35 23 L 41 6 L 52 17 L 60 3 L 68 17 L 79 6 L 85 23 Z"
                  :fill="helmItem.accentHex"
                  stroke="#FEF08A"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <circle cx="60" cy="14" r="3.2" fill="#F97316" stroke="#FEF08A" stroke-width="1" />
            </template>
            <template v-else-if="helmItem.iconName === 'Crown'">
                <path
                  d="M 34 27 L 39 9 L 51 18 L 60 5 L 69 18 L 81 9 L 86 27 Q 60 22 34 27 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.88"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <polygon points="60,11 64,17 60,22 56,17" :fill="helmItem.secondaryHex" />
            </template>
            <template v-else-if="helmItem.iconName === 'Flame'">
                <path
                  d="M 33 32 Q 35 12 60 12 Q 85 12 87 32 L 82 44 Q 60 30 38 44 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.72"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <path
                  d="M 42 18 L 32 4 L 49 14 M 78 18 L 88 4 L 71 14"
                  :fill="helmItem.secondaryHex"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="1.4"
                  stroke-linejoin="round"
                />
            </template>
            <template v-else-if="helmItem.iconName === 'Eye'">
                <path
                  d="M 33 27 Q 36 12 60 12 Q 84 12 87 27 Q 72 20 60 20 Q 48 20 33 27 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.75"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <rect
                  x="37"
                  y="30"
                  width="46"
                  height="11"
                  rx="5.5"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.28"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="1.8"
                />
            </template>
            <template v-else-if="helmItem.iconName === 'Sparkles' || helmItem.iconName === 'Ghost'">
                <path
                  d="M 32 28 Q 60 18 88 28 L 85 21 Q 60 11 35 21 Z"
                  :fill="helmItem.accentHex"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <circle cx="60" cy="14" r="4" :fill="helmItem.secondaryHex" />
                <path
                  d="M 28 24 Q 20 14 27 8 M 92 24 Q 100 14 93 8"
                  fill="none"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
            </template>
            <template v-else>
                <path
                  d="M 32 32 Q 35 10 60 10 Q 85 10 88 32 Q 73 21 60 21 Q 47 21 32 32 Z"
                  :fill="helmItem.accentHex"
                  fillOpacity="0.82"
                  :stroke="helmItem.secondaryHex"
                  stroke-width="2"
                />
                <polygon
                  points="60,12 64,18 60,24 56,18"
                  :fill="helmItem.secondaryHex"
                />
            </template>
          </g>
        </template>

        <g class="sprite-eyes">
        <g :transform="murimArtworkTransform">
          <template v-if="eyeColor">
              <circle cx="305" cy="166" r="17" :fill="eyeColor" />
              <circle cx="375" cy="166" r="17" :fill="eyeColor" />
              <circle cx="305" cy="166" r="8" fill="#FFD9A8" />
              <circle cx="375" cy="166" r="8" fill="#FFD9A8" />
          </template>
          <template v-else>
            <use :href="`${murimMascotUrl}#eyes`" />
          </template>
        </g>
        </g>
        </g>
        <path v-if="gameMotion && strike" class="sprite-slash" aria-hidden="true" d="M110 24 Q116 67 83 84 Q102 65 110 24Z" fill="#ffd092" />
      </svg>
  </div>
</template>
<style scoped>
.ui-sprite-idle { animation: idle 3s ease-in-out infinite; }
.ui-preview-piece { animation: piece-in .2s ease-out; }
.sprite-strike:not(.sprite-game) { animation: strike var(--swing-duration) ease-in-out; }
.sprite-strike .sprite-arm { animation: arm-strike var(--swing-duration) ease-in-out; }
.sprite-celebrate:not(.sprite-game) { animation: celebrate .58s ease-out; }
.sprite-game .sprite-motion {
  transform-box: view-box;
  transform-origin: 60px 101px;
  animation: breathe 2.2s ease-in-out 2;
}
.sprite-game.sprite-strike .sprite-motion { animation: strike var(--swing-duration) ease-in-out; }
.sprite-game.sprite-celebrate .sprite-motion { animation: celebrate .58s ease-out; }
.sprite-game .sprite-eyes { transform-box: fill-box; transform-origin: center; animation: blink 2.2s ease-in-out 2; }
.sprite-game .sprite-cape { transform-box: fill-box; transform-origin: center top; animation: sway 2.2s ease-in-out 2; }
.sprite-slash { opacity: 0; animation: slash var(--swing-duration) ease-out; }
@keyframes slash { 0%,39%,100% { opacity: 0; } 53% { opacity: .84; } }
@keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: translateY(-1.25px) scale(1.015); } }
@keyframes blink { 0%,74%,84%,100% { transform: scaleY(1); } 78%,80% { transform: scaleY(.15); } }
@keyframes sway { 0%,100% { transform: rotate(0); } 48% { transform: rotate(3deg); } }
@keyframes idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes piece-in { from { opacity: .45; } to { opacity: 1; } }
@keyframes strike { 0%,100% { transform: translateX(0) scale(1); } 20% { transform: translateX(-3px) scale(.99); } 53% { transform: translateX(10px) scale(1.045); } }
@keyframes arm-strike { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-11deg); } 53% { transform: rotate(31deg); } }
@keyframes celebrate { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-7px) scale(1.05); } }
@media (prefers-reduced-motion: reduce) {
  .ui-sprite-idle, .ui-preview-piece, .sprite-strike:not(.sprite-game), .sprite-strike .sprite-arm,
  .sprite-celebrate:not(.sprite-game), .sprite-game .sprite-eyes, .sprite-game .sprite-cape,
  .sprite-game .sprite-motion, .sprite-game.sprite-strike .sprite-motion,
  .sprite-game.sprite-celebrate .sprite-motion, .sprite-slash { animation: none; }
}
</style>
