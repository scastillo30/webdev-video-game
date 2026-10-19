"""Reproducible, packed illustration rig. Blender 5.2; no external addons."""
import bpy, math, os, json
from math import exp, sin, cos, pi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/characters/healer/crosier-victory/v001')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = 16
s.cycles.use_denoising = False
s.render.resolution_x = 1024
s.render.resolution_y = 1536
s.render.resolution_percentage = 100
s.render.fps = 24
s.frame_start, s.frame_end = 1, 192
s.render.film_transparent = True
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.render.image_settings.color_depth = '8'
s.view_settings.view_transform = 'Standard'
s.view_settings.look = 'None'
s.render.filepath = os.path.join(OUT, 'frames/frame_')
s.world.color = (0,0,0)
nx, ny = 160, 240
verts = [((i/nx-.5)*10, (j/ny-.5)*15, 0) for j in range(ny+1) for i in range(nx+1)]
faces = [(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
mesh = bpy.data.meshes.new('Healer faithful illustration mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
o = bpy.data.objects.new('Healer • breathing / victory / cloth',mesh)
s.collection.objects.link(o)
uv = mesh.uv_layers.new(name='Reference UV')
for p in mesh.polygons:
    for li in p.loop_indices:
        co=mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv=(co.x/10+.5,co.y/15+.5)
m=bpy.data.materials.new('Original painted colors + soft blue spill')
m.use_nodes=True
n=m.node_tree.nodes; n.clear(); l=m.node_tree.links
tex=n.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(os.path.join(OUT,'reference_original.png')); tex.image.pack()
matte=n.new('ShaderNodeTexImage'); matte.image=bpy.data.images.load(os.path.join(OUT,'character_cutout.png')); matte.image.pack()
em=n.new('ShaderNodeEmission'); l.new(tex.outputs['Color'],em.inputs['Color'])
tr=n.new('ShaderNodeBsdfTransparent'); mix=n.new('ShaderNodeMixShader')
l.new(matte.outputs['Alpha'],mix.inputs[0]); l.new(tr.outputs[0],mix.inputs[1]); l.new(em.outputs[0],mix.inputs[2])
out=n.new('ShaderNodeOutputMaterial'); l.new(mix.outputs[0],out.inputs[0]); o.data.materials.append(m)
o.shape_key_add(name='Basis')
breath=o.shape_key_add(name='Gentle breathing')
cloth=o.shape_key_add(name='Attached fabric breeze')
hand=o.shape_key_add(name='Victory wrist sway • intact V fingers')
cloth.slider_min=hand.slider_min=-1
for idx,(x,y,z) in enumerate(verts):
    u,v=x/10+.5,y/15+.5
    b=exp(-((u-.51)/.17)**4-((v-.66)/.15)**4)
    breath.data[idx].co.x+=(u-.51)*.025*b
    breath.data[idx].co.y+=.018*b
    # Cloth influence fades to zero at waist/shoulder attachments.
    c=exp(-((u-.74)/.09)**4-((v-.39)/.095)**4)+exp(-((u-.33)/.07)**4-((v-.40)/.09)**4)
    vest=exp(-((u-.66)/.07)**4-((v-.69)/.08)**4)
    cloth.data[idx].co.x+=.035*c+.010*vest
    cloth.data[idx].co.y+=.014*c
    # Rigid local hand rotation; a smooth transition is confined to wrist.
    w=exp(-((u-.726)/.105)**8-((v-.80)/.10)**8)
    dx,dy=x-1.36,y-3.46
    a=.012*w
    hand.data[idx].co.x+=dx*(cos(a)-1)-dy*sin(a)+.012*w
    hand.data[idx].co.y+=dx*sin(a)+dy*(cos(a)-1)
# Transparent radial blue radiance, behind the original crosier details.
size=256
im=bpy.data.images.new('Soft blue radiance • straight alpha',width=size,height=size,alpha=True)
pixels=[]
for j in range(size):
    for i in range(size):
        r=((i/(size-1)-.5)**2+(j/(size-1)-.5)**2)**.5*2
        a=exp(-r*r*6)*max(0,1-r)**2*.65
        pixels.extend((.10,.58,1.0,a))
im.pixels=pixels; im.pack()
def plane(name,cx,cy,width,height,z,image):
    bpy.ops.mesh.primitive_plane_add(size=2,location=((cx-.5)*10,(cy-.5)*15,z))
    ob=bpy.context.object; ob.name=name; ob.scale=(width/2,height/2,1)
    ma=bpy.data.materials.new(name); ma.use_nodes=True
    ns=ma.node_tree.nodes; ns.clear(); ls=ma.node_tree.links
    t=ns.new('ShaderNodeTexImage'); t.image=image
    e=ns.new('ShaderNodeEmission'); ls.new(t.outputs['Color'],e.inputs[0])
    transparent=ns.new('ShaderNodeBsdfTransparent'); mx=ns.new('ShaderNodeMixShader')
    strength=ns.new('ShaderNodeMath'); strength.operation='MULTIPLY'; strength.inputs[1].default_value=1
    ls.new(t.outputs['Alpha'],strength.inputs[0]); ls.new(strength.outputs[0],mx.inputs[0]); ls.new(transparent.outputs[0],mx.inputs[1]); ls.new(e.outputs[0],mx.inputs[2])
    output=ns.new('ShaderNodeOutputMaterial'); ls.new(mx.outputs[0],output.inputs[0]); ob.data.materials.append(ma)
    return strength.inputs[1]
halo=plane('Crosier blue aura',.190,.897,1.95,1.95,-.025,im)
core=plane('Crosier blue illumination',.190,.897,1.05,1.05,.025,im)
spill=plane('Gentle blue reflection near holding hand',.260,.634,.63,.68,.03,im)
fabricspill=plane('Subtle reflected blue on sleeve',.345,.611,.48,.42,.03,im)
# Evaluate the exact periodic functions at every frame, including closure frame 193.
for f in range(1,194):
    t=2*pi*(f-1)/192
    breath.value=.5-.5*cos(2*t)
    cloth.value=.65*sin(t)+.20*sin(2*t)
    hand.value=.75*sin(t)
    for k in (breath,cloth,hand): k.keyframe_insert('value',frame=f)
    pulse=.40+.48*(.5-.5*cos(t))+.12*(.5-.5*cos(3*t))
    for socket,scale in ((halo,1),(core,.70),(spill,.11),(fabricspill,.07)):
        socket.default_value=pulse*scale
        socket.keyframe_insert('default_value',frame=f)
bpy.ops.object.camera_add(location=(0,0,20))
s.camera=bpy.context.object; s.camera.name='Fixed full character camera'; s.camera.data.type='ORTHO'; s.camera.data.ortho_scale=15.6
s.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D': area.spaces.active.region_3d.view_perspective='CAMERA'
notes=bpy.data.texts.new('README • Healer crosier victory')
notes.write('8 seconds / 24 fps / frames 1–192; closure at 193. Film Transparent; RGBA PNG.\nFaithful 2.5D illustration deformation, not a volumetric character or cloth simulation.\nV fingers remain in original painted anatomy; local wrist rotation preserves finger separation.\nAll textures packed. Original reference retained beside this file.\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'healer_crosier_victory.blend'))
if os.environ.get('HEALER_PREVIEW'):
    s.frame_set(97); s.render.filepath=os.path.join(OUT,'preview.png'); bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
