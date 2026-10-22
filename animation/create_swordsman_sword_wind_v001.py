"""Swordsman independent illustrated layers, 192 frames at 24 fps."""
import bpy, math, os, json
from math import sin, cos, pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets/characters/swordsman/sword-wind/v001')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
s=bpy.context.scene
s.render.engine='CYCLES'; s.cycles.samples=8; s.cycles.transparent_max_bounces=64
s.render.resolution_x=768; s.render.resolution_y=800; s.render.resolution_percentage=100
s.render.fps=24; s.frame_start=1; s.frame_end=192
s.render.film_transparent=True; s.render.image_settings.file_format='PNG'; s.render.image_settings.color_mode='RGBA'
s.view_settings.view_transform='Standard'; s.view_settings.look='None'
im=bpy.data.images.load(os.path.join(OUT,'layer_atlas.png')); im.pack()
mat=bpy.data.materials.new('Packed illustrated RGBA atlas'); mat.use_nodes=True
n=mat.node_tree.nodes; n.clear(); l=mat.node_tree.links
t=n.new('ShaderNodeTexImage'); t.image=im
e=n.new('ShaderNodeEmission'); tr=n.new('ShaderNodeBsdfTransparent'); mix=n.new('ShaderNodeMixShader'); out=n.new('ShaderNodeOutputMaterial')
l.new(t.outputs['Color'],e.inputs[0]); l.new(t.outputs['Alpha'],mix.inputs[0]); l.new(tr.outputs[0],mix.inputs[1]); l.new(e.outputs[0],mix.inputs[2]); l.new(mix.outputs[0],out.inputs[0])
W,H=im.size; PW=W/3
def xy(px,py,z):return ((px-350)/80,(440-py)/80,z)
def layer(name,panel,shift,z,nx=90,ny=135,ymin=0,ymax=None):
    ymax=H if ymax is None else ymax
    verts=[xy(2+i/nx*(PW-4)+shift,ymin+j/ny*(ymax-ymin),z) for j in range(ny+1) for i in range(nx+1)]
    faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); s.collection.objects.link(ob); me.materials.append(mat)
    uv=me.uv_layers.new()
    for p in me.polygons:
        for li in p.loop_indices:
            v=me.loops[li].vertex_index; u=(v%(nx+1))/nx; vv=(v//(nx+1))/ny
            uv.data[li].uv=((panel*PW+2+u*(PW-4))/W,1-(ymin+vv*(ymax-ymin))/H)
    return ob,verts
cape,cv=layer('01 Cape • waist pinned / wind at torn tips',2,175,-.04)
body,bv=layer('02 Body • reconstructed beneath sword arm',0,0,0)
upper,_=layer('03 Upper sword arm • fixed shoulder',1,-55,.06,ymax=310)
arm,av=layer('04 Forearm hand and sword • independent elbow pivot',1,-55,.04,ymin=300)
# Armature evaluates reliably in viewport and renders, with rigid forearm weighting.
ad=bpy.data.armatures.new('Sword arm skeleton')
rig=bpy.data.objects.new('CONTROLS • sword arm',ad); s.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone=ad.edit_bones.new('Forearm and sword'); bone.head=xy(235,300,.04); bone.tail=xy(235,420,.04)
bpy.ops.object.mode_set(mode='POSE')
pb=rig.pose.bones['Forearm and sword']; pb.rotation_mode='XYZ'
for f,v in [(1,1),(25,1),(73,0),(121,0),(169,1),(193,1)]:
    pb.rotation_euler.z=-2.35619449*v; pb.keyframe_insert(data_path='rotation_euler',frame=f)
bpy.ops.object.mode_set(mode='OBJECT')
group=arm.vertex_groups.new(name='Forearm and sword')
for i,(x,y,z) in enumerate(av):
    w=1.0
    if w:group.add([i],w,'REPLACE')
mod=arm.modifiers.new('Smooth elbow / independent sword arm','ARMATURE'); mod.object=rig; mod.use_deform_preserve_volume=True
cape.shape_key_add(name='Basis')
for name,phase in [('Wind wave A',0),('Wind wave B',1.7)]:
    k=cape.shape_key_add(name=name); k.slider_min=-1
    for i,(x,y,z) in enumerate(cv):
        px=x*80+350; py=440-y*80
        w=max(0,min(1,(py-350)/420))**1.4
        k.data[i].co.x+=.43*w*sin(py/90+phase)
        k.data[i].co.y+=.28*w*sin(px/105+phase)
    for f in range(1,194,4):
        p=2*pi*(f-1)/192
        k.value=.72*sin(3*p+phase)+.22*sin(5*p+phase); k.keyframe_insert(data_path='value',frame=f)
    k.value=.72*sin(phase)+.22*sin(phase); k.keyframe_insert(data_path='value',frame=193)
bpy.ops.object.camera_add(location=(-.8,1.45,30)); s.camera=bpy.context.object
s.camera.data.type='ORTHO'; s.camera.data.ortho_scale=18
for name,f in [('Sword raised',1),('Lower smoothly',25),('Reference pose / sword down',73),('Hold down',121),('Return raised',169)]:s.timeline_markers.new(name,frame=f)
notes=bpy.data.texts.new('READ ME')
notes.write('SWORDSMAN / SWORD WIND v001\n8 seconds, 24fps, frames 1–192; 193 closes loop.\nIndependent body, sword-arm and cape objects; packed RGBA atlas.\nSelect CONTROLS to edit the forearm bone; cape shape keys control layered wind.\nIllustrated 2.5D puppet, not a volumetric 3D model. Hidden artwork reconstructed from reference.\nOriginal and prior assets preserved; game integration unchanged.\n')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'swordsman_sword_wind.blend'))
for frame,name in [(1,'raised.png'),(49,'transition.png'),(97,'lowered.png')]:
    s.frame_set(frame); s.render.filepath=os.path.join(OUT,name); bpy.ops.render.render(write_still=True)
os.makedirs(os.path.join(OUT,'frames'),exist_ok=True)
s.render.resolution_percentage=64
s.render.filepath=os.path.join(OUT,'frames/frame_')
if os.environ.get('SWORDSMAN_RENDER')=='1':bpy.ops.render.render(animation=True)
