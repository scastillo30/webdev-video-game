import bpy, math, os
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'character_pointing_glow.blend'))
scene=bpy.context.scene
names={'Breathing','Shoulder follows torso breathing','Follow face breathing'}
count=0
for obj in scene.objects:
    if obj.type!='MESH' or not obj.data.shape_keys:continue
    blocks=obj.data.shape_keys.key_blocks
    basis=blocks[0]
    for key in blocks:
        if key.name not in names:continue
        for i,p in enumerate(basis.data):
            x,y,z=p.co
            u,v=x/8+.5,y/12+.5
            mask=math.exp(-((u-.48)/.18)**4-((v-.65)/.20)**4)
            key.data[i].co=(x+(u-.48)*.16*mask,y+.06*mask,z)
        for frame in list(range(1,146,5))+[145]:
            key.value=.65*(.5-.5*math.cos(2*math.pi*(frame-1)/144))
            key.keyframe_insert(data_path='value',frame=frame)
        count+=1
assert count==9, f'Expected body, sleeve, seam and six lens layers; found {count}'
scene.frame_start=1;scene.frame_end=144;scene.render.fps=24
scene.frame_set(73)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'character_pointing_breathing.blend'))
for frame,name in [(1,'breathing_exhale.png'),(73,'breathing_inhale.png')]:
    scene.frame_set(frame)
    scene.render.filepath=os.path.join(OUT,name)
    bpy.ops.render.render(write_still=True)
print('Verified: 9 synchronized breathing layers, one smooth 6-second loop.')
