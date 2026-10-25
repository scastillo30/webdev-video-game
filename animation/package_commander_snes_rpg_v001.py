"""Register generated Commander poses into the requested exact 32px game grid.

This is asset export/registration, not a new illustration: the preserved source is
the built-in image generator output. Requires Pillow and numpy.
"""
from pathlib import Path
import json, shutil
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/commander/snes-rpg/v001'
source=Image.open(OUT/'source-generated.png').convert('RGBA')
pixels=np.array(source)
solid=pixels[:,:,3]>160
seen=np.zeros(solid.shape,bool)
h,w=solid.shape
components=[]
# Isolate whole sprites rather than cropping an imperfect generated grid. This
# preserves sword tips crossing conceptual source cells without importing a neighbor.
for y,x in zip(*np.where(solid)):
    if seen[y,x]:continue
    queue=[(int(x),int(y))];seen[y,x]=True;points=[]
    while queue:
        xx,yy=queue.pop();points.append((xx,yy))
        for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
            if 0<=nx<w and 0<=ny<h and solid[ny,nx] and not seen[ny,nx]:
                seen[ny,nx]=True;queue.append((nx,ny))
    if len(points)>2000:components.append(np.array(points))
assert len(components)==33, f'Expected 33 distinct poses, found {len(components)}'
tiles={}
registrations=[]
scale=29/169
for points in components:
    xs,ys=points.T
    left,top,right,bottom=int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1
    row=int((top+60)/(h/4));col=int(((left+right)/2)/(w/12))
    assert (row,col) not in tiles
    rgba=np.zeros((bottom-top,right-left,4),dtype=np.uint8)
    rgba[ys-top,xs-left]=pixels[ys,xs]
    rgba[:,:,3]=np.where(rgba[:,:,3]>160,255,0)
    # Find the head's warm hair/skin pixels; swords do not shift the body anchor.
    colors=pixels[ys,xs,:3].astype(float)
    warm=(colors[:,0]>100)&(colors[:,1]>75)&(colors[:,2]>40)&(colors[:,0]>=colors[:,1])&(colors[:,1]>=colors[:,2])&(colors[:,0]<colors[:,1]*1.6)&(ys<top+85)
    head_x=float(np.median(xs[warm])) if warm.any() else (left+right)/2
    # Feet anchor comes from boot colors near the bottom and near body center,
    # excluding the blue sword or red cape that may extend farther.
    boot=(colors[:,0]>35)&(colors[:,0]<170)&(colors[:,0]>colors[:,1]*1.25)&(colors[:,1]>15)&(colors[:,1]<105)&(colors[:,2]<75)&(ys>bottom-42)&(np.abs(xs-head_x)<50)
    foot_y=float(ys[boot].max()+2) if boot.any() else bottom
    sprite=Image.fromarray(rgba)
    # Same sampling scale throughout. A maximum 1px horizontal registration
    # adjustment keeps the extended sword inside the strict tile boundary.
    dx=16-(head_x-left)*scale
    dx=max(0,min(dx,32-(right-left)*scale))
    dy=31-(foot_y-top)*scale
    tile=sprite.transform((32,32),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),resample=Image.Resampling.NEAREST)
    tile.putalpha(tile.getchannel('A').point(lambda a:255 if a>160 else 0))
    # Register bottommost boots to row30. Use the same nearest-pixel baseline
    # for every pose, including the shorter hurt recoil.
    bbox=tile.getbbox()
    if bbox and bbox[3]!=31:
        aligned=Image.new('RGBA',(32,32));aligned.paste(tile,(0,31-bbox[3]));tile=aligned
    tiles[row,col]=tile
    registrations.append({'row':row,'column':col,'sourceBounds':[left,top,right,bottom],'headAnchor':round(head_x,2),'footAnchor':round(foot_y,2)})

expected={(0,c) for c in range(9)}|{(1,c) for c in range(12)}|{(2,c) for c in range(9)}|{(3,c) for c in range(3)}
assert set(tiles)==expected
# A shared production palette reserves blue shades for Commander's coat rather
# than allowing the much larger red cape and warm hair regions to consume them.
colors=[]
for tile in tiles.values():
    a=np.array(tile);colors.extend(a[a[:,:,3]>0,:3].tolist())
color_strip=Image.fromarray(np.array(colors,dtype=np.uint8).reshape(1,-1,3))
palette=Image.new('P',(1,1))
swatches=[(15,15,24),(31,29,33),(24,36,57),(39,58,90),(64,87,123),(99,120,148),
 (69,19,30),(111,25,37),(158,34,43),(198,49,48),(224,77,63),
 (47,27,24),(82,45,29),(125,76,39),(164,104,53),
 (125,83,56),(174,116,73),(214,158,109),(244,195,147),
 (85,79,68),(121,112,92),(161,151,125),(199,189,159),(231,223,195),
 (118,80,36),(175,126,53),(220,172,82),(246,211,132),
 (191,171,133),(234,214,171),(86,120,137),(173,207,209)]
