import bpy, json, os
s=bpy.context.scene
def state(frame):
    s.frame_set(frame)
    keys=bpy.data.objects['Healer • breathing / victory / cloth'].data.shape_keys.key_blocks
    shapes=[float(k.value) for k in keys]
    glow=[]
    for name in ('Crosier blue aura','Crosier blue illumination','Gentle blue reflection near holding hand','Subtle reflected blue on sleeve'):
        for n in bpy.data.materials[name].node_tree.nodes:
            if n.bl_idname=='ShaderNodeMath': glow.append(float(n.inputs[1].default_value))
    return shapes+glow
a,b=state(1),state(193)
error=max(abs(x-y) for x,y in zip(a,b))
assert error<1e-6, (a,b)
assert s.render.film_transparent and s.render.fps==24 and s.frame_end==192
result={'closureFrame':193,'firstFrame':1,'maxShapeAndGlowError':error,'filmTransparent':s.render.film_transparent,'fps':s.render.fps,'rgba':s.render.image_settings.color_mode,'packedImages':all(i.packed_file is not None for i in bpy.data.images if i.name not in ('Render Result','Viewer Node'))}
out=os.path.dirname(bpy.data.filepath)
open(os.path.join(out,'loop_validation.json'),'w').write(json.dumps(result,indent=2)+'\n')
print(result)
