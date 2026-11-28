import { avatarTransforms, equipmentShapes, getEquipmentArt } from '../lib/equipment-art'

type Art = NonNullable<ReturnType<typeof getEquipmentArt>>

/** Render the same shape family as the catalog, fitted to the existing mascot rig. */
export function AvatarEquipmentLayer({ id, art, slot }: { id: string; art: Art; slot: string }) {
  const [body, inset, engraving] = equipmentShapes[art.family]
  return <g data-avatar-item={id} data-avatar-slot={slot} data-avatar-family={art.family}
    transform={avatarTransforms[art.family]} strokeLinejoin="round" strokeLinecap="round">
    <path d={body} fill={art.accent} fillRule="evenodd" stroke="#09090b" strokeWidth="3" />
    <path d={body} fill="none" stroke={art.trim} strokeWidth={art.rarity === 'lendario' ? 1.8 : 1.1} opacity=".85" />
    {art.family !== 'halo' && <path d={inset} fill={art.trim} stroke="#09090b" strokeWidth="1.6" opacity=".82" />}
    <path d={engraving} stroke="#fafafa" strokeWidth="1.5" opacity=".8" fill="none"
      strokeDasharray={art.detail ? (2 + art.detail % 5) + ' ' + (1 + Math.floor(art.detail / 5)) : undefined} />
  </g>
}
