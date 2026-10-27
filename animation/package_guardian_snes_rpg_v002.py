"""Register generated sideways gait; preserve every other approved Guardian pixel."""
from pathlib import Path
import json, shutil
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'assets/characters/cube-wanderer/snes-rpg/v001'
OUT=OLD.parent/'v002'
OUT.mkdir(exist_ok=True)
src=Image.open(OUT/'source-walk-right.png').convert('RGBA')
old=Image.open(OLD/'spritesheet-runtime.png').convert('RGBA')
colors=sorted({c[:3] for c in old.get_flattened_data() if c[3]})
pal=Image.new('P',(1,1));pal.putpalette([v for c in colors for v in c]+list(colors[0])*(256-len(colors)))
tiles=[]
for i in range(4):
    cell=src.crop((i*src.width//4,0,(i+1)*src.width//4,src.height))
    cell=cell.crop(cell.getbbox())
    cell=cell.resize((round(cell.width*57/cell.height),57),Image.Resampling.BOX)
    alpha=cell.getchannel('A').point(lambda a:255 if a>=112 else 0)
    cell=cell.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).convert('RGBA');cell.putalpha(alpha)
    tile=Image.new('RGBA',(64,64));tile.paste(cell,(64-cell.width-6,5))
    if tile.getbbox()[3]!=62:
        aligned=Image.new('RGBA',(64,64));aligned.paste(tile,(0,62-tile.getbbox()[3]));tile=aligned
    # Keep the approved head, torso, arms and cape exactly intact. Only replace legs below belt.
    original=old.crop(((8+i)*64,64,(9+i)*64,128))
    original.paste(tile.crop((0,44,64,64)),(0,44))
    clean=np.array(original);clean[clean[:,:,3]==0]=0
    tiles.append(Image.fromarray(clean))
sheet=old.copy()
for i,t in enumerate(tiles):sheet.paste(t,((8+i)*64,64))
sheet.save(OUT/'spritesheet-runtime.png')
compat=Image.open(OLD/'spritesheet.png').convert('RGBA')
for i,t in enumerate(tiles):compat.paste(t.resize((32,32),Image.Resampling.NEAREST),((8+i)*32,32))
compat.save(OUT/'spritesheet.png')
for name in ['poster.png','poster.webp','head.webp','cube-reveal-preview.webp','preview.webp']:
    shutil.copy2(OLD/name,OUT/name)
for direction in ['right','left']:
    frames=[(t if direction=='right' else t.transpose(Image.Transpose.FLIP_LEFT_RIGHT)).resize((256,256),Image.Resampling.NEAREST) for t in tiles]
    frames[0].save(OUT/f'walk-{direction}.webp',save_all=True,append_images=frames[1:],duration=120,loop=0,lossless=True)
metadata=json.loads((OLD/'metadata.json').read_text());metadata.update(version='v002',source='source-walk-right.png',change='Only sideways walking legs revised: contact, passing, opposite contact, opposite passing; left mirrors right.')
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert all(sheet.crop((c*64,r*64,(c+1)*64,(r+1)*64)).tobytes()==old.crop((c*64,r*64,(c+1)*64,(r+1)*64)).tobytes() for r in range(4) for c in range(12) if not(r==1 and c>=8))
assert len({t.crop((0,44,64,64)).tobytes() for t in tiles})==4
assert all(t.getbbox()[3]==62 for t in tiles)
(OUT/'asset-validation.json').write_text(json.dumps({'passed':True,'changedFrames':[20,21,22,23],'unchangedOtherFrames':44,'fourUniqueLegPoses':True,'baseline':61},indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/cube-wanderer/snes-rpg/v002';target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet-runtime.png','spritesheet.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp','cube-reveal-preview.webp']:shutil.copy2(OUT/name,target/name)
for character in ['guardian','cube-wanderer']:
    path=ROOT/'characters'/character/'manifest.json';m=json.loads(path.read_text());entry=m['animations']['snes-rpg'];previous=json.loads(json.dumps(entry));previous.pop('previousVersions',None)
    entry.setdefault('previousVersions',{})['v001']=previous
    entry['version']='v002'
    for key in ['source','spritesheet','compatibilitySpritesheet','animation','poster','head']:
        if key in entry:entry[key]=entry[key].replace('/v001/','/v002/')
    entry['source']=str((OUT/'source-walk-right.png').relative_to(ROOT))
    # The cube animation is pixel-identical and retained in its approved version.
    entry['animation']=previous['animation']
    path.write_text(json.dumps(m,indent=2)+'\n')
print('Guardian v002: only four sideways leg poses changed; other frames preserved.')
