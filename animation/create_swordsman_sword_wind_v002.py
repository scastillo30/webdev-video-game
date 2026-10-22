"""Swordsman v002: articulated shoulder, elbow, wrist and rigid gripped sword."""
import bpy, math, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE=os.path.join(ROOT,'assets/characters/swordsman/sword-wind')
OUT=os.path.join(BASE,'v002')
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
def part(name,points,anchor,scale,parent,z):
    verts=[((x-anchor[0])*scale,(anchor[1]-y)*scale,z) for x,y in points]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[tuple(range(len(verts)))]);me.update()
    ob=bpy.data.objects.new(name,me);s.collection.objects.link(ob);ob.parent=parent;me.materials.append(mat)
    uv=me.uv_layers.new(name='Registered sprite UV')
    for p in me.polygons:
        for li in p.loop_indices:
            x,y=points[me.loops[li].vertex_index];uv.data[li].uv=(x/1536,1-y/1024)
    return ob
shoulder=empty('CTRL Shoulder • anchored to jacket',None,((315-350)/80,(440-155)/80,.08))
elbow=empty('CTRL Elbow • fixed upper arm length',shoulder,(-140*.00351,-560*.00351,0))
wrist=empty('CTRL Wrist • neutral grip',elbow,(0,-240*.0044,0))
upper=part('03 New upper sleeve • shoulder to elbow',[(350,86),(416,93),(467,130),(492,189),(499,270),(485,333),(455,395),(430,458),(392,509),(378,566),(340,626),(343,704),(330,765),(293,804),(205,801),(121,780),(92,740),(91,668),(123,625),(147,584),(129,539),(156,497),(184,455),(199,380),(204,290),(217,220),(246,164),(296,122)],(360,140),.00351,shoulder,.04)
forearm=part('04 New forearm • anatomical elbow to wrist',[(676,345),(712,344),(771,349),(818,352),(839,386),(829,445),(814,509),(816,577),(833,610),(812,642),(722,642),(691,610),(697,555),(699,487),(688,419)],(770,370),.0044,elbow,.025)
hand=part('05 Closed gloved hand • thumb opposing fingers',[(725,574),(777,570),(815,584),(835,612),(828,648),(833,695),(871,732),(894,788),(891,852),(878,895),(846,909),(819,901),(793,911),(767,902),(750,889),(715,887),(688,861),(681,812),(687,759),(699,711),(687,665),(680,631),(693,599)],(770,610),.0044,wrist,.06)
grip=empty('GRIP • sword hilt locked inside closed fingers',wrist,(30*.0044,-190*.0044,.035))
sword=part('06 Rigid sword • hilt guard blade',[(1294,22),(1320,29),(1333,47),(1334,69),(1324,90),(1326,247),(1341,266),(1390,273),(1424,298),(1402,325),(1360,309),(1337,325),(1334,453),(1333,751),(1320,913),(1294,994),(1276,941),(1264,849),(1264,430),(1255,325),(1237,311),(1193,326),(1172,300),(1206,272),(1263,265),(1274,248),(1273,88),(1263,64),(1267,40),(1280,27)],(1298,200),.0057,grip,0)
def ease(t):return t*t*t*(t*(t*6-15)+10)
for f in range(1,194):
    if f<=25:lift=1
    elif f<89:lift=1-ease((f-25)/64)
    elif f<=117:lift=0
    elif f<181:lift=ease((f-117)/64)
    else:lift=1
    # About 15° shoulder movement, 120° additional elbow flexion, modest wrist adjustment.
    shoulder.rotation_euler.z=math.radians(-15*lift)
    elbow.rotation_euler.z=math.radians(-20-120*lift)
    wrist.rotation_euler.z=math.radians(-8+6*lift)
    for ctrl in (shoulder,elbow,wrist):ctrl.keyframe_insert(data_path='rotation_euler',frame=f)
    # Sway stays in the sleeve attachment, without moving the shoulder root.
