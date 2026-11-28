"""Carbon original procedural GLB prototypes. Requires numpy and trimesh.
Rigid articulated meshes, not a skinned character. Y-up, +Z forward, metres.
"""
import json, struct, math, pathlib
import numpy as np
import trimesh as tm
OUT=pathlib.Path(__file__).parent

def rgb(h): return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def quat(axis,angle):
    v=np.asarray(axis,float); v/=np.linalg.norm(v);return [*(v*np.sin(angle/2)),float(np.cos(angle/2))]
class Model:
    def __init__(self,name):
        self.name=name;self.buf=bytearray();self.views=[];self.acc=[];self.meshes=[];self.nodes=[];self.mats=[];self.anim=[]
    def data(self,x,typ,component,target=None,bounds=False):
        x=np.ascontiguousarray(x);self.buf.extend(b'\0'*((-len(self.buf))%4));off=len(self.buf);self.buf.extend(x.tobytes());v={'buffer':0,'byteOffset':off,'byteLength':x.nbytes};
        if target:v['target']=target
        self.views.append(v);a={'bufferView':len(self.views)-1,'componentType':component,'count':len(x),'type':typ};
        if bounds:a.update(min=np.atleast_1d(x.min(axis=0)).tolist(),max=np.atleast_1d(x.max(axis=0)).tolist())
        self.acc.append(a);return len(self.acc)-1
    def material(self,name,h,metal=0,rough=.75,emission=0):
        m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*rgb(h),1],'metallicFactor':metal,'roughnessFactor':rough}}
        if emission:m['emissiveFactor']=[v*emission for v in rgb(h)]
        self.mats.append(m);return len(self.mats)-1
    def node(self,name,parent=None,pos=(0,0,0),mesh=None):
        n={'name':name,'translation':list(pos)}
        if mesh is not None:n['mesh']=mesh
        self.nodes.append(n);i=len(self.nodes)-1
        if parent is not None:self.nodes[parent].setdefault('children',[]).append(i)
        return i
    def part(self,name,parent,mesh,mat):
        # Smooth organic surfaces and fabric; retain crisp normals on plates, seams and blades.
        v=np.asarray(mesh.triangles.reshape(-1,3),dtype='<f4')
        organic=name.startswith(('HeadMesh','Ear','EyeWhite','Iris','EyeGlint','Nose','HairCap','HairTuft','HairLock','Topknot','Ponytail','Neck','Hand.','BaseShoulder.','Sleeve.','Forearm.','Pants.','BaseTorso','BaseHip','BaseWaist','Boot.'))
        norm=(mesh.vertex_normals[mesh.faces].reshape(-1,3) if organic else np.repeat(mesh.face_normals,3,axis=0)).astype('<f4')
        p=self.data(v,'VEC3',5126,34962,True);n=self.data(norm,'VEC3',5126,34962)
        self.meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':p,'NORMAL':n},'material':mat}]})
        return self.node('Mesh_'+name,parent,mesh=len(self.meshes)-1)
    def animation(self,name,channels):
        a={'name':name,'samplers':[],'channels':[]}
        for node,axis,angles,times in channels:
            inp=self.data(np.array(times,dtype='<f4'),'SCALAR',5126,bounds=True);out=self.data(np.array([quat(axis,angle) for angle in angles],dtype='<f4'),'VEC4',5126)
            a['samplers'].append({'input':inp,'output':out,'interpolation':'LINEAR'});a['channels'].append({'sampler':len(a['samplers'])-1,'target':{'node':node,'path':'rotation'}})
        self.anim.append(a)
    def export(self):
        j={'asset':{'version':'2.0','generator':'Carbon Avatar V2 prototype'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':self.nodes,'meshes':self.meshes,'materials':self.mats,'accessors':self.acc,'bufferViews':self.views,'buffers':[{'byteLength':len(self.buf)}],'animations':self.anim}
        js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);self.buf.extend(b'\0'*((-len(self.buf))%4));b=bytes(self.buf)
        raw=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(b))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(b),b'BIN\0')+b
        (OUT/(self.name+'.glb')).write_bytes(raw)

