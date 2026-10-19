"""Export the approved breathing and glasses-glow version for the web game."""
import bpy, os
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'character_pointing_breathing.blend'))
scene=bpy.context.scene
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=384
scene.render.resolution_y=576
scene.render.resolution_percentage=100
scene.frame_start=1;scene.frame_end=144;scene.render.fps=24
scene.render.filepath=os.path.join(OUT,'web_frames','frame_')
bpy.ops.render.render(animation=True)