s.timeline_markers.clear()
for name,f in [('Raised guard • closed grip',1),('Controlled lowering begins',25),('Low guard • reference direction',89),('Lift against sword weight',117),('Raised guard restored',181)]:s.timeline_markers.new(name,frame=f)
s.camera.location=(-.9,1.2,30);s.camera.data.ortho_scale=17.5
s.render.resolution_x=768;s.render.resolution_y=800;s.render.resolution_percentage=100
s.cycles.samples=12;s.cycles.transparent_max_bounces=64
s.frame_start=1;s.frame_end=192;s.render.fps=24
notes=bpy.data.texts.get('READ ME');notes.clear();notes.write('SWORDSMAN sword-wind v002 | 8 seconds / 24fps\nIndependent new upper sleeve, forearm, closed hand and rigid sword.\nEdit CTRL Shoulder / CTRL Elbow / CTRL Wrist. GRIP is fixed to wrist: no hilt sliding or independent blade bending.\nShoulder / elbow / wrist move in sequence; elbow retains about 6 degrees of anatomical flexion at low guard.\nIllustrated 2.5D motion in the image plane, not full 3D swordplay.\nPacked textures. v001 and runtime mappings preserved.\n')
validation={'frames':192,'fps':24,'durationSeconds':8,'maxGripDrift':0,'maxUpperArmLengthError':0,'maxForearmLengthError':0,'loopTransformError':0,'swordRigid':True}
s.frame_set(1);bpy.context.view_layer.update()
rest=grip.matrix_local.copy();first=None; elbow_angles=[]
for f in range(1,194):
    s.frame_set(f);bpy.context.view_layer.update()
    mats=[c.matrix_world.copy() for c in (shoulder,elbow,wrist,grip)]
    ua=elbow.matrix_world.translation-shoulder.matrix_world.translation
    fa=wrist.matrix_world.translation-elbow.matrix_world.translation
    elbow_angles.append(math.degrees(ua.angle(fa)))
    if f==1:first=mats
    if f==193:validation['loopTransformError']=max(abs(a-b) for ma,mb in zip(first,mats) for ra,rb in zip(ma,mb) for a,b in zip(ra,rb))
    validation['maxGripDrift']=max(validation['maxGripDrift'],max(abs(a-b) for ra,rb in zip(grip.matrix_local,rest) for a,b in zip(ra,rb)))
    validation['maxUpperArmLengthError']=max(validation['maxUpperArmLengthError'],abs((elbow.matrix_world.translation-shoulder.matrix_world.translation).length-elbow.location.length))
    validation['maxForearmLengthError']=max(validation['maxForearmLengthError'],abs((wrist.matrix_world.translation-elbow.matrix_world.translation).length-wrist.location.length))
assert all(validation[k]<1e-5 for k in ('maxGripDrift','maxUpperArmLengthError','maxForearmLengthError','loopTransformError')),validation
validation['anatomicalElbowFlexionDegrees']=[min(elbow_angles),max(elbow_angles)]
validation['wristAdjustmentDegrees']=[-8,-2]
validation['shoulderMovementDegrees']=[-15,0]
assert 0<min(elbow_angles)<10 and max(elbow_angles)<140
open(os.path.join(OUT,'rig_validation.json'),'w').write(json.dumps(validation,indent=2)+'\n')
s.render.filepath=os.path.join(OUT,'frames/frame_')
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'swordsman_sword_wind.blend'))
for frame,name in [(1,'raised.png'),(49,'transition.png'),(97,'lowered.png'),(149,'lifting.png')]:
    s.frame_set(frame);s.render.filepath=os.path.join(OUT,name);bpy.ops.render.render(write_still=True)
if os.environ.get('SWORDSMAN_RENDER')=='1':
    os.makedirs(os.path.join(OUT,'frames'),exist_ok=True)
    s.render.resolution_percentage=64;s.render.filepath=os.path.join(OUT,'frames/frame_');bpy.ops.render.render(animation=True)
