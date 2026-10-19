import bpy, math, os, json
from mathutils import Vector
from math import sin,cos,pi,exp
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets/characters/cube-wanderer/cube-wind/v001')
os.makedirs(OUT+'/frames',exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=False
s.render.resolution_x=512;s.render.resolution_y=768;s.render.resolution_percentage=100
s.render.fps=24;s.frame_start=1;s.frame_end=192;s.render.film_transparent=True
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.filepath=OUT+'/frames/frame_'
s.view_settings.view_transform='Standard';s.world.color=(0,0,0)
# Artist-defined silhouette follows the supplied illustration, without altering its pixels.
poly=[(436,81),(432,52),(457,24),(505,17),(555,26),(602,52),(626,91),(628,145),(619,184),(610,215),(671,231),(731,259),(703,286),(762,300),(793,322),(822,365),(841,404),(821,431),(850,475),(873,515),(891,548),(884,573),(869,600),(861,641),(859,690),(836,736),(831,779),(851,830),(881,907),(904,981),(918,1045),(892,1020),(857,1008),(828,1015),(824,1044),(841,1106),(832,1158),(836,1198),(827,1248),(835,1296),(833,1342),(865,1372),(911,1387),(946,1413),(958,1449),(935,1465),(891,1474),(841,1469),(794,1465),(742,1457),(690,1446),(681,1423),(685,1383),(677,1322),(663,1260),(648,1226),(646,1192),(657,1176),(630,1151),(608,1104),(575,1101),(552,1090),(535,1096),(512,1084),(498,1060),(469,1097),(435,1147),(414,1176),(406,1212),(399,1251),(384,1290),(374,1335),(369,1372),(373,1401),(362,1435),(365,1472),(348,1492),(295,1501),(235,1500),(166,1485),(162,1461),(178,1420),(208,1383),(231,1358),(229,1310),(239,1258),(240,1200),(253,1173),(237,1144),(190,1130),(158,1108),(151,1082),(126,1076),(102,1105),(88,1130),(61,1090),(45,1040),(42,999),(70,965),(121,916),(176,868),(227,809),(263,748),(287,690),(283,663),(302,642),(338,627),(351,586),(357,551),(324,524),(295,540),(251,543),(220,529),(191,508),(174,487),(165,460),(148,448),(145,428),(127,414),(105,397),(87,366),(66,333),(47,313),(46,302),(54,294),(66,295),(92,313),(108,291),(121,291),(129,303),(127,332),(138,339),(149,310),(161,309),(168,321),(165,350),(177,358),(192,324),(203,323),(210,333),(204,368),(215,372),(234,340),(246,340),(248,351),(239,388),(250,399),(270,382),(289,377),(307,368),(327,371),(340,349),(365,325),(382,308),(370,286),(370,267),(399,262),(425,250),(433,232),(409,218),(393,227),(370,225),(368,216),(435,204),(433,181),(419,160),(414,135),(431,127)]
# Horizontal strips retain a smooth boundary and dense interior for jacket deformation.
verts=[];faces=[];cols=100
for y in range(18,1502,2):
 xs=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if min(a[1],b[1])<=y<max(a[1],b[1]):xs.append(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
 if not xs:continue
 left,right=min(xs),max(xs)
 row=len(verts)//(cols+1)
 for i in range(cols+1):
  x=left+(right-left)*i/cols;verts.append(((x/1024-.5)*10,(.5-y/1536)*15,0))
 if row:
  for i in range(cols):
   k=row*(cols+1)+i
   qx=(verts[k][0]/10+.5)*1024; qy=y-1
   crossings=sorted(a[0]+(qy-a[1])*(b[0]-a[0])/(b[1]-a[1]) for a,b in zip(poly,poly[1:]+poly[:1]) if min(a[1],b[1])<=qy<max(a[1],b[1]))
   if sum(xx>qx for xx in crossings)%2:faces.append((k-cols-1,k-cols,k+1,k))
me=bpy.data.meshes.new('Illustration silhouette and fabric topology');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('Cube Wanderer • original illustrated character',me);s.collection.objects.link(o)
uv=me.uv_layers.new()
for p in me.polygons:
 for li in p.loop_indices:
  v=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(v.x/10+.5,v.y/15+.5)
m=bpy.data.materials.new('Packed original illustration');m.use_nodes=True;n=m.node_tree.nodes;n.clear();t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(OUT+'/reference_original.png');t.image.pack();e=n.new('ShaderNodeEmission');out=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(t.outputs['Color'],e.inputs[0]);m.node_tree.links.new(e.outputs[0],out.inputs[0]);me.materials.append(m)
# Remove the pale parchment remaining just beyond the hand-traced outline in the shader.
sep=n.new('ShaderNodeSeparateColor');m.node_tree.links.new(t.outputs['Color'],sep.inputs[0])
cut=n.new('ShaderNodeMath');cut.operation='GREATER_THAN';cut.inputs[1].default_value=.54;m.node_tree.links.new(sep.outputs['Green'],cut.inputs[0])
tr=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');m.node_tree.links.new(cut.outputs[0],mix.inputs[0]);m.node_tree.links.new(e.outputs[0],mix.inputs[1]);m.node_tree.links.new(tr.outputs[0],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],out.inputs[0])
o.shape_key_add(name='Basis');waves=[]
for phase in (0,pi/2):
 key=o.shape_key_add(name='Wind traveling wave '+str(len(waves)+1));key.slider_min=-1;waves.append(key)
 for i,(x,y,z) in enumerate(verts):
  u=x/10+.5;v=.5-y/15
  tail=max(0,min(1,(v-.46)/.22))*exp(-((v-.65)/.17)**4)
  side=exp(-((u-.20)/.12)**4)+exp(-((u-.82)/.08)**4)
  jacket=exp(-((u-.43)/.10)**4-((v-.37)/.08)**4)*.25
  w=tail*side+jacket
  key.data[i].co.x+=.20*w*sin(v*15+phase);key.data[i].co.y+=.08*w*cos(v*12+phase)
# True volumetric segmented cube. Local axes spin as a group and each cell has independent drift.
bpy.ops.object.empty_add(location=(-3.31,5.13,.7));rig=bpy.context.object;rig.name='Hologram • 180 degree turn'
mat=bpy.data.materials.new('Electric cyan holographic edges');mat.diffuse_color=(.01,.6,1,1);mat.use_nodes=True
ns=mat.node_tree.nodes;ns.clear();em=ns.new('ShaderNodeEmission');em.inputs[0].default_value=(.01,.55,1,1);em.inputs[1].default_value=5;out=ns.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],out.inputs[0])
parts=[]
for a in range(3):
 for b in range(3):
  for c in range(3):
   bpy.ops.mesh.primitive_cube_add(size=.49);ob=bpy.context.object;ob.name=f'Holographic cell {a+1}-{b+1}-{c+1}';ob.parent=rig;ob.location=((a-1)*.54,(b-1)*.54,(c-1)*.54);ob.data.materials.append(mat)
   wire=ob.modifiers.new('Luminous wire edges','WIREFRAME');wire.thickness=.018
   bevel=ob.modifiers.new('Soft luminous corners','BEVEL');bevel.width=.006;bevel.segments=2
   parts.append((ob,tuple(ob.location),a*1.7+b*2.3+c*.9))
