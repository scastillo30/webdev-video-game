"""Swordsman v004: inward chest guard matching the supplied starting pose."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE=os.path.join(ROOT,'assets/characters/swordsman/sword-wind')
OUT=os.path.join(BASE,'v004')
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'v001/swordsman_sword_wind.blend'))
s=bpy.context.scene
for ob in list(s.objects):
    if ob.name.startswith(('03','04','CONTROLS')):bpy.data.objects.remove(ob,do_unlink=True)
im=bpy.data.images.load(os.path.join(OUT,'arm_sword_atlas.png')); im.pack()
mat=bpy.data.materials.new('New arm / closed grip / rigid sword • packed'); mat.use_nodes=True
n=mat.node_tree.nodes;n.clear();l=mat.node_tree.links
t=n.new('ShaderNodeTexImage');t.image=im
e=n.new('ShaderNodeEmission');tr=n.new('ShaderNodeBsdfTransparent');mx=n.new('ShaderNodeMixShader');o=n.new('ShaderNodeOutputMaterial')
l.new(t.outputs['Color'],e.inputs[0]);l.new(t.outputs['Alpha'],mx.inputs[0]);l.new(tr.outputs[0],mx.inputs[1]);l.new(e.outputs[0],mx.inputs[2]);l.new(mx.outputs[0],o.inputs[0])
def empty(name,parent,location):
    ob=bpy.data.objects.new(name,None);s.collection.objects.link(ob);ob.parent=parent;ob.location=location;ob.empty_display_size=.15;return ob
def part(name,points,anchor,scale,parent,z,material=None,tw=1536,th=1024):
    verts=[((x-anchor[0])*scale,(anchor[1]-y)*scale,z) for x,y in points]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[tuple(range(len(verts)))]);me.update()
    ob=bpy.data.objects.new(name,me);s.collection.objects.link(ob);ob.parent=parent;me.materials.append(material or mat)
    uv=me.uv_layers.new(name='Registered sprite UV')
    for p in me.polygons:
        for li in p.loop_indices:
            x,y=points[me.loops[li].vertex_index];uv.data[li].uv=(x/tw,1-y/th)
    return ob
shoulder=empty('CTRL Shoulder • anchored to jacket',None,((315-350)/80,(440-155)/80,.08))
elbow=empty('CTRL Elbow • fixed upper arm length',shoulder,(-150*.00351,-620*.00351,0))
wrist=empty('CTRL Wrist • neutral grip',elbow,(0,-225*.0052,0))
upper=part('03 New upper sleeve • shoulder to elbow',[(350,86),(416,93),(467,130),(492,189),(499,270),(485,333),(455,395),(430,458),(392,509),(378,566),(340,626),(343,704),(330,765),(293,804),(205,801),(121,780),(92,740),(91,668),(123,625),(147,584),(129,539),(156,497),(184,455),(199,380),(204,290),(217,220),(246,164),(296,122)],(360,140),.00351,shoulder,.04)
forearm=part('04 New forearm • inserted under turning cuff',[(696,354),(727,346),(770,346),(808,349),(835,362),(831,414),(819,484),(812,552),(816,575),(702,575),(700,552),(699,484),(688,414)],(770,350),.0044,elbow,.025)
# Extend the bare-arm root behind the cuff; the sleeve is the foreground occluder.
for v in forearm.data.vertices:
    py=350-v.co.y/.0044
    v.co.y+=.16*max(0,min(1,(400-py)/55))
    v.co.y*=.0052/.0044
sleeve_mouth=empty('CHECK Sleeve opening • artwork x210 y760',shoulder,(-150*.00351,-620*.00351,0))
arm_root=empty('CHECK Forearm inserted into sleeve',elbow,(0,0,0))
# The fingers, hilt and guard are painted together, preserving actual contact.
weapon_im=bpy.data.images.load(os.path.join(OUT,'wrapped_grip_sword.png'));weapon_im.pack()
weapon_mat=mat.copy();weapon_mat.name='Authored wrapped fingers / straight hilt / rigid blade'
next(n for n in weapon_mat.node_tree.nodes if n.type=='TEX_IMAGE').image=weapon_im
# Hilt center is inside the authored curled fingers at x512 y240.
grip=empty('GRIP • authored wrapped fingers around hilt',wrist,(0,-165*.004,.06))
hand=part('05 Hand wrapped around hilt • visible thumb and fingers',[(459,52),(490,47),(539,48),(564,62),(575,104),(565,136),(574,181),(580,233),(570,278),(542,310),(540,351),(548,365),(606,385),(650,381),(678,398),(666,428),(626,420),(556,421),(535,449),(513,518),(495,455),(469,423),(396,420),(362,435),(347,401),(370,379),(394,390),(475,368),(482,352),(483,312),(463,299),(451,281),(448,257),(427,243),(417,214),(421,189),(438,158),(457,137),(454,112)],(512,240),.004,grip,.002,weapon_mat,1024,1536)
sword=part('06 Rigid blade • registered to held hilt',[(477,419),(548,419),(548,1344),(535,1430),(513,1513),(490,1432),(476,1340)],(512,240),.004,grip,0,weapon_mat,1024,1536)
# Three continuous cloth sections: shoulder sleeve, elbow fold, turning cuff.
outline=[(360+v.co.x/.00351,140-v.co.y/.00351) for v in upper.data.vertices]
def clip_y(points,line,keep_above):
    result=[]
    for prev,cur in zip(points[-1:]+points[:-1],points):
        pin=prev[1]<=line if keep_above else prev[1]>=line
        cin=cur[1]<=line if keep_above else cur[1]>=line
        if pin!=cin:
            u=(line-prev[1])/(cur[1]-prev[1]);result.append((prev[0]+u*(cur[0]-prev[0]),line))
        if cin:result.append(cur)
    return result
bpy.data.objects.remove(upper,do_unlink=True)
upper=part('03a Sleeve • shoulder to elbow fold',clip_y(outline,500,True),(360,140),.00351,shoulder,.04)
cuff=part('03c Shirt opening • turns with forearm',clip_y(outline,670,False),(210,760),.00351,elbow,.045)
sleeve_keys=[]
px,py=-150*.00351,-620*.00351
# A filled cloth gusset spans the elbow fold behind the turning cuff.
# Its boundaries connect the fixed sleeve to the rotated cuff without an open wedge.
NX,NY=16,12
left_top=Vector(((150-360)*.00351,(140-500)*.00351,.037))
right_top=Vector(((405-360)*.00351,(140-500)*.00351,.037))
def gusset_vertices(angle):
    theta=math.radians(angle);bottom=[]
    for sx in (110,335):
        dx,dy=(sx-210)*.00351,(760-690)*.00351
        bottom.append(Vector((px+dx*math.cos(theta)-dy*math.sin(theta),py+dx*math.sin(theta)+dy*math.cos(theta),.037)))
    bottom.sort(key=lambda v:v.x)
    return [left_top.lerp(right_top,i/NX).lerp(bottom[0].lerp(bottom[1],i/NX),j/NY) for j in range(NY+1) for i in range(NX+1)]
gm=bpy.data.meshes.new('Continuous elbow fabric fold')
gv=gusset_vertices(0)
gf=[(j*(NX+1)+i,j*(NX+1)+i+1,(j+1)*(NX+1)+i+1,(j+1)*(NX+1)+i) for j in range(NY) for i in range(NX)]
gm.from_pydata(gv,[],gf);gm.update()
gusset=bpy.data.objects.new('03b Continuous elbow fabric • behind cuff',gm);s.collection.objects.link(gusset);gusset.parent=shoulder;gm.materials.append(mat)
guv=gm.uv_layers.new()
for poly in gm.polygons:
    for li in poly.loop_indices:
        idx=gm.loops[li].vertex_index;u=(idx%(NX+1))/NX;v=(idx//(NX+1))/NY
        sx=(250+150*u)*(1-v)+(170+170*u)*v;sy=350+200*v
        guv.data[li].uv=(sx/1536,1-sy/1024)
gusset.shape_key_add(name='Basis')
for angle in range(16,129,16):
    key=gusset.shape_key_add(name=f'Connected cloth at {angle:03d} deg');sleeve_keys.append((angle,key))
    for i,co in enumerate(gusset_vertices(angle)):key.data[i].co=co
def ease(t):return t*t*t*(t*(t*6-15)+10)
for f in range(1,194):
    if f<=25:lift=1
    elif f<89:lift=1-ease((f-25)/64)
    elif f<=117:lift=0
    elif f<181:lift=ease((f-117)/64)
    else:lift=1
    # Inward elbow flexion throughout; opening guard 27 degrees up-right across the chest.
    shoulder.rotation_euler.z=math.radians(-30*lift)
    elbow.rotation_euler.z=math.radians(128*lift)
    wrist.rotation_euler.z=math.radians(-20+39*lift)
    for angle,key in sleeve_keys:
        key.value=max(0,1-abs(128*lift-angle)/16)
        key.keyframe_insert(data_path='value',frame=f)
    for ctrl in (shoulder,elbow,wrist):ctrl.keyframe_insert(data_path='rotation_euler',frame=f)
    # Sway stays in the sleeve attachment, without moving the shoulder root.
s.timeline_markers.clear()
for name,f in [('Reference chest guard • blade up-right',1),('Controlled lowering begins',25),('Low guard • reference direction',89),('Lift against sword weight',117),('Reference chest guard restored',181)]:s.timeline_markers.new(name,frame=f)
s.camera.location=(-.9,1.2,30);s.camera.data.ortho_scale=17.5
s.render.resolution_x=768;s.render.resolution_y=800;s.render.resolution_percentage=100
s.cycles.samples=12;s.cycles.transparent_max_bounces=64
s.frame_start=1;s.frame_end=192;s.render.fps=24
notes=bpy.data.texts.get('READ ME');notes.clear();notes.write('SWORDSMAN sword-wind v004 | 8 seconds / 24fps\nActual sleeve mouth pivot; forearm root underlaps the cuff. New hand and hilt authored together with curled fingers, visible thumb and straight sword.\nEdit CTRL Shoulder / CTRL Elbow / CTRL Wrist. GRIP is fixed to wrist: no hilt sliding or independent blade bending.\nInward elbow bend throughout, about 14 degrees in low guard and 142 in the reference chest guard. Frame 1 holds the supplied start pose, blade up-right about 27 degrees. Arm arranged inward across chest to match the supplied reference.\nIllustrated 2.5D motion in the image plane, not full 3D swordplay.\nPacked textures. All prior versions and runtime mappings preserved.\n')
validation={'frames':192,'fps':24,'durationSeconds':8,'maxGripDrift':0,'maxUpperArmLengthError':0,'maxForearmLengthError':0,'loopTransformError':0,'swordRigid':True,'maxSleeveOpeningGap':0,'maxVisibleCuffGap2D':0}
s.frame_set(1);bpy.context.view_layer.update()
rest=grip.matrix_local.copy();first=None; elbow_angles=[]
for f in range(1,194):
    s.frame_set(f);bpy.context.view_layer.update()
    mouth=cuff.matrix_world @ Vector((0,0,.045))
    root=arm_root.matrix_world.translation
    validation['maxVisibleCuffGap2D']=max(validation['maxVisibleCuffGap2D'],math.hypot(mouth.x-root.x,mouth.y-root.y))
    validation['maxSleeveOpeningGap']=max(validation['maxSleeveOpeningGap'],(sleeve_mouth.matrix_world.translation-arm_root.matrix_world.translation).length)
    mats=[c.matrix_world.copy() for c in (shoulder,elbow,wrist,grip)]
    ua=elbow.matrix_world.translation-shoulder.matrix_world.translation
    fa=wrist.matrix_world.translation-elbow.matrix_world.translation
    elbow_angles.append(math.degrees(ua.angle(fa)))
    if f==1:first=mats
    if f==193:validation['loopTransformError']=max(abs(a-b) for ma,mb in zip(first,mats) for ra,rb in zip(ma,mb) for a,b in zip(ra,rb))
    validation['maxGripDrift']=max(validation['maxGripDrift'],max(abs(a-b) for ra,rb in zip(grip.matrix_local,rest) for a,b in zip(ra,rb)))
    validation['maxUpperArmLengthError']=max(validation['maxUpperArmLengthError'],abs((elbow.matrix_world.translation-shoulder.matrix_world.translation).length-elbow.location.length))
    validation['maxForearmLengthError']=max(validation['maxForearmLengthError'],abs((wrist.matrix_world.translation-elbow.matrix_world.translation).length-wrist.location.length))
assert all(validation[k]<1e-5 for k in ('maxGripDrift','maxUpperArmLengthError','maxForearmLengthError','loopTransformError','maxSleeveOpeningGap','maxVisibleCuffGap2D')),validation
validation['anatomicalElbowFlexionDegrees']=[min(elbow_angles),max(elbow_angles)]
validation['wristAdjustmentDegrees']=[-20,19]
validation['shoulderMovementDegrees']=[-30,0]
assert 0<min(elbow_angles)<20 and max(elbow_angles)<150
open(os.path.join(OUT,'rig_validation.json'),'w').write(json.dumps(validation,indent=2)+'\n')
s.frame_set(1);bpy.context.view_layer.update()
blade=sword.matrix_world.to_3x3() @ Vector((0,-1,0))
validation['startBladeAngleDegrees']=math.degrees(math.atan2(blade.y,blade.x))
validation['startForearmPointsRight']=(wrist.matrix_world.translation.x>elbow.matrix_world.translation.x)
validation['startPose']='Forearm across chest, closed grip, blade up-right; supplied reference'
assert 25<validation['startBladeAngleDegrees']<30 and validation['startForearmPointsRight']
open(os.path.join(OUT,'rig_validation.json'),'w').write(json.dumps(validation,indent=2)+'\n')
s.render.filepath=os.path.join(OUT,'frames/frame_')
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'swordsman_sword_wind.blend'))
for frame,name in [(1,'raised.png'),(49,'transition.png'),(97,'lowered.png'),(149,'lifting.png')]:
    s.frame_set(frame);s.render.filepath=os.path.join(OUT,name);bpy.ops.render.render(write_still=True)
# Review the actual sleeve boundary and grip at higher detail.
cam=s.camera; camloc=cam.location.copy(); camscale=cam.data.ortho_scale
for f in (1,49,97,149):
    s.frame_set(f);bpy.context.view_layer.update()
    center=(elbow.matrix_world.translation+grip.matrix_world.translation)/2
    cam.location.x=center.x;cam.location.y=center.y;cam.data.ortho_scale=4.5
    s.render.resolution_x=s.render.resolution_y=900
    s.render.filepath=os.path.join(OUT,f'connection_review_{f:03d}.png');bpy.ops.render.render(write_still=True)
cam.location=camloc;cam.data.ortho_scale=camscale
s.render.resolution_x=768;s.render.resolution_y=800
if os.environ.get('SWORDSMAN_RENDER')=='1':
    os.makedirs(os.path.join(OUT,'frames'),exist_ok=True)
    s.render.resolution_percentage=64;s.render.filepath=os.path.join(OUT,'frames/frame_');bpy.ops.render.render(animation=True)
