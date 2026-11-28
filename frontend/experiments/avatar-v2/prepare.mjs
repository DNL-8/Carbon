import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const exp=fileURLToPath(new URL('./',import.meta.url))
const frontend=fileURLToPath(new URL('../../',import.meta.url))
const arsenal=join(frontend,'components','arsenal.tsx')
const original=await readFile(arsenal,'utf8')
const imports="import { WarriorAvatar } from './warrior-avatar'"
const state="  const [attack, setAttack] = useState(0)"
const settings="              <Button variant=\"outlined\" onClick={() => { closeAvatarControls(); onSettings() }}>Personalizar personagem</Button>"
const cameraEnd="            </div>} />"
if(original.includes('AvatarGlbPreview')||!original.includes(imports)||!original.includes(state)||!original.includes(settings)||!original.includes(cameraEnd))throw new Error('Arsenal alterado; revise o patch antes de prosseguir.')
const manifest=JSON.parse(await readFile(join(frontend,'package.json'),'utf8'))
if(!manifest.dependencies?.three||!manifest.dependencies?.['@react-three/fiber']||!manifest.devDependencies?.['@types/three'])throw new Error('Instale as dependências e atualize bun.lock antes de preparar.')
const dest=join(frontend,'public','assets','avatar-v2')
await mkdir(dest,{recursive:true})
const rig=process.env.AVATAR_LAB_RIG??'rigid'
if(!['rigid','skinned','blender'].includes(rig))throw new Error('Rig experimental inválido')
const source=rig==='blender'?join(exp,'blender-output'):rig==='skinned'?join(exp,'skinned'):exp
for(const name of ['murim.glb','cacador.glb'])await copyFile(join(source,name),join(dest,name))
await copyFile(join(exp,'avatar-glb-preview.tsx.in'),join(frontend,'components','avatar-glb-preview.tsx'))
const changed=original.replace(imports,imports+"\nimport dynamic from 'next/dynamic'\nconst AvatarGlbPreview = dynamic(() => import('./avatar-glb-preview').then(m => m.AvatarGlbPreview), { ssr: false })\nconst EMPTY_GLB_GEAR: never[] = []").replace(state,state+"\n  const [showGlb, setShowGlb] = useState(false)").replace(settings,"              <Button variant=\"outlined\" aria-expanded={showGlb} onClick={() => { closeAvatarControls(); setShowGlb(value => !value) }}>{showGlb ? \"Fechar laboratório GLB\" : \"Abrir laboratório GLB\"}</Button>\n"+settings).replace(cameraEnd,cameraEnd+"\n          {showGlb && <AvatarGlbPreview preferences={preferences} gear={shownGear ?? EMPTY_GLB_GEAR} rank={rank} realm={realm} />}")
await writeFile(arsenal,changed)
console.log('Prévia experimental preparada com engrenagem aprovada no Arsenal.')

const murim=join(frontend,'components','murim.tsx')
let dashboard=await readFile(murim,'utf8')
function replaceExact(text,before,after){
  if(!text.includes(before))throw new Error('Fonte alterada: '+before.slice(0,90))
  return text.replace(before,after)
}
dashboard=replaceExact(dashboard,"const loadingModule = () => <p role=\"status\">Carregando módulo…</p>","const loadingModule = () => <p role=\"status\">Carregando módulo…</p>\nconst AvatarGlbPreview = dynamic(() => import('./avatar-glb-preview').then(module => module.AvatarGlbPreview), { ssr: false })\nconst EMPTY_AVATAR_GEAR: never[] = []")
dashboard=replaceExact(dashboard,"  const [avatarSettings, setAvatarSettings] = useState(false)","  const [avatarSettings, setAvatarSettings] = useState(false)\n  const [showHeroGlb, setShowHeroGlb] = useState(false)")
dashboard=replaceExact(dashboard,"setAvatarSettings(false); setAvatarError('') }, [owner])","setAvatarSettings(false); setShowHeroGlb(false); setAvatarError('') }, [owner])")
dashboard=replaceExact(dashboard,"          {(progress.isError || dashboard.isError)","          <section className=\"surface overview\" aria-label=\"Visualização 3D do herói\">\n            <div className=\"between\"><h2>Personagem</h2><Button variant=\"outlined\" aria-expanded={showHeroGlb} onClick={() => setShowHeroGlb(value => !value)}>{showHeroGlb ? 'Ocultar Avatar V2' : 'Exibir Avatar V2'}</Button></div>\n            {showHeroGlb && <AvatarGlbPreview compact preferences={avatarPreferences} gear={gear.data ?? EMPTY_AVATAR_GEAR} rank={metrics?.rank} realm={metrics?.realm} />}\n          </section>\n          {(progress.isError || dashboard.isError)")
dashboard=replaceExact(dashboard,"<Training owner={owner} avatarStyle","<Training owner={owner} rank={metrics?.rank} realm={metrics?.realm} avatarStyle")
await writeFile(murim,dashboard)

const training=join(frontend,'components','training.tsx')
let session=await readFile(training,'utf8')
session=replaceExact(session,"import { useEffect, useRef, useState } from 'react'","import { useEffect, useMemo, useRef, useState } from 'react'\nimport dynamic from 'next/dynamic'")
session=replaceExact(session,"import type { AvatarStyle, AvatarPreferences } from '../lib/avatar-preferences'","import { defaultAvatarPreferences, type AvatarStyle, type AvatarPreferences } from '../lib/avatar-preferences'")
session=replaceExact(session,"export function Training({ owner, workout, draft, bonus, level, hp, gear, avatarStyle, appearances, onFinish, onCancel }: {","const AvatarGlbPreview = dynamic(() => import('./avatar-glb-preview').then(module => module.AvatarGlbPreview), { ssr: false })\nconst EMPTY_AVATAR_GEAR: never[] = []\n\nexport function Training({ owner, workout, draft, bonus, level, hp, gear, avatarStyle, appearances, rank, realm, onFinish, onCancel }: {")
session=replaceExact(session,"appearances?: AvatarPreferences; onFinish:","appearances?: AvatarPreferences; rank?: string; realm?: string; onFinish:")
session=replaceExact(session,"  const [attack, setAttack] = useState(0)","  const [attack, setAttack] = useState(0)\n  const [showTrainingGlb, setShowTrainingGlb] = useState(false)")
const combatLine=session.split('\n').find(line=>/^  const combat = /.test(line))
if(!combatLine)throw new Error('Combate da sessão não localizado')
session=replaceExact(session,combatLine,combatLine+"\n  const bossDefeated = combat.state.bossDefeated\n  const activity = useMemo(() => ({ clip: bossDefeated ? 'victory' as const : attack > 0 ? 'attack' as const : paused ? 'rest' as const : 'idle' as const, sequence: attack }), [bossDefeated, attack, paused])")
session=replaceExact(session,"        <div className=\"timer mono\">","        <Button variant=\"outlined\" aria-expanded={showTrainingGlb} onClick={() => setShowTrainingGlb(value => !value)}>{showTrainingGlb ? 'Ocultar Avatar V2' : 'Exibir Avatar V2'}</Button>\n        {showTrainingGlb && <AvatarGlbPreview compact preferences={appearances ?? defaultAvatarPreferences} gear={gear ?? EMPTY_AVATAR_GEAR} rank={rank} realm={realm} activity={activity} />}\n        <div className=\"timer mono\">")
await writeFile(training,session)
console.log('Prévia compacta preparada no Início, Painel e sessão.')
