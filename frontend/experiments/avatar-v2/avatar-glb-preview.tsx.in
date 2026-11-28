'use client'

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, ButtonGroup } from '@mui/material'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { getEquipmentArt } from '../lib/equipment-art'
import { HUNTER_RANK_TIERS, MURIM_REALM_TIERS } from '../../src/utils/progressionCurves'
import { energyColor, hairColors, resolveAvatarStyle, skinColors, type AvatarPreferences } from '../lib/avatar-preferences'
import type { AvatarGear } from './warrior-avatar'

type Clip = 'idle' | 'attack' | 'victory' | 'rest' | 'guard' | 'dodge' | 'channel'
type AnimationRequest = { clip: Clip; sequence: number }
type Quality = 'auto'|'low'|'high'
type ResolvedQuality = 'low'|'high'
type Art = NonNullable<ReturnType<typeof getEquipmentArt>>
const slots = ['elmo', 'armadura', 'capa', 'arma'] as const

// Catalog-driven original procedural attachments; item-specific geometry and finish, not final hand-sculpted assets.
function makeAttachment(art: Art, slot: typeof slots[number]) {
  const group = new THREE.Group()
  const rigid = slot==='arma' || ['visor','lens','helm','horn','mask','crown','plate','exo'].includes(art.family)
  const main = new THREE.MeshStandardMaterial({ color: art.accent, roughness: rigid ? .30+art.detail%4*.045 : .85, metalness: rigid ? .62 : .05, side: THREE.DoubleSide })
  const trim = new THREE.MeshStandardMaterial({ color: art.trim, roughness: .42, metalness: .45, side: THREE.DoubleSide })
  const dark = new THREE.MeshStandardMaterial({ color: '#17191e', roughness: .8 })
  const glow = new THREE.MeshStandardMaterial({ color: art.trim, emissive: art.trim, emissiveIntensity: art.tier >= 4 ? .65 : .12 })
  const f = art.family
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x=0, y=0, z=0) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x,y,z); group.add(mesh); return mesh
  }
  const box = (w:number,h:number,d:number,m:THREE.Material,x=0,y=0,z=0) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z)
  const ring = (radius:number,tube:number,m:THREE.Material,x=0,y=0,z=0) => add(new THREE.TorusGeometry(radius,tube,6,24),m,x,y,z)
  const rod = (r1:number,r2:number,h:number,m:THREE.Material,x=0,y=0,z=0) => add(new THREE.CylinderGeometry(r1,r2,h,10),m,x,y,z)
  const ball = (r:number,m:THREE.Material,x=0,y=0,z=0) => add(new THREE.IcosahedronGeometry(r,1),m,x,y,z)
  function plate(points: [number,number][], depth:number,m:THREE.Material,x=0,y=0,z=0) {
    const shape=new THREE.Shape()
    points.forEach(([px,py],i)=>{ if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py) })
    shape.closePath()
    const bevel=Math.min(.003,depth*.16)
    const mesh=add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1}),m,x,y,z-depth/2)
    return mesh
  }
  // A five-bit relief motif encodes the 26 designs in each slot without changing their fit.
  // The motif is actual geometry: raised studs versus incised-looking dark rivets.
  const motif=(x:number,y:number,z:number,axis:'x'|'y',spacing:number,radius:number)=>{
    for(let bit=0;bit<5;bit++){
      const raised=(art.detail&(1<<bit))!==0
      const stud=ball(raised?radius:radius*.58,raised?trim:dark,x+(axis==='x'?(bit-2)*spacing:0),y+(axis==='y'?(bit-2)*spacing:0),z)
      stud.scale.z=raised?.75:.45
      stud.name='DetailBit'+bit+(raised?'Raised':'Recessed')
    }
  }
  // A narrow cape is curved away from the body rather than made of a flat slab.
  const drape=(side:number,w:number,h:number,offset:number)=>{
    const points:number[]=[],indices:number[]=[]
    const rows=10,columns=8
    for(let row=0;row<=rows;row++){
      const t=row/rows
      for(let col=0;col<=columns;col++){
        const u=col/columns
        const x=side*(offset+u*w*(1+.28*t))
        const z=-.055-.15*t-.025*Math.sin(u*Math.PI*3+art.detail*.17)*t
        points.push(x,-h*t*(1-.12*(1-u)),z)
      }
    }
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const a=row*(columns+1)+col,b=a+columns+1
      indices.push(a,b,a+1,a+1,b,b+1)
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals()
    const mesh=add(geometry,main)
    mesh.name='CarbonDrape'
    mesh.userData.restPositions=new Float32Array(points)
    return mesh
  }
  if(slot==='elmo'){
    if(f==='halo'){ring(.17,.012,glow,0,.03,-.12);ball(.022,trim,0,.20,-.12)}
    else if(f==='band'||f==='diadem'||f==='crown'){
      const circlet=ring(.11,.012,main,0,f==='band'?-.01:.055,0);circlet.rotation.x=Math.PI/2
      if(f==='band'){box(.05,.035,.017,trim,0,-.01,.105);for(const s of [-1,1])box(.022,.095,.012,main,s*.027,-.075,-.105)}
      else for(let i=-2;i<=2;i++)plate([[-.022,0],[.022,0],[0,f==='crown'?.075:.045]],.018,trim,i*.043,.055,.095-Math.abs(i)*.014)
    }else if(f==='visor'||f==='mask'||f==='lens'){
      const mask=f==='mask'
      box(.222,mask?.088:.039,.024,main,0,mask?-.077:-.032,.124)
      if(mask){box(.142,.018,.012,dark,0,-.092,.142)}
      else{box(.18,.016,.013,dark,0,-.032,.141);if(f==='lens'){ring(.029,.006,glow,.048,-.032,.154);ball(.019,glow,.048,-.032,.154).scale.z=.35}}
      for(const s of [-1,1])ball(.008,trim,s*.10,mask?-.075:-.032,.139)
    }else{
      const shell=add(new THREE.SphereGeometry(.138,16,12,0,Math.PI*2,0,Math.PI*.55),main,0,.027,-.006)
      shell.scale.set(1,1.12,1.04)
      box(.19,.026,.025,trim,0,.012,.125)
      for(const s of [-1,1]){const cheek=box(.044,.112,.058,main,s*.106,-.077,.008);cheek.rotation.z=-s*.08;box(.022,.075,.025,trim,s*.121,-.079,.036)}
      if(f==='horn')for(const s of [-1,1]){const horn=add(new THREE.ConeGeometry(.033,.12,8),trim,s*.105,.11,0);horn.rotation.z=-s*.5}
    }
    if(f==='halo')motif(0,.19,-.12,'x',.014,.005)
    else if(f==='band'||f==='diadem'||f==='crown')motif(0,f==='band'?-.01:.055,.12,'x',.016,.005)
    else motif(0,f==='mask'?-.105:f==='visor'||f==='lens'?-.012:.012,.147,'x',.023,.005)
  } else if(slot==='armadura'){
    const heavy=f==='plate'||f==='exo'
    const plateWidth=heavy ? .15+art.detail%5*.004 : .12
    const chest=add(new THREE.CylinderGeometry(heavy?.25:.22,.17,.35,10),main,0,.19,0)
    chest.scale.z=.62
    for(const s of [-1,1]){
      if(heavy){const shoulder=ball(f==='exo'?.095:.08,trim,s*.24,.33,0);shoulder.scale.set(1,.7,1.15)}
      else{const lapel=box(.045,.29,.025,trim,s*.07,.21,.135);lapel.rotation.z=s*.42}
      if(f==='robe'||f==='coat')plate([[-.065,0],[.065,0],[.10,-.36],[-.055,-.33]],.018,main,s*.09,0,.13)
      if(f==='vest')box(.065,.07,.035,trim,s*.10,.12,.14)
    }
    box(.27,.045,.24,dark,0,0,0);box(.075,.052,.024,trim,0,0,.132)
    if(heavy){
      plate([[-plateWidth,.08],[0,.13],[plateWidth,.08],[.10,-.11],[0,-.15],[-.10,-.11]],.03,trim,0,.19,.15)
      for(const s of [-1,1]){plate([[0,0],[s*.055,.035],[s*.06,-.06],[0,-.08]],.012,main,s*.12,.22,.155);if(f==='exo')box(.026,.11,.033,glow,s*.205,.22,.075)}
    } else if(f==='tunic')box(.14,.026,.025,trim,0,.09,.145)
    motif(0,.044,.155,'x',.025,.006)
  }else if(slot==='capa'){
    for(const s of [-1,1]){
      if(f==='wings'){
        plate([[0,0],[s*.40,.12],[s*.36,-.24],[s*.10,-.36],[0,-.18]],.025,main,s*.04,-.02,-.05)
        for(let j=0;j<3;j++){const feather=box(.018,.19+j*.035,.02,trim,s*(.15+j*.068),-.14+j*.025,-.079);feather.rotation.z=-s*(.30+j*.12)}
      }
      else {
        const narrow=f==='banner'||f==='ribbon'
        const split=f==='split'||f==='coatTail'||f==='ribbon'
        const w=narrow?.10:.23,h=f==='veil'?.48:.65
        drape(s,w,h,split?.035:0)
        const border=box(.012,h*.83,.014,trim,s*(w*1.1+(split?.035:0)),-h*.43,-.135);border.rotation.x=.22
      }
    }
    box(.17,.035,.035,trim,0,.004,-.055)
    motif(0,.003,-.079,'x',.025,.005)
  }else{
    const long=['wood','spear','staff'].includes(f),short=f==='dagger'||f==='twin'
    rod(.019,.019,long?1.40:.27,dark,0,long?.16:0)
    rod(.023,.023,.15,trim)
    if(f==='wood')rod(.022,.025,.9,main,0,.43)
    else if(f==='spear')plate([[-.065,.77],[0,1.10],[.065,.77],[0,.70]],.026,main)
    else if(f==='staff')ball(.07,glow,0,.93)
    else if(f==='hammer'){box(.26,.17,.13,main,0,.43);for(const s of [-1,1])box(.038,.18,.144,trim,s*.11,.43,0)}
    else if(f==='fan'){
      plate([[0,.08],[-.20,.35],[-.12,.44],[.12,.44],[.20,.35]],.025,main)
      for(let i=-3;i<=3;i++){const rib=box(.008,.30,.012,trim,i*.025,.26,.018);rib.rotation.z=-i*.16}
    }
    else{
      const len=(short?.43:.87)+(art.detail%5-2)*.012,bend=f==='sabre'?.10:0
      box(.20,.04,.045,trim,0,.16)
      plate([[-.048,.19],[.048,.19],[bend+.04,len-.09],[bend,len],[bend-.04,len-.09]],.035,f==='spirit'?glow:main)
      plate([[-.008,.22],[.008,.22],[bend,len-.05]],.008,glow,0,0,.022)
    }
    motif(0,-.025,.025,'y',.022,.004)
    if(f==='twin')group.userData.dual=true
    group.rotation.z=-.30
  }
  for(let i=0;i<1+art.detail%3;i++){
    if(slot==='armadura')box(.012,.035,.009,glow,(i-art.detail%3/2)*.026,.12,.17)
    if(slot==='arma')rod(.025,.025,.012,trim,0,-.08+i*.04)
  }
  // Release materials not used by this family as well.
  const used=new Set<THREE.Material>()
  group.traverse(node=>{if(node instanceof THREE.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])used.add(material)})
  for(const material of [main,trim,dark,glow])if(!used.has(material))material.dispose()
  return group
}

