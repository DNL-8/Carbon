import { getEquipmentArt } from './equipment-art'

export type AvatarStyle = 'auto' | 'murim' | 'cacador'
export type CharacterStyle = Exclude<AvatarStyle, 'auto'>
export const appearanceOptions = {
  hair: ['Coque', 'Curto', 'Longo', 'Raspado'],
  face: ['Suave', 'Marcante', 'Sério'],
  skin: ['Clara', 'Média', 'Morena', 'Escura'],
  hairColor: ['Preto', 'Castanho', 'Prateado', 'Ruivo'],
  energy: ['Padrão da trilha', 'Dourada', 'Azul', 'Violeta', 'Verde'],
} as const
export type AppearanceKey = keyof typeof appearanceOptions
export type AvatarAppearance = Record<AppearanceKey, number>
export type AvatarPreferences = { style: AvatarStyle; mixed: boolean; murim: AvatarAppearance; cacador: AvatarAppearance }
export const defaultAppearance: AvatarAppearance = { hair: 0, face: 0, skin: 1, hairColor: 0, energy: 0 }
export const defaultAvatarPreferences: AvatarPreferences = { style: 'auto', mixed: true, murim: defaultAppearance, cacador: {...defaultAppearance, hair: 1} }
const fields = ['hair', 'face', 'skin', 'hairColor', 'energy'] as const
export const skinColors = ['#f0c5a3', '#c99873', '#9b6848', '#694332'] as const
export const hairColors = ['#252028', '#69432d', '#bec4ce', '#a7442c'] as const
export function energyColor(style: CharacterStyle, appearance: AvatarAppearance): string {
  return [style === 'murim' ? '#fb923c' : '#60a5fa', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399'][appearance.energy] ?? '#fb923c'
}
export function decodeAvatarPreferences(code?: string): AvatarPreferences | undefined {
  if (!code || !/^c2:[012][01][0-9]{10}$/.test(code)) return undefined
  const digits = [...code.slice(3)].map(Number)
  function appearance(start: number): AvatarAppearance | undefined {
    const [hair, face, skin, hairColor, energy] = digits.slice(start, start+5)
    if (hair >= 4 || face >= 3 || skin >= 4 || hairColor >= 4 || energy >= 5) return undefined
    return { hair, face, skin, hairColor, energy }
  }
  const murim = appearance(2), cacador = appearance(7)
  if (!murim || !cacador) return undefined
  return { style: (['auto', 'murim', 'cacador'] as const)[digits[0]], mixed: digits[1] === 1, murim, cacador }
}
export function encodeAvatarPreferences(value: AvatarPreferences): string {
  return 'c2:' + ['auto', 'murim', 'cacador'].indexOf(value.style) + Number(value.mixed) +
    fields.map(key => value.murim[key]).join('') + fields.map(key => value.cacador[key]).join('')
}

export function resolveAvatarStyle(style: AvatarStyle, gear?: { id: string; slot: string; equipped: boolean }[]): 'murim' | 'cacador' {
  if (style !== 'auto') return style
  const head = gear?.find(item => item.equipped && item.slot === 'elmo')
  const body = gear?.find(item => item.equipped && item.slot === 'armadura')
  const helm = head && getEquipmentArt(head.id)
  const armor = body && getEquipmentArt(body.id)
  return helm?.track === 'reino_murim' || (!helm && armor?.track === 'reino_murim') ? 'murim' : 'cacador'
}

const key = (owner: string) => 'murim-avatar-v1:' + owner
export function loadAvatarPreferences(owner: string): AvatarPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(owner)) ?? 'null')
    if (typeof value === 'object' && value !== null && 'style' in value && 'mixed' in value &&
        (value.style === 'auto' || value.style === 'murim' || value.style === 'cacador') && typeof value.mixed === 'boolean') {
      return { ...defaultAvatarPreferences, style: value.style, mixed: value.mixed }
    }
  } catch { /* Private or unavailable storage: keep defaults. */ }
  return defaultAvatarPreferences
}
export function saveAvatarPreferences(owner: string, value: AvatarPreferences): boolean {
  try { localStorage.setItem(key(owner), JSON.stringify(value)); return true }
  catch { return false }
}