for f in range(1,194):
 t=2*pi*(f-1)/192
 for key,phase in zip(waves,(0,pi/2)):key.value=sin(2*t+phase);key.keyframe_insert('value',frame=f)
 rig.rotation_euler=(.42,.32,pi*(f-1)/192);rig.keyframe_insert('rotation_euler',frame=f)
 rig.location.y=5.13+.08*sin(2*t);rig.keyframe_insert('location',frame=f)
 for ob,base,phase in parts:
  envelope=sin(t/2)**2
  ob.location=Vector(base)+Vector((sin(2*t+phase),cos(3*t+phase),sin(3*t-phase)))*(.11*envelope)
  ob.rotation_euler=(.13*envelope*sin(2*t+phase),.13*envelope*cos(2*t+phase),.09*envelope*sin(3*t+phase))
  ob.keyframe_insert('location',frame=f);ob.keyframe_insert('rotation_euler',frame=f)
bpy.ops.object.camera_add(location=(0,0,25));s.camera=bpy.context.object;s.camera.data.type='ORTHO';s.camera.data.ortho_scale=15.6
s.frame_set(1)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
readme=bpy.data.texts.new('Animation notes');readme.write('8 seconds, 24 fps, 192 frames. 2.5D illustrated character; wind shape keys and 27 independently animated 3D hologram cells. Group turns 180 degrees; cube symmetry closes the loop. Packed reference. Not a fully modeled 3D character. Originals preserved. No game integration.\n')
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/cube_wanderer_cube_wind.blend')
if os.environ.get('PREVIEW'):
 s.frame_set(73);s.render.filepath=OUT+'/preview.png';bpy.ops.render.render(write_still=True)
else:bpy.ops.render.render(animation=True)