palette.putpalette([n for c in swatches for n in c]+list(swatches[0])*(256-len(swatches)))
sheet=Image.new('RGBA',(384,128))
for (row,col),tile in tiles.items():
    alpha=tile.getchannel('A')
    tile=tile.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');tile.putalpha(alpha)
    tiles[row,col]=tile;sheet.paste(tile,(col*32,row*32))
sheet.save(OUT/'spritesheet.png')
sheet.resize((1536,512),Image.Resampling.NEAREST).save(OUT/'spritesheet-4x.png')
labels=['IDLE · DOWN 1–3 | UP 4–6 | RIGHT 7–9','WALK · DOWN 10–13 | UP 14–17 | RIGHT 18–21','ATTACK · DOWN 22–24 | UP 25–27 | RIGHT 28–30','HURT · DOWN 31 | UP 32 | RIGHT 33']
contact=Image.new('RGB',(1536,608),'#111d30');draw=ImageDraw.Draw(contact)
for row in range(4):
    draw.text((8,row*152+4),labels[row],fill='#f0d49e')
    for col in range(12):
        if (row,col) not in tiles:continue
        p=tiles[row,col].resize((128,128),Image.Resampling.NEAREST)
        contact.paste(p,(col*128,row*152+24),p)
        draw.rectangle((col*128,row*152+24,col*128+127,row*152+151),outline='#29394e')
contact.save(OUT/'contact-sheet.png')
sequences={
    'idle-down':[0,1,2], 'idle-up':[3,4,5], 'idle-right':[6,7,8],
    'walk-down':[12,13,14,15], 'walk-up':[16,17,18,19], 'walk-right':[20,21,22,23],
    'attack-down':[24,25,26], 'attack-up':[27,28,29], 'attack-right':[30,31,32],
    'hurt-down':[36], 'hurt-up':[37], 'hurt-right':[38]
}
def tile_at(i):return tiles[i//12,i%12]
for name,indices in sequences.items():
    frames=[tile_at(i) for i in indices]
    frames[0].save(OUT/(name+'.webp'),save_all=True,append_images=frames[1:],duration=120 if 'idle' not in name else 260,loop=0,lossless=True)
frames=[]
for k in range(12):
    canvas=Image.new('RGBA',(32*3,32*3))
    for row,action in enumerate(['idle','walk','attack']):
        for col,direction in enumerate(['down','up','right']):
            ids=sequences[action+'-'+direction]
            canvas.paste(tile_at(ids[k%len(ids)]),(col*32,row*32))
    frames.append(canvas.resize((576,576),Image.Resampling.NEAREST))
frames[0].save(OUT/'preview.webp',save_all=True,append_images=frames[1:],duration=150,loop=0,lossless=True)
tiles[0,0].save(OUT/'poster.png');tiles[0,0].save(OUT/'poster.webp',lossless=True)
tiles[0,0].crop((7,1,25,17)).save(OUT/'head.webp',lossless=True)
meta={'characterId':'commander','animationId':'snes-rpg','version':'v001','frameWidth':32,'frameHeight':32,'sheetWidth':384,'sheetHeight':128,'columns':12,'rows':4,'occupiedFrames':33,'paletteColors':32,'footBaseline':30,'sequences':sequences,'leftFacing':'Mirror right-facing frames','source':'source-generated.png','technique':'Built-in image generation using style/identity references, exact-grid RGBA export with shared palette and nearest-neighbor sampling','registrations':registrations}
(OUT/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/commander/snes-rpg/v001';target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp']:
    shutil.copy2(OUT/name,target/name)
mp=ROOT/'characters/commander/manifest.json';manifest=json.loads(mp.read_text())
prefix='assets/characters/commander/snes-rpg/v001/'
manifest['animations']['snes-rpg']={k:v for k,v in meta.items() if k!='registrations'}
manifest['animations']['snes-rpg'].update({'source':prefix+'source-generated.png','spritesheet':prefix+'spritesheet.png','poster':prefix+'poster.webp','head':prefix+'head.webp','animation':prefix+'idle-down.webp','gameIntegration':'Active Commander castle board sprite; prior directional-walk/v001 and sword-ready/v001 preserved'})
mp.write_text(json.dumps(manifest,indent=2)+'\n')
assert all(tile.getbbox()[3]==31 for tile in tiles.values())
assert len(set(sheet.getchannel('A').get_flattened_data()))==2
print('Exported 33 registered 32x32 tiles; shared 32-color palette; binary alpha; baseline30.')