def loft(rings,n=10):
    # rings: (height, horizontal radius, depth radius, centre z)
    vs=[];fs=[]
    for y,rx,rz,z in rings:
        vs.extend([(rx*math.cos(2*math.pi*i/n),y,z+rz*math.sin(2*math.pi*i/n)) for i in range(n)])
    for k in range(len(rings)-1):
        for i in range(n):
            a=k*n+i;b=k*n+(i+1)%n;c=b+n;d=a+n;fs.extend([(a,d,c),(a,c,b)])
    for i in range(1,n-1):fs.extend([(0,i,i+1),((len(rings)-1)*n,(len(rings)-1)*n+i+1,(len(rings)-1)*n+i)])
    m=tm.Trimesh(vertices=vs,faces=fs,process=True);m.fix_normals();return m

def ell(center,size,sub=2):
    m=tm.creation.icosphere(subdivisions=sub);m.apply_scale(size);m.apply_translation(center);return m

def box(center,size):
    m=tm.creation.box(extents=size);m.apply_translation(center);return m

def rod(a,b,r1,r2=None,n=8):
    a,b=np.array(a),np.array(b);d=b-a;l=np.linalg.norm(d);m=loft([(0,r1,r1,0),(l,r2 or r1,r2 or r1,0)],n);m.apply_transform(tm.geometry.align_vectors([0,1,0],d/l));m.apply_translation(a);return m

def panel(points,thickness=.012):
    # Convex plate, doubled surface with thickness along Z.
    v=np.asarray(points);n=len(v);vs=np.vstack([v+[0,0,thickness/2],v-[0,0,thickness/2]]);f=[]
    for i in range(1,n-1):f.extend([(0,i,i+1),(n,n+i+1,n+i)])
    for i in range(n):j=(i+1)%n;f.extend([(i,j,j+n),(i,j+n,i+n)])
    m=tm.Trimesh(vertices=vs,faces=f,process=True);m.fix_normals();return m

def curved_trim(points,r=.004):
    """Low-cost 3D piping or hair lock following a polyline, not a flat decal."""
    return tm.util.concatenate([rod(a,b,r,r*.88,8) for a,b in zip(points,points[1:])])

