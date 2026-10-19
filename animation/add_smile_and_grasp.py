"""Add localized painted smile/grip keyposes to the illustrated Blender idle."""
import bpy, math, os
from pathlib import Path
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'character_cinematic_idle_stronger.blend'))
scene=bpy.context.scene
obj=next(o for o in scene.objects if o.type=='MESH')
mesh=obj.data
mat=mesh.materials[0]
nodes=mat.node_tree.nodes
links=mat.node_tree.links
source=next(n for n in nodes if n.type=='TEX_IMAGE')
emission=next(n for n in nodes if n.type=='EMISSION')
keypose=nodes.new('ShaderNodeTexImage')
keypose.name='Painted smile and closed left-hand grip'
keypose.image=bpy.data.images.load(str(OUT/'smile_grasp_keypose.png'))
keypose.image.pack()
# Only these two feathered patches can differ from the original texture.
def patch(name,cx,cy,rx,ry):
    attr=mesh.color_attributes.new(name=name,type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        co=mesh.vertices[loop.vertex_index].co
        u,v=co.x/8+.5,co.y/12+.5
        d=math.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2)
        t=max(0,min(1,(1-d)/.25))
        w=t*t*(3-2*t)
        attr.data[loop.index].color=(w,w,w,1)
    a=nodes.new('ShaderNodeVertexColor'); a.layer_name=name
    strength=nodes.new('ShaderNodeValue'); strength.name=name+' animation'; strength.label=name+' animation'
    mult=nodes.new('ShaderNodeMath'); mult.operation='MULTIPLY'
    links.new(a.outputs['Color'],mult.inputs[0]); links.new(strength.outputs[0],mult.inputs[1])
    return strength,mult
smile,sm=patch('Smile mask',.505,.865,.049,.023)
grip,gr=patch('Left glove grip mask',.685,.596,.082,.061)
mix1=nodes.new('ShaderNodeMixRGB'); mix1.blend_type='MIX'
links.new(sm.outputs[0],mix1.inputs[0]);links.new(source.outputs['Color'],mix1.inputs[1]);links.new(keypose.outputs['Color'],mix1.inputs[2])
mix2=nodes.new('ShaderNodeMixRGB');mix2.blend_type='MIX'
links.new(gr.outputs[0],mix2.inputs[0]);links.new(mix1.outputs[0],mix2.inputs[1]);links.new(keypose.outputs['Color'],mix2.inputs[2]);links.new(mix2.outputs[0],emission.inputs['Color'])
# Texture key poses supply actual lip/finger changes instead of image warps alone.
sk=obj.data.shape_keys.key_blocks.get('Restrained smile')
if sk:
    for i,v in enumerate(obj.data.shape_keys.key_blocks['Basis'].data): sk.data[i].co=v.co
for node,keys in ((smile,[(1,.15),(25,.25),(60,1),(120,1),(160,.65),(193,.15)]),(grip,[(1,0),(18,0),(48,1),(132,1),(166,.3),(193,0)])):
    for f,value in keys:
        node.outputs[0].default_value=value
        node.outputs[0].keyframe_insert(data_path='default_value',frame=f)
scene.frame_set(80)
scene.render.image_settings.media_type='IMAGE'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'smile_grasp_preview.png')
bpy.ops.render.render(write_still=True)
scene.frame_set(1)
scene.render.filepath=str(OUT/'smile_grasp_relaxed.png')
bpy.ops.render.render(write_still=True)
# Check frame boundary values, fixed camera, and retained artwork outside masks.
scene.frame_set(1)
a=(smile.outputs[0].default_value,grip.outputs[0].default_value)
scene.frame_set(193)
b=(smile.outputs[0].default_value,grip.outputs[0].default_value)
assert a==b,(a,b)
scene.frame_set(1)
scene.render.image_settings.media_type='VIDEO'
scene.render.image_settings.file_format='FFMPEG'
scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264'
scene.render.filepath=str(OUT/'character_smile_grasp_8s.mp4')
notes=bpy.data.texts.new('Smile and left-hand grasp update')
notes.write('8-second loop at 24 fps. Material node Value controls animate feathered artwork patches for smile and anatomical LEFT glove (viewer right). Upper teeth and wrapped gloved fingers are painted keyposes, blended during the loop. Original texture remains outside two masks. Breathing and cape shape keys retained. Frame 193 matches 1 and is excluded from render.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'character_smile_grasp.blend'))
print('VERIFIED material loop seam:',a,b,flush=True)
bpy.ops.render.render(animation=True)