function disposeAttachment(group: THREE.Object3D) {
  const materials=new Set<THREE.Material>()
  group.traverse(node=>{
    if(node instanceof THREE.Mesh){node.geometry.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material])materials.add(mat)}
  })
  for(const material of materials)material.dispose()
}

function Scene({style,preferences,gear,animation,paused,yaw,zoom,quality,stage,onLoaded,onContextLost}: {
  style: 'murim'|'cacador'; preferences: AvatarPreferences; gear: AvatarGear[]; animation: AnimationRequest; paused:boolean; yaw:number; zoom:boolean; quality:ResolvedQuality; stage:number; onLoaded:()=>void; onContextLost:()=>void
}) {
  const gltf=useLoader(GLTFLoader,'/assets/avatar-v2/'+style+'.glb')
  const {camera,invalidate,gl}=useThree()
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();onContextLost()}
    const canvas=gl.domElement
    canvas.addEventListener('webglcontextlost',lost)
    return ()=>canvas.removeEventListener('webglcontextlost',lost)
  },[gl,onContextLost])
  const scene=useMemo(()=>cloneSkeleton(gltf.scene),[gltf.scene])
  useEffect(()=>{
    const descendants=new Set<THREE.Object3D>()
    scene.traverse(node=>descendants.add(node))
    let skins=0
    scene.traverse(node=>{
      if(node instanceof THREE.SkinnedMesh){
        skins++
        if(!node.skeleton.bones.every(bone=>descendants.has(bone)))throw new Error('Esqueleto GLB fora da instância do avatar')
      }
    })
    gl.domElement.dataset.glbSkins=String(skins)
    invalidate()
  },[scene,gl,invalidate])
  const mixer=useMemo(()=>new THREE.AnimationMixer(scene),[scene])
  const drapes=useRef<THREE.Mesh[]>([])
  const effects=useRef<THREE.Group|null>(null)
  const hairMotion=useRef<{node:THREE.Object3D;rotation:THREE.Quaternion}[]>([])
  const baseMeshes=useMemo(()=>{const nodes:THREE.Mesh[]=[];scene.traverse(node=>{if(node instanceof THREE.Mesh)nodes.push(node)});return nodes},[scene])
  const appearance=preferences[style]
  const helmet=gear.find(item=>item.equipped&&item.slot==='elmo')
  const helmetArt=helmet?getEquipmentArt(helmet.id):null
  const coveredHair=Boolean(helmetArt&&['hood','helm','horn'].includes(helmetArt.family))
  useEffect(()=>{
    const clones=new Map<THREE.Material,THREE.Material>()
    for(const node of baseMeshes){
      const clone=(m:THREE.Material)=>{
        const copy=clones.get(m)??m.clone();clones.set(m,copy)
        if(copy instanceof THREE.MeshStandardMaterial){
          if(m.name==='Skin')copy.color.set(skinColors[appearance.skin])
          if(m.name==='Hair')copy.color.set(hairColors[appearance.hairColor])
          if(m.name==='Energy'){const color=energyColor(style,appearance);copy.color.set(color);copy.emissive.set(color)}
        }
        return copy
      }
      node.userData.originalMaterial=node.material
      node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material)
    }
    invalidate()
    return ()=>{for(const node of baseMeshes){if(node.userData.originalMaterial){node.material=node.userData.originalMaterial;delete node.userData.originalMaterial}}for(const m of clones.values())m.dispose()}
  },[baseMeshes,appearance,style,invalidate])
  useEffect(()=>{
    const head=scene.getObjectByName('Head')
    if(!head)return
    const changed:{node:THREE.Object3D;scale:THREE.Vector3;visible:boolean}[]=[]
    const defaultHair=style==='murim'?0:1
    const hairPattern=/^Mesh_(Hair|Fringe|Topknot|Ponytail)/
    scene.traverse(node=>{
      if(!(node instanceof THREE.Mesh))return
      const isHair=hairPattern.test(node.name)
      const isFace=/^Mesh_(HeadMesh|Ear|EyeWhite|Iris|EyeGlint|Brow|UpperLid|LowerLid|Nose|Mouth)/.test(node.name)
      if(!isHair&&!isFace)return
      changed.push({node,scale:node.scale.clone(),visible:node.visible})
      if(isHair)node.visible=!coveredHair&&appearance.hair===defaultHair
      if(isFace)node.scale.x*= [1,.94,1.04][appearance.face]??1
      if(node.name.startsWith('Mesh_Brow'))node.scale.y*= [1,1.08,.95][appearance.face]??1
    })
    const custom=new THREE.Group();custom.name='AvatarCustomHair'
    if(!coveredHair&&appearance.hair!==3&&appearance.hair!==defaultHair){
      const material=new THREE.MeshStandardMaterial({color:hairColors[appearance.hairColor],roughness:.85})
      const add=(size:[number,number,number],pos:[number,number,number])=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),material);m.scale.set(...size);m.position.set(...pos);custom.add(m);return m}
      // Attach to a rest-space socket rather than the bone axes, which Blender may reorient.
      const anchor=scene.getObjectByName('slot_elmo')
      if(anchor){
        add([.108,.078,.105],[0,.035,-.018]);
        if(appearance.hair===0){add([.050,.053,.049],[0,.115,-.055]);add([.030,.13,.032],[0,-.025,-.125])}
        if(appearance.hair===1){for(let i=-2;i<=2;i++){const tuft=add([.037,.047,.042],[i*.038,.066,-.010]);tuft.rotation.z=-i*.18}}
        if(appearance.hair===2){for(const side of [-1,1]){const lock=add([.035,.156,.047],[side*.088,-.080,-.058]);lock.rotation.z=side*.13}add([.083,.19,.039],[0,-.105,-.109])}
        anchor.add(custom)
      }else material.dispose()
    }
    hairMotion.current=changed.filter(entry=>/^Mesh_(Ponytail|HairLockTail)/.test(entry.node.name)).map(entry=>({node:entry.node,rotation:entry.node.quaternion.clone()}))
    gl.domElement.dataset.glbAppearance=[appearance.hair,appearance.face,appearance.skin,appearance.hairColor,appearance.energy].join('')
    gl.domElement.dataset.glbHairCovered=String(coveredHair)
    invalidate()
    return ()=>{for(const entry of hairMotion.current)entry.node.quaternion.copy(entry.rotation);hairMotion.current=[];custom.removeFromParent();disposeAttachment(custom);for(const entry of changed){entry.node.scale.copy(entry.scale);entry.node.visible=entry.visible}}
  },[scene,appearance,style,coveredHair,gl,invalidate])
  useEffect(()=>{
    const attached: {parent:THREE.Object3D; object:THREE.Object3D; children:{node:THREE.Object3D;visible:boolean}[]}[]=[]
    const ids: string[] = []
    const designs: string[] = []
    const capeMeshes: THREE.Mesh[] = []
    for(const slot of slots){
      const socket=scene.getObjectByName('slot_'+slot)
      if(!socket)throw new Error('Socket GLB ausente: '+slot)
      const originals=socket.children.filter(node=>node.name!=='AvatarCustomHair').map(node=>({node,visible:node.visible}))
      for(const entry of originals)entry.node.visible=false
      const selected=gear.find(item=>item.equipped&&item.slot===slot)
      const art=selected?getEquipmentArt(selected.id):null
      const group=art?makeAttachment(art,slot):new THREE.Group()
      if(slot==='elmo'&&art){
        group.position.y=['band','diadem','crown','halo'].includes(art.family)?0:-.035
        // Hair coverage is handled by the appearance effect.
      }
      if(selected&&art&&group.children.length>0){
        ids.push(selected.id)
        const bits=group.children.filter(node=>node.name.startsWith('DetailBit')).map(node=>node.name.endsWith('Raised')?'1':'0').reverse().join('')
        const bounds=new THREE.Box3().setFromObject(group)
        if(bits.length!==5 || ![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new Error('Geometria de equipamento inválida: '+selected.id)
        designs.push(slot+':'+bits)
      }
      if(slot==='capa')group.traverse(node=>{if(node instanceof THREE.Mesh&&node.name==='CarbonDrape')capeMeshes.push(node)})
      socket.add(group);attached.push({parent:socket,object:group,children:originals})
      if(group.userData.dual){
        const left=scene.getObjectByName('HandL')??scene.getObjectByName('Hand.L')
        if(left&&art){const second=makeAttachment(art,slot);second.position.set(-.035,-.026,.02);second.rotation.z=.30;left.add(second);attached.push({parent:left,object:second,children:[]})}
      }
    }
    gl.domElement.dataset.glbCharacter=style
    gl.domElement.dataset.glbEquipment=ids.sort().join(',')
    drapes.current=capeMeshes
    gl.domElement.dataset.glbDrapes=String(capeMeshes.length)
    gl.domElement.dataset.glbDesign=designs.sort().join(',')
    invalidate()
    return ()=>{drapes.current=[];for(const entry of attached){entry.parent.remove(entry.object);disposeAttachment(entry.object);for(const child of entry.children)child.node.visible=child.visible}}
  },[scene,gear,invalidate,gl,style])
  useEffect(()=>{
    const group=new THREE.Group();group.name='CarbonEnergyEffects'
    const color=energyColor(style,appearance)
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending})
    const count=quality==='low'?1:Math.min(4,1+Math.floor(stage/2))
    for(let i=0;i<count;i++){
      const geometry=style==='murim'?new THREE.TorusGeometry(.25+i*.055,.004,6,32):new THREE.TorusGeometry(.25+i*.055,.004,4,6)
      const ring=new THREE.Mesh(geometry,material);ring.rotation.x=Math.PI/2;ring.position.y=.14+i*.016;group.add(ring)
    }
    group.visible=true;scene.add(group);effects.current=group
    gl.domElement.dataset.glbEnergy=style==='murim'?'qi':'mana'
    gl.domElement.dataset.glbStage=String(stage);gl.domElement.dataset.glbQuality=quality
    gl.domElement.dataset.glbEnergyRings=String(count)
    invalidate()
    return ()=>{effects.current=null;group.removeFromParent();disposeAttachment(group)}
  },[scene,style,appearance,stage,quality,gl,invalidate])
  useEffect(()=>{
    const clip=animation.clip
    const selected=gltf.animations.find(item=>item.name===clip)
    if(!selected)return
    const action=mixer.clipAction(selected)
    action.reset().setLoop(clip==='idle'||clip==='rest'?THREE.LoopRepeat:THREE.LoopOnce,clip==='idle'||clip==='rest'?Infinity:1)
    action.clampWhenFinished=true;action.play();gl.domElement.dataset.glbAnimation=clip;gl.domElement.dataset.glbSequence=String(animation.sequence);gl.domElement.dataset.glbTime='0';invalidate()
    return ()=>{action.stop();mixer.uncacheAction(selected)}
  },[gltf.animations,mixer,animation,invalidate,gl])
  useEffect(()=>{
    camera.position.set(0,zoom?1.58:1.02,zoom?1.25:3.85)
    camera.lookAt(0,zoom?1.58:.95,0)
    camera.updateMatrixWorld();gl.domElement.dataset.glbZoom=String(zoom);invalidate()
  },[camera,zoom,invalidate,gl])
  useEffect(()=>{scene.rotation.y=yaw;gl.domElement.dataset.glbYaw=String(yaw);invalidate()},[scene,yaw,invalidate,gl])
  useEffect(()=>{onLoaded()},[onLoaded])
  useEffect(()=>{mixer.timeScale=paused?0:1;invalidate()},[paused,mixer,invalidate])
  useEffect(()=>{const resume=()=>{if(!document.hidden)invalidate()};document.addEventListener('visibilitychange',resume);return ()=>document.removeEventListener('visibilitychange',resume)},[invalidate])
  useFrame((_,dt)=>{
    if(paused||document.hidden)return
    const clip=gltf.animations.find(item=>item.name===animation.clip)
    const action=clip?mixer.existingAction(clip):null
    if(!action?.isRunning())return
    mixer.update(Math.min(dt,.05))
    const time=action.time
    const active=animation.clip==='attack'||animation.clip==='dodge'||animation.clip==='channel'||animation.clip==='victory'
    const strength=active?.065:.018
    // Bounded, outward-only secondary motion; zero at collar, no physics solver.
    for(const mesh of drapes.current){
      const position=mesh.geometry.getAttribute('position')
      const rest=mesh.userData.restPositions as Float32Array
      for(let i=0;i<position.count;i++){
        const y=rest[i*3+1],weight=Math.min(1,Math.abs(y)/.65)
        position.setZ(i,rest[i*3+2]-strength*weight*weight*(.5+.5*Math.sin(time*5+i%9*.45)))
      }
      position.needsUpdate=true
      if(quality==='high')mesh.geometry.computeVertexNormals()
    }
    for(const entry of hairMotion.current){entry.node.quaternion.copy(entry.rotation);entry.node.rotateX(-strength*(.5+.5*Math.sin(time*5)))}
    const group=effects.current
    if(group){
      const power=active?1.2+.18*Math.sin(time*8):1
      group.scale.set(power,1,power);group.rotation.y=time*(style==='murim'?.65:1.3)
      gl.domElement.dataset.glbEffectScale=String(power)
    }
    gl.domElement.dataset.glbTime=String(time)
    if(action.isRunning())invalidate()
  })
  return <primitive object={scene} dispose={null} />
}

class PreviewBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<Alert severity="warning">Prévia GLB indisponível. O avatar original permanece acima.</Alert>:this.props.children}
}

export function AvatarGlbPreview({preferences,gear,rank,realm}: {preferences:AvatarPreferences;gear:AvatarGear[];rank?:string;realm?:string}){
  const [animation,setAnimation]=useState<AnimationRequest>({clip:'idle',sequence:0})
  const [paused,setPaused]=useState(false)
  const [reduced,setReduced]=useState(false)
  const [yaw,setYaw]=useState(0)
  const [zoom,setZoom]=useState(false)
  const [loaded,setLoaded]=useState<'murim'|'cacador'|null>(null)
  const [hideHelmet,setHideHelmet]=useState(false)
  const [quality,setQuality]=useState<Quality>('auto')
  const [smallScreen,setSmallScreen]=useState(false)
  const [contextFailed,setContextFailed]=useState(false)
  const loseContext=useCallback(()=>{setContextFailed(true);setLoaded(null)},[])
  const style=resolveAvatarStyle(preferences.style,gear)
  const markLoaded=useCallback(()=>setLoaded(style),[style])
  const stage=Math.max(0,style==='murim'?MURIM_REALM_TIERS.findIndex(tier=>tier.name===realm||tier.id===realm):HUNTER_RANK_TIERS.findIndex(tier=>tier.rank===rank))
  const resolvedQuality:ResolvedQuality=quality==='auto'?(smallScreen||reduced?'low':'high'):quality
  const visibleGear=useMemo(()=>hideHelmet?gear.filter(item=>item.slot!=='elmo'):gear,[gear,hideHelmet])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync=()=>setReduced(media.matches)
    const viewport=window.matchMedia('(max-width: 767px)')
    const syncViewport=()=>setSmallScreen(viewport.matches)
    sync();syncViewport();media.addEventListener('change',sync);viewport.addEventListener('change',syncViewport)
    return ()=>{media.removeEventListener('change',sync);viewport.removeEventListener('change',syncViewport)}
  },[])
  const play=(next:Clip)=>setAnimation(value=>({clip:next,sequence:value.sequence+1}))
  return <section aria-label="Laboratório Avatar V2" className="surface inset" style={{width:'100%',padding:12}}>
    <p><strong>Prévia GLB experimental</strong></p>
    <p className="muted">Modelos articulados e encaixes protótipos. O avatar original continua oficial; não altera inventário.</p>
    <div style={{height:320,width:'100%',background:'#111113',borderRadius:8,overflow:'hidden'}}>
      {contextFailed?<Alert severity="warning" action={<Button color="inherit" onClick={()=>setContextFailed(false)}>Tentar novamente</Button>}>Contexto 3D indisponível. Use o avatar original.</Alert>:<PreviewBoundary key={style}>
        <Canvas frameloop="demand" dpr={resolvedQuality==='low'?1:[1,1.5]} camera={{position:[0,1.02,3.85],fov:34,near:.01,far:20}} fallback={<p role="status">WebGL indisponível. Use o avatar original.</p>}>
          <color attach="background" args={['#111113']}/>
          <ambientLight intensity={1.10}/>
          <hemisphereLight args={['#dbeafe','#211713',.65]}/>
          <directionalLight position={[3,5,4]} intensity={2.1}/>
          <directionalLight position={[-3,2,-3]} intensity={1.4} color={style==='murim'?'#fb923c':'#60a5fa'}/>
          <Suspense fallback={null}>
            <Scene key={style} style={style} preferences={preferences} gear={visibleGear} animation={animation} paused={paused||reduced} yaw={yaw} zoom={zoom} quality={resolvedQuality} stage={stage} onLoaded={markLoaded} onContextLost={loseContext}/>
          </Suspense>
        </Canvas>
      </PreviewBoundary>}
    </div>
    <p role="status">{contextFailed?'Prévia indisponível':loaded===style?'Prévia carregada (experimental)':'Carregando prévia GLB…'}</p>
    <label style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>Qualidade gráfica <select aria-label="Qualidade gráfica" value={quality} onChange={event=>{const value=event.target.value;setQuality(value==='low'||value==='high'?value:'auto')}} style={{minHeight:44,color:'inherit',background:'#18181b'}}><option value="auto">Automática</option><option value="low">Econômica</option><option value="high">Detalhada</option></select></label>
    <div className="row" style={{flexWrap:'wrap',gap:8}} aria-label="Controles do avatar" role="group">
      <ButtonGroup variant="outlined" size="small" aria-label="Câmera experimental" sx={{flexWrap:"wrap","& .MuiButton-root":{minHeight:44}}}>
        <Button aria-label="Girar GLB à esquerda" onClick={()=>setYaw(v=>v-Math.PI/4)}>Esquerda</Button>
        <Button aria-label="Girar GLB à direita" onClick={()=>setYaw(v=>v+Math.PI/4)}>Direita</Button>
        <Button onClick={()=>{setYaw(0);setZoom(false)}}>Restaurar</Button>
      </ButtonGroup>
      <Button size="small" sx={{minHeight:44}} variant="outlined" aria-pressed={zoom} onClick={()=>setZoom(v=>!v)}>{zoom?'Corpo inteiro':'Rosto'}</Button>
      <Button size="small" sx={{minHeight:44}} variant="outlined" aria-pressed={hideHelmet} onClick={()=>setHideHelmet(v=>!v)}>{hideHelmet?'Exibir elmo':'Ocultar elmo'}</Button>
      <Button size="small" sx={{minHeight:44}} variant="outlined" aria-pressed={paused||reduced} disabled={reduced} onClick={()=>setPaused(v=>!v)}>{paused?'Animar':'Pausar'}</Button>
      {([['idle','Repouso'],['attack','Ataque'],['victory','Vitória'],['rest','Descanso'],['guard','Defesa'],['dodge','Esquiva'],['channel',style==='murim'?'Canalizar Qi':'Canalizar mana']] as const).map(([name,label])=><Button key={name} variant="outlined" size="small" sx={{minHeight:44}} disabled={reduced} aria-pressed={animation.clip===name} onClick={()=>play(name)}>{label}</Button>)}
    </div>
  </section>
}
