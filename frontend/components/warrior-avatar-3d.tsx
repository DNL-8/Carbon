'use client'

import { useEffect, useRef, useState } from 'react'
import { getEquipmentArt, type EquipmentFamily } from '../lib/equipment-art'
import type { AvatarGear } from './warrior-avatar'

type V = [number, number, number]
type Color = V
type Transform = (v: V) => V
type Art = NonNullable<ReturnType<typeof getEquipmentArt>>
type Props = {
  size: number; gear?: AvatarGear[]; look: { x: number; y: number }
  paused: boolean; pulse: number; attack: number; levelUp: number
  victory: boolean; milestone: boolean; resting: boolean; lowHp: boolean
}
const I: Transform = v => v
const plus = (a: V, b: V): V => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
const sub = (a: V, b: V): V => [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
const cross = (a: V,b: V): V => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const dot = (a: V,b: V) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
function pose(parent: Transform, origin: V, rx=0, ry=0, rz=0): Transform {
  const cx=Math.cos(rx), sx=Math.sin(rx), cy=Math.cos(ry), sy=Math.sin(ry), cz=Math.cos(rz), sz=Math.sin(rz)
  return ([x,y,z]) => {
    const a=y*cx-z*sx, b=y*sx+z*cx, c=x*cy+b*sy, d=-x*sy+b*cy
    return parent(plus([c*cz-a*sz,c*sz+a*cz,d],origin))
  }
}
function color(hex: string): Color {
  const n=/^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1),16) : 0x71717a
  return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]
}
const skin=color('#c99873'), hair=color('#252028')
const dark=color('#24242b'), steel=color('#565963'), black=color('#101116'), gold=color('#fb923c'), light=color('#fff1d6')
const TAU=Math.PI*2

