"""Subtle emissive lens sheen and soft halos, registered to the body artwork."""
import bpy, math, os
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'character_pointing_transparent.blend'))
scene=bpy.context.scene
collection=bpy.data.collections.new('Glasses • subtle glow')
scene.collection.children.link(collection)

def lens_layer(name,cx,cy,rx,ry,opacity,color,strength,z):
    n=48
    verts=[]
    uvcoords=[]
    for i in range(n):
        angle=2*math.pi*i/n
        dx,dy=rx*math.cos(angle),ry*math.sin(angle)
        px,py=cx+dx,cy+dy+.10*dx
        verts.append(((px/1024-.5)*8,(.5-py/1536)*12,z))
        uvcoords.append((.5+.5*math.cos(angle),.5+.5*math.sin(angle)))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],[tuple(range(n))]);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    uv=mesh.uv_layers.new(name='Lens falloff UV')
    for p in mesh.polygons:
        for li in p.loop_indices:uv.data[li].uv=uvcoords[mesh.loops[li].vertex_index]
    mat=bpy.data.materials.new(name+' • emission');mat.use_nodes=True
    mat.surface_render_method='BLENDED'
    nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
    tex=nodes.new('ShaderNodeTexCoord')
    dist=nodes.new('ShaderNodeVectorMath');dist.operation='DISTANCE';dist.inputs[1].default_value=(.5,.5,0)
    links.new(tex.outputs['UV'],dist.inputs[0])
    falloff=nodes.new('ShaderNodeMath');falloff.operation='MULTIPLY_ADD';falloff.inputs[1].default_value=-2;falloff.inputs[2].default_value=1;falloff.use_clamp=True
    links.new(dist.outputs['Value'],falloff.inputs[0])
    power=nodes.new('ShaderNodeMath');power.operation='POWER';power.inputs[1].default_value=1.7
    links.new(falloff.outputs[0],power.inputs[0])
    alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';alpha.inputs[1].default_value=opacity
    links.new(power.outputs[0],alpha.inputs[0])
    em=nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(*color,1);em.inputs['Strength'].default_value=strength
    tr=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');output=nodes.new('ShaderNodeOutputMaterial')
    links.new(alpha.outputs[0],mix.inputs[0]);links.new(tr.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs[0])
    mesh.materials.append(mat)
    # Use exactly the same per-vertex breathing deformation as the face.
    obj.shape_key_add(name='Basis');key=obj.shape_key_add(name='Follow face breathing')
    for i,(x,y,z0) in enumerate(verts):
        u,v=x/8+.5,y/12+.5
        b=math.exp(-((u-.48)/.18)**4-((v-.65)/.20)**4)
        key.data[i].co.x+=(u-.48)*.045*b;key.data[i].co.y+=.035*b
    for frame in range(1,146,5):
        key.value=.5-.5*math.cos(2*math.pi*(min(frame,121)-1)/120)
        key.keyframe_insert(data_path='value',frame=frame)
    # A quiet shimmer, with matching loop endpoints.
    for frame,value in [(1,strength),(40,strength*1.15),(75,strength),(110,strength*.9),(145,strength)]:
        em.inputs['Strength'].default_value=value
        em.inputs['Strength'].keyframe_insert(data_path='default_value',frame=frame)
    return obj

for side,cx,cy in [('Right',465,148),('Left',531,156)]:
    lens_layer(side+' lens • soft halo',cx,cy,35,24,.05,(.30,.66,1.0),1.5,.090)
    lens_layer(side+' lens • blue sheen',cx,cy,24,14,.16,(.38,.77,1.0),1.8,.095)
    lens_layer(side+' lens • reflection glint',cx-8,cy-6,9,2.5,.35,(.78,.94,1.0),2.3,.100)
scene.frame_set(52)
scene.render.resolution_x=768;scene.render.resolution_y=1152
scene.render.filepath=os.path.join(OUT,'glasses_glow_preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_pointing_glow.blend'))
bpy.ops.render.render(write_still=True)
