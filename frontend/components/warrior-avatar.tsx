'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { EQUIPMENT_CATALOG } from '../../src/utils/equipmentCatalog'
import { getEquipmentArt } from '../lib/equipment-art'
import { AvatarEquipmentLayer } from './avatar-equipment-layer'
import { WarriorAvatar3D } from './warrior-avatar-3d'
import { resolveAvatarStyle, defaultAvatarPreferences, energyColor, skinColors, hairColors, type AvatarStyle, type AvatarPreferences } from '../lib/avatar-preferences'

export type AvatarGear = { id: string; name: string; slot: string; rarity: string; equipped: boolean }
type Props = { avatarStyle?: AvatarStyle; appearances?: AvatarPreferences; size?: number; level?: number; hp?: number; gear?: AvatarGear[]; attack?: number; victory?: boolean; milestone?: boolean; resting?: boolean }
const rarityColors: Record<string, string> = { comum: '#a1a1aa', common: '#a1a1aa', incomum: '#34d399', uncommon: '#34d399', raro: '#60a5fa', rare: '#60a5fa', épico: '#c084fc', epico: '#c084fc', epic: '#c084fc', lendário: '#fbbf24', lendario: '#fbbf24', legendary: '#fbbf24' }
const catalog = new Map(EQUIPMENT_CATALOG.map(item => [item.id, item]))

