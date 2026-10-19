"""Layered illustrated pointing gesture, using regenerated occluded artwork."""
import bpy, math, os
from math import exp, sin, cos, pi
OUT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(OUT, 'pointing_assets')
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'character_glasses_adjustment.blend'))
scene = bpy.context.scene
body = next(o for o in scene.objects if o.type == 'MESH')
body.name = '01 • Body and reconstructed coat'
for mat in body.data.materials:
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE':
            node.image = bpy.data.images.load(os.path.join(ASSETS,'body_clean_plate.png'))
            node.image.pack()
keys = body.data.shape_keys.key_blocks
body.shape_key_remove(keys['Small forearm bend'])
body.shape_key_remove(keys['Glasses adjustment'])

def material(name, path):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.surface_render_method = 'DITHERED'
    n = m.node_tree.nodes
    n.clear()
    t = n.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(path)
    t.image.pack()
    e = n.new('ShaderNodeEmission')
    tr = n.new('ShaderNodeBsdfTransparent')
    mix = n.new('ShaderNodeMixShader')
    out = n.new('ShaderNodeOutputMaterial')
    links=m.node_tree.links
    links.new(t.outputs['Color'],e.inputs['Color'])
    links.new(t.outputs['Alpha'],mix.inputs[0])
    links.new(tr.outputs[0],mix.inputs[1])
    links.new(e.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],out.inputs[0])
    return m

nx, ny = 160, 240
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)
def arm_position(i,j):
    px=340+(i/nx*1024-610)*.40
    py=325+((1-j/ny)*1536-350)*.40
    root=(1-smooth(360,490,py))*smooth(250,335,px)
    px+=32*root
    py-=8*root
    return ((px/1024-.5)*8,(.5-py/1536)*12,.025)
vertices=[arm_position(i,j) for j in range(ny+1) for i in range(nx+1)]
faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
mesh=bpy.data.meshes.new('Independent arm deformation grid')
mesh.from_pydata(vertices,[],faces)
mesh.update()
arm=bpy.data.objects.new('02 • Right sleeve, forearm and pointing hand',mesh)
scene.collection.objects.link(arm)
uv=mesh.uv_layers.new(name='Registered arm UV')
for p in mesh.polygons:
    for li in p.loop_indices:
        vi=mesh.loops[li].vertex_index
        uv.data[li].uv=((vi%(nx+1))/nx,(vi//(nx+1))/ny)
mesh.materials.append(material('Pointing arm • transparent cutout', os.path.join(ASSETS,'right_arm_pointing.png')))
arm.shape_key_add(name='Basis')
lower=arm.shape_key_add(name='Lower and relax forearm')
cloth=arm.shape_key_add(name='Sleeve follow through')
reach=arm.shape_key_add(name='Point toward viewer')
breath=arm.shape_key_add(name='Shoulder follows torso breathing')
for i,(x,y,z) in enumerate(vertices):
    px=(x/8+.5)*1024
    py=(.5-y/12)*1536
    # Lowering smoothly leaves the shoulder attachment fixed.
    anchor=smooth(385,495,py)
    lower.data[i].co.x -= .13*anchor
    lower.data[i].co.y -= .35*anchor
    cuff=exp(-((px-275)/80)**4-((py-460)/75)**4)
    cloth.data[i].co.x += .025*cuff*anchor
    cloth.data[i].co.y -= .035*cuff*anchor
    hand=exp(-((px-228)/65)**4-((py-537)/60)**4)
    # Small screen-space enlargement suggests the hand reaching forward.
    reach.data[i].co.x += (px-228)/128*.07*hand
    reach.data[i].co.y -= (py-537)/128*.07*hand
    u,v=px/1024,1-py/1536
    b=exp(-((u-.48)/.18)**4-((v-.65)/.20)**4)
    breath.data[i].co.x+=(u-.48)*.045*b
    breath.data[i].co.y+=.035*b

for key, poses in (
    (lower, [(1,1),(12,1),(30,.25),(42,0),(72,0),(91,.12),(112,1),(145,1)]),
    (cloth, [(1,0),(16,0),(32,1),(43,.3),(52,.5),(68,.35),(89,.8),(112,.2),(125,0),(145,0)]),
    (reach, [(1,0),(25,0),(43,1),(52,.8),(74,.85),(93,0),(145,0)])):
    for frame,value in poses:
        key.value=value
        key.keyframe_insert(data_path='value',frame=frame)

# Match shoulder motion to torso breathing so the attachment does not slide.
for frame in range(1,146,5):
    b=.5-.5*cos(2*pi*(min(frame,121)-1)/120)
    breath.value=b
    breath.keyframe_insert(data_path='value',frame=frame)

# A foreground coat/strap patch hides the sleeve's attachment edge, as a real
# sleeve sits beneath the shoulder seam and backpack strap.
plate=bpy.data.meshes.new('Shoulder seam and backpack strap occluder')
points=[(342,290),(378,285),(416,319),(446,381),(424,440),(387,477),(365,442),(374,381),(354,341)]
plate.from_pydata([((px/1024-.5)*8,(.5-py/1536)*12,.055) for px,py in points],[],[tuple(range(len(points)))])
plate.update()
seam=bpy.data.objects.new('03 • Shoulder seam over sleeve',plate)
scene.collection.objects.link(seam)
plate.materials.append(body.data.materials[0])
puv=plate.uv_layers.new(name='Registered coat UV')
for poly in plate.polygons:
    for li in poly.loop_indices:
        px,py=points[plate.loops[li].vertex_index]
        puv.data[li].uv=(px/1024,1-py/1536)
seam.shape_key_add(name='Basis')
sb=seam.shape_key_add(name='Breathing')
for i,(px,py) in enumerate(points):
    u,v=px/1024,1-py/1536
    b=exp(-((u-.48)/.18)**4-((v-.65)/.20)**4)
    sb.data[i].co.x+=(u-.48)*.045*b
    sb.data[i].co.y+=.035*b
for frame in range(1,146,5):
    sb.value=.5-.5*cos(2*pi*(min(frame,121)-1)/120)
    sb.keyframe_insert(data_path='value',frame=frame)
scene.frame_end=144
scene.render.fps=24
scene.frame_set(52)
for name,frame in [('Ready',1),('Lift and extend',16),('Point at viewer',43),('Hold',60),('Relax',94)]:
    scene.timeline_markers.new(name,frame=frame)
readme=bpy.data.texts.get('READ ME')
readme.clear()
readme.write('LAYERED POINTING GESTURE | 144 frames / 24fps / 6 seconds\nAnatomical right hand = viewer left.\n01 Body: regenerated clean plate reconstructs coat/background behind removed original arm.\n02 Arm: independent transparent illustrated pointing arm, with new foreshortened hand and sleeve folds.\nControls: Lower and relax forearm; Sleeve follow through; Point toward viewer.\nHand starts slightly lowered, rises, points at the viewer, holds, and relaxes.\nThis is a 2D illustrated puppet. It does not have full 3D finger articulation.\nAll artwork packed. Previous versions retained separately.\n')
for o in scene.objects:o.select_set(False)
arm.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_pointing.blend'))
for frame,name in [(52,'pointing_preview.png'),(1,'pointing_shoulder_lowered.png'),(30,'pointing_shoulder_transition.png')]:
    scene.frame_set(frame)
    scene.render.filepath=os.path.join(OUT,name)
    bpy.ops.render.render(write_still=True)
