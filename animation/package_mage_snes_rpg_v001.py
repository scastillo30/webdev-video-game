"""Export Tech Mage board sprites without modifying Office assets.
Requires Pillow and numpy. Run from any directory using workspace Python.
"""
from pathlib import Path
import json, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/mage/snes-rpg/v001'
source=Image.open(OUT/'source-generated.png').convert('RGBA')
swatches=[(11,17,25),(25,36,53),(43,59,80),(72,87,105),
 (102,85,57),(158,125,67),(218,179,97),(251,220,145),
 (146,132,105),(205,190,153),(246,233,199),
 (86,26,30),(149,44,42),(209,75,56),
 (55,62,40),(100,106,65),
 (65,39,26),(118,74,35),(178,118,54),
 (162,99,63),(225,157,100),(255,205,145),
 (0,133,172),(100,236,248)]
palette=Image.new('P',(1,1));palette.putpalette([n for c in swatches for n in c]+list(swatches[0])*(256-len(swatches)))
masters={};compat={};registrations=[]
scale=57/174
for row,count in enumerate([9,12,9,3]):
  for col in range(count):
    cuts=[[0,185,345,505,675,830,995,1160,1320,1490],
          [0,180,315,450,615,785,925,1060,1210,1365,1510,1660,1800],
          [0,185,350,515,680,835,1000,1165,1325,1490],
          [0,210,380,550]][row]
    x0,x1=[round(x*source.width/2048) for x in cuts[col:col+2]]
    cell=source.crop((x0,row*source.height//4,x1,(row+1)*source.height//4))
    a=np.array(cell);a[:,:,3]=np.where(a[:,:,3]>160,255,0)
    # Remove isolated export specks, retaining the connected body, staff and spell.
    solid=a[:,:,3]>0;seen=set()
    for yy,xx in zip(*np.where(solid)):
      if (xx,yy) in seen:continue
      pending=[(xx,yy)];seen.add((xx,yy));points=[]
      while pending:
        x,y=pending.pop();points.append((x,y))
        for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
          if 0<=nx<a.shape[1] and 0<=ny<a.shape[0] and solid[ny,nx] and (nx,ny) not in seen:seen.add((nx,ny));pending.append((nx,ny))
      if len(points)<300:
        for x,y in points:a[y,x]=0
    sprite=Image.fromarray(a);bounds=sprite.getbbox();left,top,right,bottom=bounds;sprite=sprite.crop(bounds)
    for n,collection in [(64,masters),(32,compat)]:
      factor=scale*n/64;w=round(sprite.width*factor);h=round(sprite.height*factor)
      image=sprite.resize((w,h),Image.Resampling.BOX)
      alpha=image.getchannel('A').point(lambda v:255 if v>=112 else 0)
      image=image.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');image.putalpha(alpha)
      clean=np.array(image);clean[clean[:,:,3]==0]=0;image=Image.fromarray(clean)
      dx=max(0,min(round(n/2-((x1-x0)/2-left)*factor),n-w));baseline=62 if n==64 else 31
      tile=Image.new('RGBA',(n,n));tile.paste(image,(dx,baseline-h))
      if tile.getbbox()[3]!=baseline:
        fixed=Image.new('RGBA',(n,n));fixed.paste(tile,(0,baseline-tile.getbbox()[3]));tile=fixed
      collection[row,col]=tile
    registrations.append({'row':row,'column':col,'sourceBounds':list(bounds),'bodyCenterX':90})
expected={(0,c) for c in range(9)}|{(1,c) for c in range(12)}|{(2,c) for c in range(9)}|{(3,c) for c in range(3)}
assert set(masters)==set(compat)==expected
reports=[]
for n,collection,name in [(64,masters,'spritesheet-runtime.png'),(32,compat,'spritesheet.png')]:
    sheet=Image.new('RGBA',(n*12,n*4))
    for (row,col),image in collection.items():sheet.paste(image,(col*n,row*n))
    sheet.save(OUT/name)
    sheet.resize((1536,512),Image.Resampling.NEAREST).save(OUT/('runtime-sheet-2x.png' if n==64 else 'spritesheet-4x.png'))
    reports.append({'file':name,'frameSize':n,'occupiedFrames':len(collection),'uniquePoses':len({hashlib.sha256(t.tobytes()).hexdigest() for t in collection.values()}),'binaryAlpha':set(sheet.getchannel('A').get_flattened_data())=={0,255},'alignedBaselines':all(t.getbbox()[3]==(62 if n==64 else 31) for t in collection.values()),'paletteColors':len({v[:3] for v in sheet.get_flattened_data() if v[3]})})
sequences={'idle-down':[0,1,2],'idle-up':[3,4,5],'idle-right':[6,7,8],
 'walk-down':[12,13,14,15],'walk-up':[16,17,18,19],'walk-right':[20,21,22,23],
 'orb-summon-down':[24,25,26],'orb-summon-up':[27,28,29],'orb-summon-right':[30,31,32],
 'hurt-down':[36],'hurt-up':[37],'hurt-right':[38]}
def tile_at(i):return masters[i//12,i%12]
ability_order=[0,1,2,1,0];ability_durations=[180,220,1300,180,140]
for name,ids in sequences.items():
    order=ability_order if name.startswith('orb-summon') else range(len(ids))
    frames=[tile_at(ids[i]) for i in order]
    durations=ability_durations if name.startswith('orb-summon') else [260 if name.startswith('idle') else 120]*len(frames)
    frames[0].save(OUT/(name+'.webp'),save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True)
# The animated deliverable shows the complete raise, hologram hold and lower in all three views.
frames=[]
for step in ability_order:
    canvas=Image.new('RGBA',(64*3,64))
    for col,start in enumerate([24,27,30]):canvas.paste(tile_at(start+step),(col*64,0))
    frames.append(canvas.resize((768,256),Image.Resampling.NEAREST))
frames[0].save(OUT/'orb-summon-preview.webp',save_all=True,append_images=frames[1:],duration=ability_durations,loop=0,lossless=True)
shutil.copy2(OUT/'orb-summon-preview.webp',OUT/'preview.webp')
masters[0,0].save(OUT/'poster.png');masters[0,0].save(OUT/'poster.webp',lossless=True)
masters[0,0].crop((14,3,50,34)).save(OUT/'head.webp',lossless=True)
contact=Image.new('RGB',(1536,608),'#111d30');draw=ImageDraw.Draw(contact)
for row,title in enumerate(['IDLE - DOWN / UP / RIGHT','WALK - DOWN / UP / RIGHT','RAISE PALM + GYROSCOPE ORB - DOWN / UP / RIGHT','HURT - DOWN / UP / RIGHT']):
    draw.text((8,row*152+5),title,fill='#f0d49e')
    for col in range(12):
        if (row,col) in masters:
            t=masters[row,col].resize((128,128),Image.Resampling.NEAREST);contact.paste(t,(col*128,row*152+24),t)
contact.save(OUT/'contact-sheet.png')
metadata={'characterId':'mage','gameSlot':'mage','animationId':'snes-rpg','version':'v001','frameWidth':64,'frameHeight':64,'sheetWidth':768,'sheetHeight':256,'columns':12,'rows':4,'occupiedFrames':33,'paletteColors':24,'footBaseline':61,'runtimeFootOrigin':[32,62],'runtimeDisplayScale':1.2,'sequences':sequences,'abilityTimeline':[{'pose':p,'duration':d} for p,d in zip(ability_order,ability_durations)],'idleAbilityIntervalMs':9000,'abilityOnFocus':True,'leftFacing':'Mirror right; presentation hand is mirrored on left-facing sprites','compatibility':{'frameWidth':32,'frameHeight':32,'sheetWidth':384,'sheetHeight':128,'footBaseline':30,'spritesheet':'spritesheet.png'},'technique':'Tech Mage identity-preserving built-in imagegen artwork, registered area-coverage export with shared material palette and binary alpha','registrations':registrations}
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert all(r['binaryAlpha'] and r['alignedBaselines'] and r['paletteColors']<=24 for r in reports)
(OUT/'asset-validation.json').write_text(json.dumps({'passed':True,'exports':reports},indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/mage/snes-rpg/v001';target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet.png','spritesheet-runtime.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp','orb-summon-preview.webp']:
    shutil.copy2(OUT/name,target/name)
prefix='assets/characters/mage/snes-rpg/v001/'
entry={k:v for k,v in metadata.items() if k!='registrations'}
entry.update({'source':prefix+'source-generated.png','spritesheet':prefix+'spritesheet-runtime.png','compatibilitySpritesheet':prefix+'spritesheet.png','animation':prefix+'orb-summon-down.webp','poster':prefix+'poster.webp','head':prefix+'head.webp','gameIntegration':'Tech Mage castle board slot only; original Office artwork and all original assets preserved'})
for character in ['mage']:
    path=ROOT/'characters'/character/'manifest.json';manifest=json.loads(path.read_text());manifest['animations']['snes-rpg']=entry;path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Tech Mage: 33 poses, 64px runtime + 32px compatibility, cyan orb summon, manifests and runtime exports complete.')