export function WarriorAvatar({ avatarStyle = 'auto', appearances = defaultAvatarPreferences, size = 88, level, hp, gear, attack = 0, victory = false, milestone = false, resting = false }: Props) {
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [pulse, setPulse] = useState(0)
  const [paused, setPaused] = useState(false)
  const [levelUp, setLevelUp] = useState(0)
  const previousLevel = useRef(level)
  useEffect(() => {
    if (level !== undefined && previousLevel.current !== undefined && level > previousLevel.current) setLevelUp(value => value + 1)
    if (level !== undefined) previousLevel.current = level
  }, [level])
  const equipped = gear?.filter(item => item.equipped) ?? []
  const equipment = (slot: string) => equipped.find(item => item.slot === slot)
  const tint = (slot: string, fallback: string) => {
    const item = equipment(slot)
    return item ? catalog.get(item.id)?.accentHex ?? rarityColors[item.rarity.toLowerCase()] ?? '#fb923c' : fallback
  }
  const trim = (slot: string) => catalog.get(equipment(slot)?.id ?? '')?.secondaryHex ?? '#fb923c'
  const helm = equipment('elmo')
  const armor = equipment('armadura')
  const cape = equipment('capa')
  const weapon = equipment('arma')
  const helmArt = getEquipmentArt(helm?.id ?? '')
  const armorArt = getEquipmentArt(armor?.id ?? '')
  const capeArt = getEquipmentArt(cape?.id ?? '')
  const weaponArt = getEquipmentArt(weapon?.id ?? '')
  const style = resolveAvatarStyle(avatarStyle, gear)
  const appearance = appearances[style]
  const energy = energyColor(style, appearance)
  const skin = skinColors[appearance.skin]
  const hair = hairColors[appearance.hairColor]
  const openFace = (style === 'murim' || appearances !== defaultAvatarPreferences) && (!helmArt || ['band', 'diadem', 'crown', 'halo'].includes(helmArt.family))
  const lowHp = hp !== undefined && hp <= 30
  function follow(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    setLook({ x: Math.max(-4, Math.min(4, (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 8)), y: Math.max(-3, Math.min(3, (event.clientY - bounds.top - bounds.height / 2) / bounds.height * 6)) })
  }
  return <div className="warrior-avatar" data-character={style} data-appearance={Object.values(appearance).join('')} data-paused={paused} data-resting={resting} data-hp={lowHp ? 'low' : 'normal'} data-victory={victory} data-attack={attack} data-level-up={Boolean(levelUp || milestone)} data-equipment={equipped.map(item => item.id).sort().join(',')}>
    <button type="button" className="warrior-avatar-trigger" aria-label="Interagir com guerreiro" onPointerMove={follow} onPointerLeave={() => setLook({ x: 0, y: 0 })} onClick={() => setPulse(value => value + 1)}>
      <span style={{ position: 'relative', display: 'block', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
        <rect width="256" height="256" rx="40" fill="#111113"/>
<circle cx="128" cy="122" r="99" fill="#241a15"/><circle cx="128" cy="122" r="90" fill="#18181b" stroke="#704522" strokeWidth="2"/>
<path d="M17 195 58 151 91 178 129 147 171 175 205 145 239 195V223H17Z" fill="#242126"/>
<ellipse cx="128" cy="230" rx="77" ry="7" fill="#09090b"/>

        <g key={'aura-' + levelUp + '-' + milestone + '-' + victory + '-' + pulse} className={'warrior-aura' + (victory || milestone || levelUp || pulse ? ' warrior-aura-active' : '')}><circle cx="128" cy="122" r="98" fill="none" stroke={victory ? '#34d399' : '#fb923c'} strokeWidth="5" opacity=".65"/></g>
        <g className="warrior-body" key={'body-' + pulse}>
          {cape && capeArt ? <AvatarEquipmentLayer id={cape.id} art={capeArt} slot="capa" /> : cape && <path d="M94 134 63 158 54 218 128 204 202 218 193 158 162 134Z" fill={tint('capa', '#71717a')} stroke="#09090b" strokeWidth="4" opacity=".8"/>}
          {(!gear || equipment('arma')) && <g className={attack > 0 ? 'warrior-sword warrior-strike' : 'warrior-sword'} key={'sword-' + attack}>
            {weapon && weaponArt ? <AvatarEquipmentLayer id={weapon.id} art={weaponArt} slot="arma" /> : <>
            <path d="m187 173 31-107 10-13 1 18-29 105z" fill={tint("arma", "#fdba74")} stroke="#09090b" strokeWidth="5" strokeLinejoin="round"/><path d="m195 169 28-100" stroke={trim('arma')} strokeWidth="4"/>
<path d="m178 165 32 10m-16-3-8 24" stroke="#09090b" strokeWidth="12" strokeLinecap="round"/><path d="m178 165 32 10" stroke="#fb923c" strokeWidth="6" strokeLinecap="round"/>
            </>}
          </g>}
          <path d="M87 82C62 70 44 83 29 110l25-8-8 23c25-10 41-21 51-35Z" fill="#c76025" stroke="#09090b" strokeWidth="4" strokeLinejoin="round"/><path d="M80 88c-14 1-25 6-32 14" fill="none" stroke="#fdba74" strokeWidth="3" strokeLinecap="round"/>
<path d="M95 182h66l10 30-21 8-22-12-22 12-21-8z" fill="#27272a" stroke="#09090b" strokeWidth="5" strokeLinejoin="round"/>
<path d="M94 207h28v18H87l-3-5zm40 0h28l10 13-3 5h-35z" fill="#52525b" stroke="#09090b" strokeWidth="4" strokeLinejoin="round"/><path d="M94 213h19m30 0h19" stroke="#fb923c" strokeWidth="3" strokeLinecap="round"/>
<path d="M88 137 71 146 64 172 79 187 97 166m71-29 17 9 13 24-10 20-22-24" fill="#3f3f46" stroke="#09090b" strokeWidth="5" strokeLinejoin="round"/>
<path d="M76 140 94 128 109 139 104 155 76 163 68 151zM180 140l-18-12-15 11 5 16 28 8 8-12z" fill="#71717a" stroke="#09090b" strokeWidth="4" strokeLinejoin="round"/><path d="m77 150 17-9m85 9-17-9" stroke="#fdba74" strokeWidth="3" strokeLinecap="round"/>
{armor && armorArt ? <AvatarEquipmentLayer id={armor.id} art={armorArt} slot="armadura" /> : <>
<path d="M99 131h58l15 27-11 42H95l-11-42z" fill={tint("armadura", "#3f3f46")} stroke="#09090b" strokeWidth="5" strokeLinejoin="round"/><path d="M100 141 128 152l28-11 6 18-9 27h-50l-9-27z" fill="#18181b" stroke={equipment('armadura') ? trim('armadura') : '#71717a'} strokeWidth={equipment('armadura') ? 4 : 2}/>
<path d="m128 155 13 13-13 13-13-13z" fill="#fb923c"/><path d="m128 161 7 7-7 7-7-7z" fill="#fff1d6"/>
          </>}
<path d="M96 188h64v13H96z" fill="#b95724" stroke="#09090b" strokeWidth="3"/><path d="m128 189 10 6-10 9-10-9z" fill="#fdba74" stroke="#512817" strokeWidth="2"/><path d="m126 201-10 14m14-14 12 13" stroke="#fb923c" strokeWidth="5" strokeLinecap="round"/>
<circle cx="79" cy="181" r="12" fill="#52525b" stroke="#09090b" strokeWidth="4"/><circle cx="186" cy="182" r="12" fill="#52525b" stroke="#09090b" strokeWidth="4"/>

          <g className="warrior-qi"><circle cx="50" cy="165" r="21" fill={energy} opacity=".14"/><circle cx="50" cy="165" r="15" fill={energy} opacity=".28"/><circle cx="50" cy="165" r="10" fill={energy}/><circle cx="50" cy="165" r="5" fill="#fff1d6"/><path d="M50 141v7m-24 17h7m17 17v7m17-24h7" stroke="#fdba74" strokeWidth="2" strokeLinecap="round"/>
</g>
          {helm && helmArt?.family === 'halo' && <AvatarEquipmentLayer id={helm.id} art={helmArt} slot="elmo" />}
          <path d="M117 43v-9q0-9 11-9t11 9v9" fill="#52525b" stroke="#09090b" strokeWidth="4"/><path d="M118 34h20" stroke="#fb923c" strokeWidth="3" strokeLinecap="round"/>
<path d="M77 60 92 45h72l15 15 7 30-9 38-21 16h-56l-21-16-9-38z" fill={tint("elmo", "#52525b")} stroke="#09090b" strokeWidth="6" strokeLinejoin="round"/>
<path d="M91 52h74l12 16-49-6-49 6z" fill="#71717a"/>
<path d="M77 67q51-9 102 0l3 16q-54-9-108 0z" fill={trim('elmo')} stroke="#09090b" strokeWidth="3" strokeLinejoin="round"/><path d="m117 70 11-8 11 8-11 8z" fill="#fff1d6" stroke="#b95724" strokeWidth="2"/>
<path d="M84 85q44-7 88 0l3 18-10 20q-37 13-74 0l-10-20z" fill="#09090b" stroke="#a1a1aa" strokeWidth="2.5" strokeLinejoin="round"/>

          {openFace && <g><path d={appearance.hair === 0 ? "M81 76Q78 47 111 43Q112 22 128 23Q146 23 147 43Q179 47 176 76L167 91 89 91Z" : appearance.hair === 2 ? "M79 72Q77 43 128 43Q179 43 179 72L184 145 157 135 99 135 72 145Z" : "M81 76Q78 43 128 43Q178 43 175 76L167 91 89 91Z"} fill={appearance.hair === 3 ? skin : hair}/><path d={appearance.face === 1 ? "M87 82Q128 69 169 82L170 116 151 139 105 139 86 116Z" : "M87 82Q128 69 169 82L167 116 151 136 105 136 89 116Z"} fill={skin} stroke="#09090b" strokeWidth="3"/></g>}
          {helm && helmArt && helmArt.family !== 'halo' && <AvatarEquipmentLayer id={helm.id} art={helmArt} slot="elmo" />}
          <g transform={paused ? undefined : 'translate(' + look.x + ' ' + look.y + ')'}><g className="warrior-eyes"><path d="m95 97 21 3-3 10H99zM161 97l-21 3 3 10h14z" fill={lowHp ? '#f87171' : openFace ? '#252028' : energy}/><path d="m99 101 12 1-1 4H101zm58 0-12 1 1 4h9z" fill="#fff1d6"/></g></g>
          <path d="M117 117h22" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
<path d="m88 127 13 10h54l13-10-12 5h-56z" fill="#71717a"/><path d="M74 91h-5v17l8 4m105-21h5v17l-8 4" fill="#3f3f46" stroke="#09090b" strokeWidth="3" strokeLinejoin="round"/>
        </g>
      </svg>
      <WarriorAvatar3D avatarStyle={avatarStyle} appearances={appearances} size={size} gear={gear} look={look} paused={paused} pulse={pulse} attack={attack} levelUp={levelUp} victory={victory} milestone={milestone} resting={resting} lowHp={lowHp} />
      </span>
    </button>
    <button className="warrior-motion" type="button" aria-label="Pausar animações do guerreiro" aria-pressed={paused} onClick={() => {setPaused(value => !value); setLook({x: 0, y: 0})}}>{paused ? '▶' : 'Ⅱ'}</button>
    <span className="warrior-sr" role="status">{pulse > 0 ? 'Energia Qi ativada.' : ''}{lowHp ? ' HP baixo.' : ''}{victory ? ' Chefe derrotado.' : ''}{levelUp > 0 || milestone ? ' Novo nível alcançado.' : ''}</span>
  </div>
}