def build(martial):
    m=Model('murim' if martial else 'cacador'); root=m.node('CharacterRoot'); pelvis=m.node('Hips',root,(0,.91,0));spine=m.node('Spine',pelvis,(0,.13,0));head=m.node('Head',spine,(0,.48,0));
    skin=m.material('Skin','C99873',rough=.63);hair=m.material('Hair','292027',rough=.52);cloth=m.material('BaseCloth','30282A' if martial else '252B35',rough=.91);dark=m.material('DarkCloth','17191E',rough=.88);accent=m.material('Trim','B7833B' if martial else '527898',.4);metal=m.material('Metal','8E673C' if martial else '7E8797',.7,.36);inner=m.material('Lining','9C3F28' if martial else '234F76');energy=m.material('Energy','FFAB42' if martial else '55C8FF',.1,.35,.8);white=m.material('Eyes','F4E5CF');iris=m.material('Iris','50301F');
    P=m.part;w=.93 if martial else 1.08
    P('BaseTorso',spine,loft([(0,.15*w,.105,0),(.17,.19*w,.115,0),(.32,.235*w,.12,0),(.39,.19*w,.105,0),(.43,.075,.075,0)],12),cloth)
    # Base clothing is independent of equipment sockets: no item or bonus is implied.
    P('BaseHip',pelvis,loft([(-.105,.172,.105,0),(-.055,.189,.115,0),(.045,.174,.112,0),(.095,.153,.104,0)],16),dark)
    P('BaseWaist',pelvis,loft([(.055,.163,.114,0),(.096,.162,.116,0),(.135,.156,.110,0)],16),inner if martial else dark)
    P('BaseWaistClasp',pelvis,box((0,.087,.122),(.065,.039,.021)),accent)
    if martial:
        for s in (-1,1):
            P('BaseRobeLapel',spine,panel([(s*.018,.33,.126),(s*.092,.392,.111),(s*.156,.10,.131),(s*.07,.065,.13)],.013),inner)
            P('BaseRobeTrim',spine,rod((s*.085,.385,.126),(s*.153,.10,.143),.009,.007),accent)
            P('BaseRobeSkirt',pelvis,panel([(s*.024,.08,.116),(s*.147,.08,.105),(s*.222,-.26,.106),(s*.045,-.30,.14)],.018),cloth)
            P('BaseRobeHem',pelvis,rod((s*.045,-.294,.151),(s*.222,-.254,.117),.008),accent)
            P('BaseRobeSeam',pelvis,curved_trim([(s*.078,.055,.130),(s*.099,-.08,.145),(s*.12,-.23,.153)],.0035),accent)
            P('BaseCollarDetail',spine,curved_trim([(s*.026,.328,.142),(s*.062,.347,.143),(s*.083,.367,.135)],.004),accent)
    else:
        P('BaseChestPanel',spine,panel([(-.18,.29,.126),(0,.34,.137),(.18,.29,.126),(.145,.11,.132),(0,.075,.136),(-.145,.11,.132)],.018),dark)
        P('BaseChestMark',spine,panel([(-.024,.23,.15),(0,.27,.15),(.024,.23,.15),(0,.20,.15)],.008),energy)
        for s in (-1,1):
            P('BaseHarness',spine,panel([(s*.078,.386,.121),(s*.128,.373,.122),(s*.165,.09,.137),(s*.116,.087,.139)],.014),accent)
            P('BaseHipPouch',pelvis,box((s*.14,-.025,.101),(.074,.114,.055)),cloth)
            P('BasePouchFlap',pelvis,panel([(s*.106,.023,.134),(s*.174,.023,.134),(s*.174,-.008,.136),(s*.140,-.024,.137),(s*.106,-.008,.136)],.008),dark)
            P('BaseHarnessBuckle',spine,box((s*.143,.175,.152),(.046,.030,.012)),metal)
            for y in (.12,.155):
                P('BaseChestStitch',spine,rod((s*.055,y,.149),(s*.12,y+.013,.146),.0035,.0035),accent)
    P('Neck',spine,rod((0,.38,0),(0,.49,0),.055),skin)
    # Shared head socket envelope; different jaw silhouettes for the two styles.
    jaw=1.0 if martial else 1.055
    P('HeadMesh',head,loft([(0,.041,.048,.017),(.015,.055*jaw,.065,.016),(.034,.074*jaw,.078,.013),(.058,.087*jaw,.085,.009),(.078,.095,.091,.006),(.100,.102,.096,.002),(.135,.105,.099,0),(.157,.105,.098,-.001),(.180,.101,.095,-.004),(.20,.093,.089,-.008),(.218,.079,.075,-.011),(.235,.050,.053,-.015),(.245,.009,.014,-.02)],32),skin)
    for s in (-1,1):
        P('Ear',head,ell((s*.101,.115,-.005),(.017,.035,.023),1),skin)
        P('EyeWhite',head,ell((s*.043,.132,.091),(.029,.009,.012),2),white)
        P('Iris',head,ell((s*.043,.132,.102),(.010,.009,.004),2),iris)
        P('EyeGlint',head,ell((s*.043-.003,.135,.106),(.0028,.0028,.0014),1),white)
        P('UpperLid',head,rod((s*.017,.139,.101),(s*.070,.140,.094),.0025,.002),hair)
        P('Brow',head,curved_trim([(s*.019,.153,.099),(s*.042,.159 if martial else .155,.102),(s*.072,.160,.089)],.0038),hair)
        P('LowerLid',head,curved_trim([(s*.019,.126,.099),(s*.044,.123,.104),(s*.069,.128,.096)],.0017),hair)
    P('Nose',head,ell((0,.104,.104),(.012,.021,.013),2),skin);P('Mouth',head,rod((-.018,.064,.090),(.018,.064,.090),.0028),iris)
    P('HairCap',head,loft([(.15,.108,.099,-.018),(.181,.112,.103,-.018),(.21,.112,.102,-.018),(.237,.101,.089,-.019),(.255,.075,.069,-.019),(.265,.008,.008,-.019)],24),hair)
    for i in range(7):
        x=(i-3)*.026
        P('HairLock',head,curved_trim([(x,.226,-.100),(x*.85,.251,-.066),(x*.52,.263,-.023),(x*.45,.244,.035)],.006),hair)
    for s in (-1,1):
        P('Fringe',head,panel([(s*.012,.23,.08),(s*.097,.20,.062),(s*.074,.129,.085),(s*.038,.183,.107)],.025),hair)
    if martial:
        P('Topknot',head,ell((0,.285,-.052),(.054,.059,.057),1),hair);P('HairTie',head,rod((0,.246,-.054),(0,.263,-.054),.047),accent)
        P('Ponytail',head,curved_trim([(0,.25,-.08),(0,.198,-.119),(0,.125,-.148),(0,.065,-.154)],.028),hair)
        for s in (-1,1):
            P('HairLockTail',head,curved_trim([(s*.012,.242,-.084),(s*.019,.167,-.132),(s*.012,.095,-.156)],.007),hair)
    else:
        for i in range(7):P('HairTuft',head,rod(((i-3)*.026,.228,-.015),((i-3)*.032,.28-abs(i-3)*.007,-.046),.019,.003,12),hair)
    helm=m.node('slot_elmo',head,(0,.17,0));P('Headband' if martial else 'HunterCirclet',helm,loft([(-.018,.109,.105,-.01),(.004,.111,.107,-.01)],16),accent)
    armor=m.node('slot_armadura',spine);P('Vest',armor,loft([(.02,.164*w,.116,0),(.22,.203*w,.13,0),(.34,.24*w,.131,0),(.40,.15*w,.095,0)],12),cloth)
    for s in (-1,1):
        P('Lapel',armor,panel([(s*.04,.35,.126),(s*.12,.39,.116),(s*.19,.12,.122),(s*.10,.08,.124)],.013),inner if martial else accent)
        P('ShoulderPlate',armor,ell((s*.225*w,.325,0),(.10 if martial else .125,.065,.12),1),metal)
        P('CoatPanel',armor,panel([(s*.015,.025,.13),(s*.16,.025,.11),(s*.24,-.42,.095),(s*.06,-.37,.16)],.024),cloth)
        P('CoatHem',armor,panel([(s*.24,-.42,.11),(s*.06,-.37,.175),(s*.062,-.34,.175),(s*.23,-.39,.12)],.01),accent)
    P('Sash',armor,loft([(-.025,.169*w,.132,0),(.048,.17*w,.134,0)],12),inner if martial else dark);P('Buckle',armor,box((0,.01,.145),(.079,.056,.025)),accent)
    cape=m.node('slot_capa',spine,(0,.36,-.13));P('Mantle',cape,panel([(-.19,0,0),(.19,0,0),(.25,-.68,-.13),(0,-.60,-.17),(-.25,-.68,-.13)],.025),cloth);P('MantleTrim',cape,panel([(-.25,-.68,-.15),(0,-.60,-.19),(.25,-.68,-.15),(.23,-.64,-.15),(0,-.56,-.19),(-.23,-.64,-.15)],.01),inner)
    arms=[];legs=[];hands=[]
    for s in (-1,1):
        side='L' if s<0 else 'R';a=m.node('UpperArm.'+side,spine,(s*.225*w,.32,0));arms.append(a);e=m.node('Forearm.'+side,a,(s*.16,-.15,0));h=m.node('Hand.'+side,e,(s*.10,-.19,0));hands.append(h)
        P('BaseShoulder.'+side,a,ell((s*.017,-.014,0),(.087 if martial else .103,.076,.092),1),cloth if martial else dark)
        P('BaseShoulderTrim.'+side,a,rod((s*.034,-.025,.071),(s*.080,-.070,.057),.009 if martial else .014),accent)
        P('Sleeve.'+side,a,rod((0,0,0),(s*.16,-.15,0),.075,.057),cloth);P('Forearm.'+side,e,rod((0,0,0),(s*.10,-.17,0),.052,.041),skin);P('Bracer.'+side,e,rod((s*.025,-.045,0),(s*.083,-.145,0),.059,.048),metal);P('Hand.'+side,h,ell((s*.018,-.027,.006),(.039,.066,.03),1),skin)
        leg=m.node('Thigh.'+side,pelvis,(s*.095,0,0));legs.append(leg);k=m.node('Shin.'+side,leg,(0,-.43,0));f=m.node('Foot.'+side,k,(0,-.38,0));P('Pants.'+side,leg,loft([(-.43,.065,.066,0),(-.20,.09,.087,0),(0,.102,.10,0)],10),dark);P('Boot.'+side,k,loft([(-.38,.052,.06,0),(-.15,.067,.073,0),(0,.071,.073,0)],10),cloth);P('Greave.'+side,k,panel([(-.055,-.03,.075),(.055,-.03,.075),(.045,-.27,.067),(-.045,-.27,.067)],.025),metal);P('Foot.'+side,f,box((0,-.035,.045),(.12,.11,.22)),dark)
    weapon=m.node('slot_arma',hands[1],(.035,-.026,.02));
    if martial:
        P('SpearShaft',weapon,rod((0,-.75,0),(0,.8,0),.018),dark);P('SpearGrip',weapon,rod((0,-.14,0),(0,.14,0),.023),inner);P('SpearBlade',weapon,panel([(0,.76,0),(.077,.88,0),(0,1.12,0),(-.077,.88,0)],.028),metal);P('SpearCore',weapon,panel([(0,.83,.019),(.021,.9,.019),(0,1.08,.019),(-.021,.9,.019)],.006),energy)
    else:
        P('SwordGrip',weapon,rod((0,-.16,0),(0,.16,0),.026),dark);P('SwordGuard',weapon,box((0,.17,0),(.23,.04,.05)),metal);P('SwordBlade',weapon,panel([(-.065,.20,0),(.065,.20,0),(.052,.89,0),(0,1.02,0),(-.052,.89,0)],.035),metal);P('SwordCore',weapon,panel([(-.012,.23,.021),(.012,.23,.021),(0,.97,.021)],.008),energy)
    m.animation('guard',[(arms[0],[1,0,0],[0,-.42,-.42,0],[0,.35,1.25,1.8]),(arms[1],[1,0,0],[0,-.72,-.72,0],[0,.35,1.25,1.8]),(spine,[0,1,0],[0,.14,.14,0],[0,.35,1.25,1.8])]);
    m.animation('dodge',[(pelvis,[0,0,1],[0,-.15,.21,0] if martial else [0,.19,-.13,0],[0,.20,.52,.95]),(spine,[0,0,1],[0,-.18,.18,0],[0,.20,.52,.95]),(arms[0],[0,0,1],[0,-.30,-.24,0],[0,.20,.52,.95]),(cape,[1,0,0],[0,.28,.42,0],[0,.20,.52,.95])]);
    m.animation('channel',[(arms[0],[0,0,1],[0,-.42,-.55,-.42,0] if martial else [0,-.18,-.30,-.18,0],[0,.5,1.25,2,2.5]),(arms[1],[0,0,1],[0,.42,.55,.42,0] if martial else [0,.65,.85,.65,0],[0,.5,1.25,2,2.5]),(head,[1,0,0],[0,.08,.10,.08,0],[0,.5,1.25,2,2.5])]);
    m.animation('idle',[(spine,[0,0,1],[0,.018,0,-.018,0],[0,.75,1.5,2.25,3]),(cape,[1,0,0],[0,.08,0,-.05,0],[0,.75,1.5,2.25,3])]);m.animation('attack',[(arms[1],[1,0,0],[0,-.95,1.05,0] if martial else [0,-.60,.78,0],[0,.25,.6,1]),(spine,[0,1,0],[0,-.38,.48,0] if martial else [0,-.18,.25,0],[0,.25,.6,1]),(arms[0],[0,0,1],[0,-.35,-.18,0] if martial else [0,-.12,-.06,0],[0,.25,.6,1]),(pelvis,[0,1,0],[0,-.20,.28,0] if martial else [0,-.11,.18,0],[0,.25,.6,1]),(legs[0],[1,0,0],[0,-.12,.16,0],[0,.25,.6,1]),(legs[1],[1,0,0],[0,.14,-.11,0],[0,.25,.6,1]),(cape,[1,0,0],[0,.10,.28,0],[0,.25,.6,1])]);m.animation('victory',[(arms[0],[0,0,1],[0,-.65,-.65,0],[0,.5,1.3,2]),(arms[1],[0,0,1],[0,.65,.65,0],[0,.5,1.3,2])]);m.animation('rest',[(spine,[1,0,0],[0,.12,.12,0],[0,.5,1.5,2])]);m.export()
if __name__=='__main__':
    build(True);build(False)
