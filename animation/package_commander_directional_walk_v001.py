"""Package genuine low-resolution Blender frames; retain all originals."""
from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/commander/directional-walk/v001'
directions=['down','left','right','up']
sheet=Image.new('RGBA',(48*9,64*4))
preview=Image.new('RGB',(48*9*3, (64+10)*4*3),'#101a2b')
draw=ImageDraw.Draw(preview)
frames=[]
for row,direction in enumerate(directions):
    poses=[]
    for col in range(9):
        image=Image.open(OUT/f'{direction}-{col:02}.png').convert('RGBA')
        # Fixed RGB lattice prevents per-frame adaptive-palette flicker, binary alpha.
        image=image.point(lambda p: round(p/32)*32 if p<240 else 255)
        image.putalpha(image.getchannel('A').point(lambda p:255 if p>=128 else 0))
        sheet.paste(image,(48*col,64*row))
        preview.paste(image.resize((144,192),Image.Resampling.NEAREST),(col*144,row*222+25),image.resize((144,192),Image.Resampling.NEAREST))
        poses.append(image)
    draw.text((8,row*222+7),f'{direction.upper()}   STAND  |  WALK 1-8',fill='#efd49d')
    poses[1].save(OUT/f'walk-{direction}.webp',save_all=True,append_images=poses[2:],duration=85,loop=0,lossless=True)
sheet.save(OUT/'spritesheet.png')
preview.save(OUT/'contact-sheet.png')
poster=sheet.crop((0,0,48,64));poster.save(OUT/'poster.png');poster.save(OUT/'poster.webp',lossless=True)
poster.crop((9,4,39,30)).save(OUT/'head.webp',lossless=True)
for i in range(8):
    canvas=Image.new('RGBA',(48*4,64))
    for j in range(4):canvas.paste(sheet.crop(((i+1)*48,j*64,(i+2)*48,(j+1)*64)),(j*48,0))
    frames.append(canvas.resize((768,256),Image.Resampling.NEAREST))
frames[0].save(OUT/'preview.webp',save_all=True,append_images=frames[1:],duration=85,loop=0,lossless=True)
meta={'characterId':'commander','animationId':'directional-walk','version':'v001','frameWidth':48,'frameHeight':64,'columns':9,'rows':directions,'neutralColumn':0,'walkColumns':list(range(1,9)),'cycleDistancePixels':96,'source':'commander_directional_walk.blend','technique':'Articulated volumetric mesh in Blender, orthographic Workbench renders, fixed color lattice, binary alpha','limitations':'First-pass faceted render-to-pixel prototype; not a hand-drawn replica of Chrono Trigger sprites.'}
(OUT/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/commander/directional-walk/v001'
target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp']:
    shutil.copy2(OUT/name,target/name)
manifest_path=ROOT/'characters/commander/manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['animations']['directional-walk']={**meta,'source':str((OUT/'commander_directional_walk.blend').relative_to(ROOT)),'spritesheet':str((OUT/'spritesheet.png').relative_to(ROOT)),'poster':str((OUT/'poster.webp').relative_to(ROOT)),'head':str((OUT/'head.webp').relative_to(ROOT)),'animation':str((OUT/'walk-down.webp').relative_to(ROOT)),'boardIntegration':'Phaser castle board only; sword-ready default and legacy registry preserved'}
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(OUT/'preview.webp')