/** Low-poly solid geometry; all attachments are in the coordinate system of their joint. */
class Mesh {
  data: number[] = []
  constructor(private camera: Transform) {}
  tri(t: Transform, a: V,b: V,c: V, tint: Color, glow=0) {
    const p=this.camera(t(a)), q=this.camera(t(b)), r=this.camera(t(c))
    const normal=cross(sub(q,p),sub(r,p)), len=Math.hypot(...normal)
    if(len<1e-8) return
    // Two-sided surfaces, useful for cloth panels; diffuse key + fill.
    const facing=normal[2]<0?-1:1
    const shade=Math.min(1.25,.48+.47*Math.max(0,facing*dot(normal,[-.38,.65,.66])/len)+.23*Math.abs(normal[2])/len+glow)
    for(const v of [p,q,r]) this.data.push(v[0]/2.23,v[1]/2.23,-v[2]/5, ...tint.map(k=>Math.min(1,k*shade)))
  }
  prism(t: Transform, outline: [number,number][], depth: number, tint: Color, glow=0) {
    const front=outline.map(([x,y]):V=>[x,y,depth/2])
    const back=outline.map(([x,y]):V=>[x,y,-depth/2])
    for(let i=1;i<outline.length-1;i++){
      this.tri(t,front[0],front[i],front[i+1],tint,glow)
      this.tri(t,back[0],back[i+1],back[i],tint,glow)
    }
    for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length
      this.tri(t,front[i],back[i],back[j],tint,glow)
      this.tri(t,front[i],back[j],front[j],tint,glow)
    }
  }
  box(t: Transform, center: V, size: V, tint: Color, bevel=.08, glow=0) {
    const [x,y,z]=size.map(n=>n/2) as V
    const b=Math.min(bevel,x*.45,y*.45)
    this.prism(pose(t,center),[[-x+b,-y],[x-b,-y],[x,-y+b],[x,y-b],[x-b,y],[-x+b,y],[-x,y-b],[-x,-y+b]],z*2,tint,glow)
  }
  ringBody(t: Transform, center: V, rings: [number,number,number][], tint: Color, segments=12, glow=0) {
    const p=pose(t,center)
    const at=(row: [number,number,number], i: number): V=>[row[1]*Math.cos(i*TAU/segments),row[0],row[2]*Math.sin(i*TAU/segments)]
    for(let j=0;j<rings.length-1;j++) for(let i=0;i<segments;i++){
      const a=at(rings[j],i),b=at(rings[j],i+1),c=at(rings[j+1],i+1),d=at(rings[j+1],i)
      this.tri(p,a,b,c,tint,glow);this.tri(p,a,c,d,tint,glow)
    }
  }
  orb(t: Transform, center: V, r: V, tint: Color, glow=0) {
    this.ringBody(t,center,[[-r[1],0,0],[-r[1]*.55,r[0]*.82,r[2]*.82],[0,r[0],r[2]],[r[1]*.55,r[0]*.82,r[2]*.82],[r[1],0,0]],tint,10,glow)
  }
  rod(t: Transform, center: V, radius: number, length: number, tint: Color) {
    this.ringBody(t,center,[[-length/2,0,0],[-length/2,radius,radius],[length/2,radius,radius],[length/2,0,0]],tint,8)
  }
  hoop(t: Transform, center: V, radius: number, width: number, tint: Color) {
    const p=pose(t,center)
    for(let i=0;i<20;i++){
      const a=i*TAU/20,b=(i+1)*TAU/20
      const v=(r:number,k:number):V=>[r*Math.cos(k),r*Math.sin(k),0]
      this.tri(p,v(radius,a),v(radius,b),v(radius-width,b),tint,.3)
      this.tri(p,v(radius,a),v(radius-width,b),v(radius-width,a),tint,.3)
    }
  }
}
function palette(art: Art | null, fallback: Color=steel): [Color,Color] {
  return art ? [color(art.accent),color(art.trim)] : [fallback,gold]
}
function helmet(m: Mesh, t: Transform, art: Art | null) {
  const [a,b]=palette(art), f=art?.family ?? 'helm'
  if(f==='halo'){
    m.hoop(t,[0,.02,-.40],.73,.065,a)
    for(let i=0;i<4;i++) m.orb(t,[.72*Math.cos(i*TAU/4),.72*Math.sin(i*TAU/4),-.40],[.08,.08,.07],b,.2)
    return
  }
  if(f==='hood'||f==='helm'||f==='horn'){
    m.ringBody(t,[0,0,-.01],[[-.36,.42,.33],[-.20,.55,.43],[.26,.56,.45],[.46,.42,.35],[.50,0,0]],a)
    m.box(t,[0,.13,.43],[.92,.16,.12],b,.05)
    // Recessed face inset remains in front of the shell.
    m.box(t,[0,-.07,.45],[.79,.30,.12],black,.1)
    if(f==='horn') for(const sign of [-1,1]){
      const horn=pose(t,[sign*.44,.30,-.02],0,0,-sign*.55)
      m.ringBody(horn,[0,0,0],[[0,.15,.14],[.22,.10,.10],[.52,0,0]],b,7)
    }
  } else if(f==='band') {
    m.ringBody(t,[0,0,0],[[.15,.54,.44],[.29,.54,.44]],a)
    m.box(t,[0,.22,.45],[.25,.16,.07],b)
    // The martial headband has a rear knot and two short fabric tails.
    m.orb(t,[0,.20,-.46],[.11,.09,.08],b)
    for(const side of [-1,1])m.box(pose(t,[side*.08,.09,-.48],.15,0,side*.40),[0,-.10,0],[.10,.27,.045],a,.025)
  } else if(f==='diadem'||f==='crown'){
    m.ringBody(t,[0,0,0],[[.29,.52,.43],[.42,.52,.43]],a)
    for(let i=-2;i<=2;i++){
      const x=i*.20, h=f==='crown'?.26:.18
      m.prism(pose(t,[x,.39,.39-Math.abs(x)*.26]),[[-.10,0],[.10,0],[0,h*(1-Math.abs(i)*.18)]],.09,b)
    }
  } else if(f==='visor'||f==='mask'||f==='lens'){
    m.box(t,[0,-.02,.44],[.92,f==='mask'?.51:.27,.13],a,.13)
    m.box(t,[0,.01,.52],[.74,.15,.04],black,.05)
    if(f==='lens') m.orb(t,[.25,.01,.59],[.14,.12,.07],b,.15)
  }
  if(art && f!=='halo') {
    const emblem=f==='visor'||f==='mask'||f==='lens'? [.0,.15,.53] as V : [0,.28,.48] as V
    m.orb(t,emblem,[.055,.055,.035],b,art.tier>=4?.15:0)
  }
}
function armor(m: Mesh,t: Transform,art: Art | null) {
  const [a,b]=palette(art), f=art?.family??'plate'
  const heavy=f==='plate'||f==='exo'
  m.ringBody(t,[0,0,0],[[-.39,.37,.24],[-.25,.43,.29],[.26,heavy?.51:.43,.31],[.34,.35,.25]],a,10)
  if(heavy){
    m.prism(pose(t,[0,.04,.32]),[[-.31,.18],[0,.29],[.31,.18],[.24,-.17],[0,-.28],[-.24,-.17]],.12,b)
    m.orb(t,[0,.04,.42],[.12,.12,.08],b,.12)
    if(f==='exo')for(const side of [-1,1])m.box(t,[side*.28,.10,.30],[.10,.26,.12],b,.035)
  }else{
    for(const sign of [-1,1]) m.box(pose(t,[sign*.09,.06,.31],0,0,sign*.55),[0,0,0],[.13,.64,.065],b,.03)
    if(f==='vest') for(const sign of [-1,1]) m.box(t,[sign*.21,-.15,.33],[.19,.17,.08],b)
    if(f==='robe'||f==='coat') for(const sign of [-1,1]) {
      // Flaps hang in front of the thighs instead of wrapping through the legs.
      const flap=pose(t,[sign*.22,-.39,.31],.08,0,sign*.10)
      m.box(flap,[0,-.15,0],[.32,.35,.065],a)
      m.box(flap,[0,-.29,.045],[.30,.045,.025],b,.01)
    }
  }
  m.box(t,[0,-.36,.025],[.82,.14,.62],black)
  m.box(t,[0,-.36,.35],[.20,.16,.09],b)
  // Distinct variants use the catalogue detail index as an engraving pattern.
  if(art)for(let i=0;i<1+art.detail%3;i++){
    const x=(i-(art.detail%3)/2)*.105
    m.box(t,[x,-.20,.32],[.035,.075,.025],b,.008)
  }
}
function cape(m: Mesh,t: Transform,art: Art,wave:number) {
  const [a,b]=palette(art), f=art.family
  // The shoulder socket sits behind the thickest part of the breastplate.
  // Positive pitch carries the cloth away from the back rather than into it.
  const joint=pose(t,[0,.25,-.38],.23+wave*.50)
  if(f==='wings'){
    for(const s of [-1,1]){
      const wing=pose(joint,[s*.28,0,0],0,s*.28+wave*.25,s*.16)
      m.prism(wing,[[0,.10],[s*.88,.34],[s*.66,-.20],[s*.34,-.65],[0,-.27]],.08,a)
      m.prism(pose(wing,[0,0,.05]),[[0,.02],[s*.65,.22],[s*.30,-.33]],.025,b)
    }
    return
  }
  const narrow=f==='banner'||f==='ribbon'
  for(const s of [-1,1]){
    const top=narrow?.20:.36, bottom=narrow?.30:art.track==='reino_murim'?.67:.57
    const divided=f==='split'||f==='coatTail'||f==='ribbon'
    const panel=pose(joint,[s*(divided?.13:0),0,0],.12+wave*.30,0,s*.025)
    const bottomY=f==='veil'?-1.06:art.track==='reino_murim'?-1.27:-1.08
    const gap=divided?.10:0
    m.prism(panel,[[0,0],[s*top,.02],[s*bottom,bottomY],[s*gap,bottomY+.08]],.055,a)
    m.prism(pose(panel,[0,0,.032]),[[s*.05,-.10],[s*.11,-.10],[s*(bottom-.08),bottomY+.09],[s*(bottom-.15),bottomY+.09]],.012,b)
  }
}
function weapon(m: Mesh,t: Transform,art: Art | null, family?: EquipmentFamily) {
  const [a,b]=palette(art,gold), f=family??art?.family??'sword'
  // All grips are centered on the hand origin; tips point up local Y.
  const long=f==='staff'||f==='spear'||f==='wood'
  const short=f==='dagger'||f==='twin'
  // Grip stays centered in the glove for every family; long poles extend both ways.
  const qi=art?.track==='reino_murim'&&art.tier>=4
  const mana=art?.track==='rank_cacador'&&art.tier>=4
  const energy=(qi||mana) ? .20 : 0
  m.rod(t,[0,long?.21:0,0],long?.067:.075,long?1.55:.36,black)
  if(art)for(let i=0;i<1+art.detail%3;i++)m.rod(t,[0,-.10+i*.08,0],.079,.027,b)
  m.rod(t,[0,-.17,0],.093,.08,b)
  if(f==='wood'){m.rod(t,[0,.55,0],.075,1.08,a);return}
  if(f==='staff'||f==='spear'){
    if(f==='staff') m.orb(t,[0,1.03,0],[.18,.21,.15],a,.12)
    else {
      // Jin-style spear: a balanced shaft, collar and faceted spearhead.
      m.prism(t,[[-.15,.92],[0,1.44],[.15,.92],[0,.80]],.10,a,energy)
      m.prism(pose(t,[0,0,.056]),[[0,.84],[.055,.95],[0,1.37]],.014,b,energy)
      if(qi){m.orb(t,[0,.84,0],[.115,.075,.115],b,.28);m.rod(t,[0,.69,0],.082,.16,b)}
    }
    m.rod(t,[0,.91,0],.11,.14,b);return
  }
  if(f==='hammer'){
    m.box(t,[0,.60,0],[.60,.36,.33],a)
    for(const s of [-1,1]) m.box(t,[s*.30,.60,0],[.09,.38,.36],b);return
  }
  if(f==='fan'){
    m.prism(t,[[0,.10],[-.45,.53],[-.30,.70],[0,.78],[.30,.70],[.45,.53]],.08,a)
    for(let i=-2;i<=2;i++) m.box(pose(t,[0,.14,.06],0,0,-i*.24),[0,.25,0],[.026,.49,.035],b,.006)
    return
  }
  const length=short?.62:1.24, w=short?.11:.13, bend=f==='sabre'?.18:0
  m.box(t,[0,.19,0],[.40,.095,.18],b,.035)
  m.prism(t,[[-w,.23],[w,.23],[w+bend*.55,length-.13],[bend,length],[-w+bend*.55,length-.13]],.10,a,f==='spirit'?.32:energy)
  m.prism(pose(t,[0,0,.054]),[[-.025,.27],[.025,.27],[bend,length-.07]],.018,b,.08+energy)
}
export function drawModel(props: Props, time: number, turn: number, strike: number, celebrate: number, lookX:number,lookY:number, moving: boolean) {
  const yaw=lookX*.09+turn+Math.sin(time*1.05)*.045
  const camera=pose(I,[0,-.02,0],-.10+lookY*.025,yaw)
  const m=new Mesh(camera)
  const bySlot=(slot:string)=>{const item=props.gear?.find(g=>g.equipped&&g.slot===slot);return item?getEquipmentArt(item.id):null}
  const helm=bySlot('elmo'), body=bySlot('armadura'), cloak=bySlot('capa'), blade=bySlot('arma')
  const [armorTint,armorTrim]=palette(body)
  // Presentation only: mixed builds retain the actual family of each equipped piece.
  const martial=helm?.track==='reino_murim'||(!helm&&body?.track==='reino_murim')
  const clothBody=body?.family==='tunic'||body?.family==='robe'||body?.family==='coat'
  const bareHead=martial&&(!helm||['band','diadem','crown','halo'].includes(helm.family))
  const idle=Math.sin(time*(props.resting?1.6:2.5))*.035
  const rig=pose(I,[0,idle+celebrate*.13,0],0,0,Math.sin(time*1.25)*.025+strike*.08)
  const torso=pose(rig,[0,-.12,0],props.resting?.08:0)
  const head=pose(torso,[0,.80,0],-lookY*.035,lookX*.035,0)
  // Boots and legs are real volumes, not billboards.
  for(const s of [-1,1]){
    const leg=pose(rig,[s*.23,-.55,0],0,0,s*.04)
    m.box(leg,[0,-.31,0],[.29,.64,.34],dark)
    m.box(leg,[0,-.52,.025],[.33,.24,.41],clothBody?armorTint:steel)
    m.box(leg,[0,-.71,.085],[.38,.26,.55],black)
    m.box(leg,[0,-.65,.31],[.29,.07,.06],gold,.02)
  }
  if(cloak) cape(m,torso,cloak,Math.sin(time*2)*.11+strike*.12)
  m.orb(torso,[0,0,0],[.43,.49,.29],dark)
  armor(m,torso,body)
  for(const s of [-1,1]){
    const armed=s===1||blade?.family==='twin'
    const swing=armed?strike:0
    const arm=pose(torso,[s*.48,.22,0],-.10-swing*.60,0,s*(.26+Math.sin(time*2.5)*.035+swing*.25))
    const heavy=!body||body.family==='plate'||body.family==='exo'
    m.orb(arm,[0,-.07,0],heavy?[.25,.23,.25]:[.19,.20,.19],armorTint)
    m.box(arm,[0,-.12,.22],[.24,.12,.07],armorTrim,.025)
    m.box(arm,[0,-.31,0],clothBody?[.28,.36,.29]:[.23,.34,.24],clothBody?armorTint:dark)
    const elbow=pose(arm,[0,-.43,0],-.30-swing*.25)
    m.box(elbow,[0,-.15,.02],clothBody?[.27,.28,.27]:[.24,.28,.25],clothBody?armorTint:steel)
    if(clothBody)m.box(elbow,[0,-.26,.02],[.28,.07,.28],armorTrim,.025)
    const hand=pose(elbow,[0,-.31,.04])
    m.orb(hand,[0,0,0],[.14,.15,.14],clothBody?skin:dark)
    if((blade||props.gear===undefined)&&(s===1||blade?.family==='twin'))
      weapon(m,pose(hand,[0,0,0],.15,-s*.06,-s*(.65+swing*.58)),blade)
    else if(s===-1){
      const qi=.10+Math.sin(time*3)*.014+celebrate*.035
      m.orb(hand,[-.18,.12,.18],[qi,qi,qi],props.lowHp?color('#f87171'):gold,.5)
    }
  }
  m.orb(head,[0,0,0],[.51,.51,.43],bareHead?skin:dark)
  if(bareHead){
    // Original martial artist silhouette: visible face, tied hair and topknot.
    m.ringBody(head,[0,0,-.015],[[.14,.51,.44],[.32,.47,.42],[.49,.30,.29],[.53,0,0]],hair)
    m.orb(head,[0,.53,-.10],[.15,.14,.14],hair)
    m.box(head,[0,.43,-.10],[.22,.075,.20],armorTrim,.025)
    m.box(head,[0,-.12,.43],[.09,.12,.10],skin,.035)
    for(const side of [-1,1])m.box(head,[side*.17,.025,.41],[.20,.045,.045],hair,.015)
  }else m.box(head,[0,-.09,.38],[.82,.38,.18],black,.12)
  if(helm||!bareHead)helmet(m,head,helm)
  const blink=moving&&time%4.8>4.66?.12:1
  const family=helm?.family??'helm'
  const faceCover=family==='visor'||family==='mask'||family==='lens'
  const shell=family==='hood'||family==='helm'||family==='horn'
  const eyeDepth=bareHead?.408:faceCover?.563:shell?.533:.493
  for(const sign of [-1,1]){
    if(family==='lens'&&sign===1)continue // the monóculo covers this eye
    if(bareHead){
      m.box(head,[sign*.17,-.055,eyeDepth],[.16,.055*blink,.038],hair,.015)
      if(blink>.5)m.box(head,[sign*.17,-.055,eyeDepth+.023],[.045,.044,.014],props.lowHp?color('#f87171'):gold,.008)
    }else m.box(head,[sign*.19,-.06,eyeDepth],[.24,.085*blink,.045],props.lowHp?color('#f87171'):light,.02,.45)
  }
  if(bareHead)m.box(head,[0,-.24,.36],[.14,.025,.04],hair,.01)
  else if(family!=='mask')m.box(head,[0,-.27,.48],[.28,.055,.05],gold,.02)
  if(celebrate>0.02) m.hoop(rig,[0,0,-.65],1.56+celebrate*.12,.04,props.victory?color('#34d399'):gold)
  // Keep large weapons and wings inside the square preview at all orientations.
  let extent=1
  for(let i=0;i<m.data.length;i+=6)extent=Math.max(extent,Math.abs(m.data[i])/.94,Math.abs(m.data[i+1])/.94)
  if(extent>1)for(let i=0;i<m.data.length;i+=6){m.data[i]/=extent;m.data[i+1]/=extent}
  return new Float32Array(m.data)
}

