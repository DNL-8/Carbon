import { getEquipmentArt } from './equipment-art'

export type AvatarStyle = 'auto' | 'murim' | 'cacador'
export type AvatarPreferences = { style: AvatarStyle; mixed: boolean }
export const defaultAvatarPreferences: AvatarPreferences = { style: 'auto', mixed: true }

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
      return { style: value.style, mixed: value.mixed }
    }
  } catch { /* Private or unavailable storage: keep defaults. */ }
  return defaultAvatarPreferences
}
export function saveAvatarPreferences(owner: string, value: AvatarPreferences): boolean {
  try { localStorage.setItem(key(owner), JSON.stringify(value)); return true }
  catch { return false }
}
