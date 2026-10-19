import bpy, math, os
from math import exp, sin, pi

OUT = os.path.dirname(os.path.abspath(__file__))
SOURCE = '/var/folders/ml/5tx0mhcj3dg25qwz72bmbb2m0000gn/T/codex-clipboard-b6dccb1c-7cf0-4ddb-ac42-10a8a06c821c.png'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 768
scene.render.resolution_y = 1152
scene.render.resolution_percentage = 100
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 120
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

nx, ny = 240, 360
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
breath = obj.shape_key_add(name='Breathing')
scarf = obj.shape_key_add(name='Scarf breeze')
coat = obj.shape_key_add(name='Coat breeze')
arm = obj.shape_key_add(name='Small forearm bend')
glasses = obj.shape_key_add(name='Glasses adjustment')
scarf.slider_min = coat.slider_min = -1
for idx, (x,y,z) in enumerate(verts):
    u, v = x/8+.5, y/12+.5
    # Broad, gentle deformation keeps the single painted image intact.
    b = exp(-((u-.48)/.18)**4 - ((v-.65)/.20)**4)
    breath.data[idx].co.x += (u-.48)*.045*b
    breath.data[idx].co.y += .035*b
    s = exp(-((u-.785)/.14)**4 - ((v-.755)/.066)**4)
    scarf.data[idx].co.y += .065*s*max(0,(u-.59)/.30)
    scarf.data[idx].co.x += .018*s
    c = exp(-((u-.82)/.14)**4-((v-.365)/.12)**4) + exp(-((u-.17)/.09)**4-((v-.32)/.14)**4)
    coat.data[idx].co.x += .024*c
    coat.data[idx].co.y += .012*c
    # Viewer-right forearm: modest bend inward with a soft falloff at the elbow.
    a = exp(-((u-.746)/.059)**4 - ((v-.505)/.068)**4)
    tip = max(0, min(1, (.59-v)/.12))
    arm.data[idx].co.x -= .105*a*tip
    arm.data[idx].co.y += .095*a*tip
    # Move both lenses and bridge together by roughly 1-2 source pixels.
    g = exp(-((u-.485)/.065)**8 - ((v-.904)/.014)**8)
    glasses.data[idx].co.x -= .009*g
    glasses.data[idx].co.y += .012*g
for frame in range(1,122,5):
    phase = 2*pi*(frame-1)/120
    breath.value = .5-.5*math.cos(phase)
    scarf.value = sin(phase*2)
    coat.value = sin(phase+pi/3)
    for key in (breath, scarf, coat):
        key.keyframe_insert(data_path='value',frame=frame)

# A single restrained adjustment, then settle back into the idle loop.
for key, poses in ((arm, [(1,0),(20,0),(38,.65),(48,1),(60,.85),(80,0),(121,0)]),
                   (glasses, [(1,0),(38,0),(46,1),(51,.55),(56,.8),(68,0),(121,0)])):
    for frame, value in poses:
        key.value = value
        key.keyframe_insert(data_path='value',frame=frame)

bpy.ops.object.camera_add(location=(0,0,15))
camera = bpy.context.object
camera.name = 'Illustration camera'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 12
scene.camera = camera
scene.world.color = (.8,.7,.5)
scene.frame_set(48)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.overlay.show_overlays = False
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
notes = bpy.data.texts.new('READ ME')
notes.write('Illustrated idle loop | 120 frames / 24 fps / 5 seconds\nPress Space in the viewport to play. Camera view: numpad 0.\nShape keys: Breathing, Scarf breeze, Coat breeze.\nThis uses a single textured deformation mesh; it is not a separated cutout rig.\nThe parchment near moving regions also deforms slightly.\nThe source artwork is packed into this project.\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_glasses_adjustment.blend'))
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT,'glasses_adjustment_preview.png')
bpy.ops.render.render(write_still=True)