function renderer(canvas: HTMLCanvasElement) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'})
  if(!gl) return null
  const shader=(kind:number,source:string)=>{
    const sh=gl.createShader(kind)
    if(!sh) throw Error('shader')
    gl.shaderSource(sh,source);gl.compileShader(sh)
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){gl.deleteShader(sh);throw Error('compile')}
    return sh
  }
  const program=gl.createProgram(),buffer=gl.createBuffer()
  if(!program||!buffer) return null
  let vert:WebGLShader|undefined,frag:WebGLShader|undefined
  try {
    vert=shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 c; varying vec3 v; void main(){ gl_Position=vec4(p,1.0); v=c; }')
    frag=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 v; void main(){ gl_FragColor=vec4(v,1.0); }')
    gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program)
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('link')
  } catch {
    gl.deleteProgram(program);gl.deleteBuffer(buffer);return null
  } finally {if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag)}
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
  const p=gl.getAttribLocation(program,'p'), c=gl.getAttribLocation(program,'c')
  gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,0)
  gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,3,gl.FLOAT,false,24,12)
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL)
  return {
    draw(vertices:Float32Array){
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.067,.067,.078,1)
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
      gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6)
    },
    dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program)}
  }
}

export function WarriorAvatar3D(props: Props) {
  const ref=useRef<HTMLCanvasElement>(null)
  const latest=useRef(props)
  const [ready,setReady]=useState(false)
  useEffect(()=>{latest.current=props},[props])
  useEffect(()=>{
    const target=ref.current
    if(!target) return
    const canvas: HTMLCanvasElement=target
    let engine:ReturnType<typeof renderer>
    try {engine=renderer(canvas)} catch {return}
    if(!engine) return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible=true, lost=false, presented=false, frame=0, prev=0, elapsed=0, turnTime=2, strikeTime=2, celebrateTime=2
    let x=0,y=0,lastProps:Props|null=null,lastReduced=false
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false})
    observer.observe(canvas)
    const fail=(event:Event)=>{event.preventDefault();lost=true;presented=false;setReady(false);cancelAnimationFrame(frame)}
    const restore=()=>{lost=false;engine?.dispose();try{engine=renderer(canvas)}catch{engine=null}if(engine){lastProps=null;frame=requestAnimationFrame(tick)}}
    canvas.addEventListener('webglcontextlost',fail);canvas.addEventListener('webglcontextrestored',restore)
    function tick(now:number){
      if(lost||!engine)return
      frame=requestAnimationFrame(tick)
      if(now-prev<32)return
      const dt=prev?Math.min((now-prev)/1000,.07):0;prev=now
      const p=latest.current, motion=!p.paused&&!reduced.matches
      if(!visible||document.hidden)return
      const changed=lastProps!==p||lastReduced!==reduced.matches
      if(lastProps){
        if(p.pulse!==lastProps.pulse) {turnTime=0;celebrateTime=0}
        if(p.attack!==lastProps.attack&&p.attack>0)strikeTime=0
        if(p.levelUp!==lastProps.levelUp||p.victory&&!lastProps.victory||p.milestone&&!lastProps.milestone)celebrateTime=0
      }
      lastProps=p;lastReduced=reduced.matches
      if(!motion&&!changed)return
      if(motion){
        elapsed+=dt;turnTime+=dt;strikeTime+=dt;celebrateTime+=dt
        const damping=1-Math.exp(-dt*10);x+=(p.look.x-x)*damping;y+=(p.look.y-y)*damping
      } else {x=0;y=0;turnTime=2;strikeTime=2;celebrateTime=2}
      const phase=Math.min(turnTime/1.4,1), turn=TAU*(phase*phase*(3-2*phase)-1)
      const strike=strikeTime<.6?Math.sin(strikeTime/.6*Math.PI):0
      const celebrate=celebrateTime<1.4?Math.sin(celebrateTime/1.4*Math.PI):0
      const pixels=Math.max(1,Math.round(p.size*Math.min(window.devicePixelRatio||1,1.5)))
      if(canvas.width!==pixels||canvas.height!==pixels){canvas.width=pixels;canvas.height=pixels}
      engine.draw(drawModel(p,elapsed,turn,strike,celebrate,x,y,motion))
      const equipped=p.gear?.filter(g=>g.equipped).map(g=>g.id).sort().join(',')??''
      if(canvas.dataset.renderedEquipment!==equipped)canvas.dataset.renderedEquipment=equipped
      if(!presented){presented=true;setReady(true)}
    }
    frame=requestAnimationFrame(tick)
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('webglcontextlost',fail);canvas.removeEventListener('webglcontextrestored',restore);engine?.dispose()}
  },[])
  return <canvas ref={ref} aria-hidden="true" data-avatar-renderer={ready?'webgl':'fallback'}
    style={{position:'absolute',inset:0,width:'100%',height:'100%',borderRadius:14,pointerEvents:'none',opacity:ready?1:0}} />
}
