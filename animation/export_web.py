"""Render the layered Blender character with alpha for the local web game."""
import bpy, os
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'character_pointing.blend'))
scene=bpy.context.scene
body=bpy.data.objects['01 • Body and reconstructed coat']
mat=body.data.materials[0]
n=mat.node_tree.nodes
n.clear()
tex=n.new('ShaderNodeTexImage')
tex.image=bpy.data.images.load(os.path.join(OUT,'pointing_assets','body_transparent.png'))
tex.image.pack()
em=n.new('ShaderNodeEmission')
transparent=n.new('ShaderNodeBsdfTransparent')
mix=n.new('ShaderNodeMixShader')
output=n.new('ShaderNodeOutputMaterial')
l=mat.node_tree.links
l.new(tex.outputs['Color'],em.inputs['Color'])
l.new(tex.outputs['Alpha'],mix.inputs[0])
l.new(transparent.outputs[0],mix.inputs[1])
l.new(em.outputs[0],mix.inputs[2])
l.new(mix.outputs[0],output.inputs[0])
mat.surface_render_method='DITHERED'
# Generated cutouts encode nearly opaque interiors at 253/255. Make those
# interiors opaque in the shader to avoid temporal dithering and large files.
for m in {m for obj in scene.objects if obj.type=='MESH' for m in obj.data.materials}:
    nodes=m.node_tree.nodes
    texture=next((node for node in nodes if node.type=='TEX_IMAGE'),None)
    shader_mix=next((node for node in nodes if node.type=='MIX_SHADER'),None)
    if texture and shader_mix:
        alpha=nodes.new('ShaderNodeMath')
        alpha.operation='MULTIPLY_ADD'
        alpha.inputs[1].default_value=1/.96
        alpha.inputs[2].default_value=-.02/.96
        alpha.use_clamp=True
        m.node_tree.links.new(texture.outputs['Alpha'],alpha.inputs[0])
        m.node_tree.links.new(alpha.outputs[0],shader_mix.inputs[0])
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=384
scene.render.resolution_y=576
scene.render.resolution_percentage=100
frames=os.path.join(OUT,'web_frames')
os.makedirs(frames,exist_ok=True)
scene.render.filepath=os.path.join(frames,'frame_')
scene.frame_set(52)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_pointing_transparent.blend'))
bpy.ops.render.render(animation=True)
