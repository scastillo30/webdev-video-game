"""Blender 5: original Commander mesh, articulated walk, four orthographic views.
Run: Blender --background --python animation/create_commander_directional_walk_v001.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/characters/commander/directional-walk/v001'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m
blue = mat('Commander cobalt', (.10,.20,.43))
gold = mat('Antique gold', (.78,.52,.19))
ivory = mat('Ivory tunic', (.87,.81,.64))
red = mat('Crimson cape', (.52,.055,.075))
skin = mat('Warm skin', (.78,.51,.31))
hair = mat('Sandy grey hair', (.59,.53,.37))
light = mat('Hair highlight', (.81,.75,.55))
dark = mat('Spectacles and eyes', (.055,.065,.09))
leather = mat('Brown gloves and boots', (.23,.12,.065))
steel = mat('Steel blade', (.51,.63,.69))

def pivot(name, pos, parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = pos
    return o

root = pivot('Commander_ROOT', (0,0,0))
body = pivot('Body_bob', (0,0,0), root)

def box(name, pos, size, material, parent=body, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.parent = parent
    o.location = pos
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Faceted edges', 'BEVEL'); mod.width=bevel; mod.segments=1
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o

# Front is -Y. Details are volumetric; the back never reuses the face.
box('Blue coat torso', (0,0,1.31), (.65,.39,.63), blue, bevel=.08)
box('Ivory shirt', (0,-.214,1.32), (.28,.035,.56), ivory)
for x in [-.19,.19]:
    box('Gold lapel', (x,-.24,1.45), (.055,.04,.42), gold)
box('Leather belt', (0,-.015,1.10), (.70,.43,.105), leather)
box('Gold buckle', (0,-.246,1.10), (.14,.045,.10), gold)
for x in [-.19,.19]:
    tail=box('Coat tail', (x,.055,.84), (.30,.39,.42), blue, bevel=.025)
    box('Gold hem', (x,.025,.635), (.30,.40,.045), gold)
box('Ivory front tabard', (0,-.23,.85), (.25,.04,.39), ivory)
box('Tabard gold emblem', (0,-.26,.83), (.07,.025,.15), gold)

legs=[]; arms=[]
for side,x in [('L',-.185),('R',.185)]:
    leg=pivot('Hip_'+side,(x,0,.91),root); legs.append(leg)
    box('Trouser_'+side,(0,0,-.19),(.24,.27,.43),dark,leg,.025)
    box('Boot_'+side,(0,-.045,-.59),(.28,.40,.40),leather,leg,.025)
    box('Boot cuff_'+side,(0,0,-.40),(.30,.31,.095),gold,leg)
    arm=pivot('Shoulder_'+side,(x*2.10,0,1.54),body); arms.append(arm)
    box('Sleeve_'+side,(0,0,-.18),(.24,.30,.42),blue,arm,.04)
    box('Gold cuff_'+side,(0,0,-.37),(.25,.31,.07),gold,arm)
    box('Glove_'+side,(0,-.015,-.48),(.21,.24,.20),leather,arm,.025)
    box('Epaulette_'+side,(0,0,.005),(.29,.34,.09),gold,arm,.02)

head=pivot('Head',(0,-.005,1.78),body)
box('Face',(0,-.01,.12),(.58,.43,.55),skin,head,.075)
box('Nose',(0,-.265,.09),(.10,.12,.10),skin,head,.02)
box('Grey beard',(0,-.20,-.075),(.39,.12,.19),hair,head,.03)
box('Smile',(0,-.274,-.055),(.17,.02,.035),ivory,head)
for x in [-.33,.33]: box('Ear',(x,0,.10),(.10,.14,.17),skin,head,.02)
for x in [-.145,.145]:
    # Frames, clear lenses: skin remains visible through each rectangle.
    for z in [.10,.27]: box('Glasses rim',(x,-.249,z),(.235,.035,.025),dark,head)
    for dx in [-.106,.106]: box('Glasses rim',(x+dx,-.249,.185),(.025,.035,.18),dark,head)
    box('Eye',(x,-.255,.19),(.045,.025,.045),dark,head)
box('Glasses bridge',(0,-.26,.205),(.07,.04,.025),dark,head)
for x in [-.29,.29]: box('Glasses temple',(x,-.10,.21),(.025,.30,.025),dark,head)
box('Hair cap',(0,.02,.41),(.61,.45,.18),hair,head,.045)
box('Back hair',(0,.20,.20),(.59,.12,.35),hair,head,.03)
tufts=[]
for i,(x,y,z) in enumerate([(-.23,-.09,.48),(-.08,-.07,.51),(.08,0,.50),(.22,.06,.46)]):
    p=pivot('Hair_follow_'+str(i),(x,y,z),head); tufts.append(p)
    o=box('Swept hair',(0,-.035,.015),(.19,.29,.12),light if i%2 else hair,p,.025)
    o.rotation_euler[1]=-.25

cape=pivot('Cape shoulder anchor',(0,.25,1.58),body)
box('Red shoulder mantle',(0,0,-.09),(.74,.14,.22),red,cape,.03)
cape_tip=pivot('Cape delayed follow',(0,.03,-.18),cape)
box('Crimson cape back',(0,.04,-.39),(.73,.10,.78),red,cape_tip,.025)
for x in [-.29,.29]:box('Cape gold piping',(x,.102,-.39),(.035,.025,.76),gold,cape_tip)
box('Cape gold clasp',(-.24,-.26,1.57),(.11,.055,.11),gold)
# Sword remains on Commander's left hip, including in separately rendered side views.
sword=pivot('Sheathed sword',(-.43,.09,1.07),root)
sword.rotation_euler[1]=-.18
box('Scabbard',(0,0,-.34),(.105,.12,.69),leather,sword)
box('Scabbard tip',(0,0,-.69),(.12,.13,.08),gold,sword)
box('Sword guard',(0,0,.045),(.28,.12,.055),gold,sword)
box('Sword grip',(0,0,.14),(.075,.085,.19),leather,sword)
box('Sword pommel',(0,0,.25),(.12,.11,.08),gold,sword)

scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.render.resolution_x=48; scene.render.resolution_y=64; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.display.shading.light='FLAT'
scene.display.shading.color_type='MATERIAL'; scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=False
scene.display.shading.show_object_outline=True; scene.display.shading.object_outline_color=(.04,.03,.05)
scene.display.render_aa='OFF'
scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(0,-6,3.35))
camera=bpy.context.object; camera.name='Orthographic sprite camera'; camera.data.type='ORTHO'; camera.data.ortho_scale=2.75
camera.rotation_euler=(Vector((0,0,1.12))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera
scene.render.fps=12; scene.frame_start=1; scene.frame_end=9
# Pose 0 is a neutral stance. Poses 1..8 are one walk cycle, repeat without duplicate end.
for f in range(1,10):
    t=(f-2)*math.tau/8
    stride=0 if f==1 else math.sin(t)
    body.location.z=0 if f==1 else .025*(1-math.cos(2*t))
    body.keyframe_insert('location',frame=f)
    for i,leg in enumerate(legs):
        leg.rotation_euler.x=(1 if i==0 else -1)*.48*stride
        leg.keyframe_insert('rotation_euler',frame=f)
    for i,arm in enumerate(arms):
        arm.rotation_euler.x=(-1 if i==0 else 1)*.37*stride
        arm.keyframe_insert('rotation_euler',frame=f)
    cape_tip.rotation_euler.x=0 if f==1 else .12+.09*math.sin(t-.7)
    cape_tip.rotation_euler.y=0 if f==1 else .055*math.cos(t-.7)
    cape_tip.keyframe_insert('rotation_euler',frame=f)
    for i,p in enumerate(tufts):
        p.rotation_euler.x=0 if f==1 else .12*math.sin(t-.8+i*.2)
        p.rotation_euler.y=0 if f==1 else .08*math.cos(t-.5)
        p.keyframe_insert('rotation_euler',frame=f)
scene.frame_set(1)
root['identity']='Commander: smiling grey-bearded glasses, blue/gold coat, red cape, sword. Not Rogue.'
scene['sprite_layout']='Rows down,left,right,up; columns neutral,walk0..walk7. 48x64 RGBA.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'commander_directional_walk.blend'))
for direction,angle in [('down',0),('left',-math.pi/2),('right',math.pi/2),('up',math.pi)]:
    root.rotation_euler.z=angle
    for f in range(1,10):
        scene.frame_set(f)
        scene.render.filepath=str(OUT/f'{direction}-{f-1:02}.png')
        bpy.ops.render.render(write_still=True)
print('COMMANDER_DIRECTIONAL_RENDER_COMPLETE')
