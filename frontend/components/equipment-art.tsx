import { memo } from 'react'
import { equipmentShapes, getEquipmentArt } from '../lib/equipment-art'

export const EquipmentArt = memo(function EquipmentArt({ id, compact = false }: { id: string; compact?: boolean }) {
  const art = getEquipmentArt(id)
  if (!art) return null
  const [body, inset, engraving] = equipmentShapes[art.family]
  const advanced = art.rarity === 'epico' || art.rarity === 'lendario'
  return <svg className={compact ? 'equipment-art equipment-art-compact' : 'equipment-art'} data-equipment-art={id} data-family={art.family} viewBox="0 0 112 112" aria-hidden="true" focusable="false">
    <rect width="112" height="112" rx="8" fill="var(--inset)" />
    <circle cx="56" cy="56" r="43" fill={art.accent} opacity=".16" />
    <circle cx="56" cy="56" r="42" fill="none" stroke={art.trim} opacity=".22" />
    {advanced && <circle cx="56" cy="56" r="48" fill="none" stroke={art.trim} strokeDasharray="3 7" opacity=".48" />}
    <g transform="translate(8 8)" strokeLinejoin="round" strokeLinecap="round">
      <path d={body} fill={art.accent} fillRule="evenodd" stroke="#09090b" strokeWidth="4" />
      <path d={body} fill="none" stroke={art.trim} strokeWidth="1.2" opacity=".85" />
      <path d={inset} fill={art.trim} stroke="#09090b" strokeWidth="2" opacity=".88" />
      <path d={engraving} stroke="#fafafa" strokeWidth="1.7" opacity=".65" fill="none" />
    </g>
    <g fill={art.trim} opacity=".9">
      {Array.from({ length: 5 }, (_, index) => <rect key={index} x={39 + index * 7} y="105" width="4" height="3" rx="1" opacity={(art.detail >> index) & 1 ? 1 : .16} />)}
    </g>
    {art.track === 'reino_murim' ? <path d="M10 10 14 5 18 10 14 15Z" fill={art.trim} /> : art.track === 'rank_cacador' ? <path d="M10 6H18V14H10Z" fill={art.trim} /> : null}
  </svg>
})
