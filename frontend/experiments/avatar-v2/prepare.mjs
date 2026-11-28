import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const exp=fileURLToPath(new URL('./',import.meta.url))
const frontend=fileURLToPath(new URL('../../',import.meta.url))
const arsenal=join(frontend,'components','arsenal.tsx')
const original=await readFile(arsenal,'utf8')
const imports="import { WarriorAvatar } from './warrior-avatar'"
const state="  const [attack, setAttack] = useState(0)"
const avatar='<WarriorAvatar cameraControls size={224} gear={shownGear} attack={attack} avatarStyle={preferences.style} appearances={preferences} />'
if(original.includes('AvatarGlbPreview')||!original.includes(imports)||!original.includes(state)||!original.includes(avatar))throw new Error('Arsenal alterado; revise o patch antes de prosseguir.')
const manifest=JSON.parse(await readFile(join(frontend,'package.json'),'utf8'))
if(!manifest.dependencies?.three||!manifest.dependencies?.['@react-three/fiber']||!manifest.devDependencies?.['@types/three'])throw new Error('Instale as dependências e atualize bun.lock antes de preparar.')
const dest=join(frontend,'public','assets','avatar-v2')
await mkdir(dest,{recursive:true})
const rig=process.env.AVATAR_LAB_RIG??'rigid'
if(!['rigid','skinned','blender'].includes(rig))throw new Error('Rig experimental inválido')
const source=rig==='blender'?join(exp,'blender-output'):rig==='skinned'?join(exp,'skinned'):exp
for(const name of ['murim.glb','cacador.glb'])await copyFile(join(source,name),join(dest,name))
await copyFile(join(exp,'avatar-glb-preview.tsx.in'),join(frontend,'components','avatar-glb-preview.tsx'))
const changed=original.replace(imports,imports+"\nimport dynamic from 'next/dynamic'\nconst AvatarGlbPreview = dynamic(() => import('./avatar-glb-preview').then(m => m.AvatarGlbPreview), { ssr: false })\nconst EMPTY_GLB_GEAR: never[] = []").replace(state,state+"\n  const [showGlb, setShowGlb] = useState(false)").replace(avatar,avatar+'\n          <Button variant="outlined" aria-expanded={showGlb} onClick={() => setShowGlb(value => !value)}>{showGlb ? "Fechar laboratório GLB" : "Abrir laboratório GLB"}</Button>\n          {showGlb && <AvatarGlbPreview preferences={preferences} gear={shownGear ?? EMPTY_GLB_GEAR} rank={rank} realm={realm} />}')
await writeFile(arsenal,changed)
console.log('Prévia experimental preparada no Arsenal.')
