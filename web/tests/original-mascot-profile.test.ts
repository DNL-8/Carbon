import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, test } from 'vitest'
import OriginalMascot from '../app/components/OriginalMascot.vue'
import { DEFAULT_EQUIPPED_GEAR } from '../../src/utils/rpgLogic'
import { profileSchema } from '../shared/training'

test('original mascot reflects actual equipped weapon and helmet without replacing SVG geometry', async () => {
  const avatar = await mountSuspended(OriginalMascot, { props: { size: '2xl', equippedGear: DEFAULT_EQUIPPED_GEAR } })
  try {
    expect(avatar.get('svg').element.getAttribute('viewBox')).toBe('0 0 120 120')
    expect(avatar.find('use[href="/assets/mascote-murim.svg#scene"]').exists()).toBe(true)
    await avatar.setProps({ equippedGear: { ...DEFAULT_EQUIPPED_GEAR, elmo: 'elmo_presa_carmesim', arma: 'arma_cajado_abissal' } })
    expect(avatar.find('circle[fill="#FDA4AF"]').exists()).toBe(true)
    expect(avatar.find('circle[fill="#E0F2FE"]').exists()).toBe(true)
  } finally { avatar.unmount() }
})

test('profile preserves optional biometric values and validates heart rate ordering', () => {
  const profile = { name: 'Herói', heroClass: 'Guerreiro', objective: 'Ambos', experience: 'Iniciante' }
  expect(profileSchema.parse(profile)).toEqual(profile)
  expect(profileSchema.parse({ ...profile, heightCm: 180, weightKg: 85 }).weightKg).toBe(85)
  expect(profileSchema.safeParse({ ...profile, restingHrBaseline: 120, maxHrEstimated: 120 }).success).toBe(false)
  expect(profileSchema.safeParse({ ...profile, heightCm: 80 }).success).toBe(false)
})
