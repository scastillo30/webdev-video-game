"""Export the approved smile/grasp loop with a packed, registered alpha matte."""
import bpy, os
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'character_smile_grasp.blend'))
scene=bpy.context.scene
obj=next(o for o in scene.objects if o.type=='MESH')
mat=obj.data.materials[0]
n=mat.node_tree.nodes;l=mat.node_tree.links
em=next(x for x in n if x.type=='EMISSION')
output=next(x for x in n if x.type=='OUTPUT_MATERIAL')
mask=n.new('ShaderNodeTexImage');mask.name='Registered character silhouette alpha'
mask.image=bpy.data.images.load(str(OUT/'character_alpha_cutout.png'));mask.image.pack()
alpha=n.new('ShaderNodeMath');alpha.operation='MULTIPLY_ADD';alpha.use_clamp=True
alpha.inputs[1].default_value=1/.96;alpha.inputs[2].default_value=-.02/.96
# Contract the generated matte by three source pixels to remove parchment fringes.
uv=n.new('ShaderNodeTexCoord')
combined=mask.outputs['Alpha']
for dx,dy in [(-3,0),(3,0),(0,-3),(0,3),(-2,-2),(-2,2),(2,-2),(2,2)]:
    offset=n.new('ShaderNodeVectorMath');offset.operation='ADD'
    offset.inputs[1].default_value=(dx/1024,dy/1536,0)
    l.new(uv.outputs['UV'],offset.inputs[0])
    sample=n.new('ShaderNodeTexImage');sample.image=mask.image
    l.new(offset.outputs[0],sample.inputs['Vector'])
    minimum=n.new('ShaderNodeMath');minimum.operation='MINIMUM'
    l.new(combined,minimum.inputs[0]);l.new(sample.outputs['Alpha'],minimum.inputs[1])
    combined=minimum.outputs[0]
l.new(combined,alpha.inputs[0])
transparent=n.new('ShaderNodeBsdfTransparent')
mix=n.new('ShaderNodeMixShader')
l.new(alpha.outputs[0],mix.inputs[0]);l.new(transparent.outputs[0],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],output.inputs['Surface'])
mat.surface_render_method='DITHERED'
scene.render.film_transparent=True
scene.render.image_settings.media_type='IMAGE'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=384;scene.render.resolution_y=576;scene.render.resolution_percentage=100
scene.frame_start=1;scene.frame_end=192;scene.render.fps=24
frames=OUT/'smile_grasp_web_frames';frames.mkdir(exist_ok=True)
scene.render.filepath=str(frames/'frame_')
scene.frame_set(80)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'character_smile_grasp_transparent.blend'))
bpy.ops.render.render(animation=True)
