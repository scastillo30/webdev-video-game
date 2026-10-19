import bpy, math, os
from math import exp, sin, pi

OUT = os.path.dirname(os.path.abspath(__file__))
SOURCE = '/var/folders/ml/5tx0mhcj3dg25qwz72bmbb2m0000gn/T/codex-clipboard-f2526e97-8295-4c4c-9209-d291c13763d7.png'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 1152
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 192
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

nx, ny = 200, 300
verts = [((i/nx-.5)*8, (j/ny-.5)*12, 0) for j in range(ny+1) for i in range(nx+1)]
faces = [(j*(nx+1)+i, j*(nx+1)+i+1, (j+1)*(nx+1)+i+1, (j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
mesh = bpy.data.meshes.new('Illustration deformation grid')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Character • animated illustration', mesh)
scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
uv = mesh.uv_layers.new(name='Original illustration UV')
for poly in mesh.polygons:
    for li in poly.loop_indices:
        co = mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv = (co.x/8+.5, co.y/12+.5)
mat = bpy.data.materials.new('Original artwork • unlit colors')
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
tex = nodes.new('ShaderNodeTexImage')
tex.image = bpy.data.images.load(SOURCE)
tex.image.pack()
em = nodes.new('ShaderNodeEmission')
output = nodes.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(tex.outputs['Color'], em.inputs['Color'])
mat.node_tree.links.new(em.outputs[0], output.inputs['Surface'])
obj.data.materials.append(mat)
obj.shape_key_add(name='Basis')
breath = obj.shape_key_add(name='Slow chest and shoulders')
cape_a = obj.shape_key_add(name='Cape weighted breeze A')
cape_b = obj.shape_key_add(name='Cape weighted breeze B')
ready = obj.shape_key_add(name='Sword wrist anticipation')
smile = obj.shape_key_add(name='Restrained smile')
for key in (cape_a,cape_b): key.slider_min=-1
for idx,(x,y,z) in enumerate(verts):
    u,v=x/8+.5,y/12+.5
    b=exp(-((u-.49)/.16)**4-((v-.64)/.135)**4)
    breath.data[idx].co.x+=(u-.49)*.025*b
    breath.data[idx].co.y+=.018*b
    # Restrict breeze to the outer right cape, away from the sword and boots.
    c=exp(-((u-.90)/.075)**4-((v-.40)/.20)**4)
    weight=max(0,min(1,(.73-v)/.35))
    cape_a.data[idx].co.x+=.032*c*weight*sin(v*24)
    cape_a.data[idx].co.y+=.014*c*weight
    cape_b.data[idx].co.x+=.019*c*weight*sin(v*39+1.2)
    cape_b.data[idx].co.y+=.009*c*weight*sin(v*22)
    hand=exp(-((u-.684)/.047)**4-((v-.594)/.039)**4)
    ready.data[idx].co.x+=.006*hand
    ready.data[idx].co.y+=.009*hand
    mouth=exp(-((u-.503)/.035)**4-((v-.865)/.008)**4)
    smile.data[idx].co.y+=.010*mouth*min(1,abs(u-.503)/.022)
for frame in range(1,194):
    phase=2*pi*(frame-1)/192
    breath.value=.5-.5*math.cos(phase*2)
    cape_a.value=.65*sin(phase+0.3)+.25*sin(phase*3+0.8)
    cape_b.value=.7*sin(phase*2+1.1)+.2*sin(phase*3)
    ready.value=.55+.18*sin(phase+.6)
    smile.value=.7+.15*sin(phase-.4)
    for key in (breath,cape_a,cape_b,ready,smile):
        key.keyframe_insert(data_path='value',frame=frame)
bpy.ops.object.camera_add(location=(0,0,15))
camera = bpy.context.object
camera.name = 'Illustration camera'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 12
scene.camera = camera
scene.world.color = (.8,.7,.5)
scene.frame_set(31)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.shading.type = 'MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
notes = bpy.data.texts.new('READ ME')
notes.write('Cinematic illustrated idle | 192 frames / 24 fps / 8 seconds.\nFrame 193 repeats frame 1 and is excluded from export.\nOriginal artwork packed. Fixed camera, emission material retains painted lighting.\n2.5D localized deformation, not a volumetric character or cloth simulation.\nThe hand and mouth use small image warps; independent fingers and hidden teeth are not available.\nParchment immediately beside the cape may move slightly with its silhouette.\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_cinematic_idle.blend'))
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT,'cinematic_idle_preview.png')
bpy.ops.render.render(write_still=True)

scene.render.resolution_percentage=100
scene.render.image_settings.media_type='VIDEO'
scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4'
scene.render.ffmpeg.codec='H264'
scene.render.ffmpeg.constant_rate_factor='MEDIUM'
scene.render.filepath=os.path.join(OUT,'cinematic_idle_8s.mp4')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_cinematic_idle.blend'))
bpy.ops.render.render(animation=True)
