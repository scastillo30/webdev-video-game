"""Export Healer board sprites without modifying Office assets.
Requires Pillow and numpy. Run from any directory using workspace Python.
"""
from pathlib import Path
import json, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/healer/snes-rpg/v001'
source=Image.open(OUT/'source-generated.png').convert('RGBA')
pixels=np.array(source);solid=pixels[:,:,3]>160
seen=np.zeros(solid.shape,bool);height,width=solid.shape
components=[]
for y,x in zip(*np.where(solid)):
    if seen[y,x]:continue
    pending=[(int(x),int(y))];seen[y,x]=True;points=[]
    while pending:
        xx,yy=pending.pop();points.append((xx,yy))
        for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
            if 0<=nx<width and 0<=ny<height and solid[ny,nx] and not seen[ny,nx]:
                seen[ny,nx]=True;pending.append((nx,ny))
    if len(points)>3000:components.append(np.array(points))
assert len(components)==33, f'Expected 33 complete Healer poses, got {len(components)}'
swatches=[(12,17,25),(36,32,33),(60,53,48),
 (83,54,30),(137,84,36),(198,133,50),(239,183,83),(255,219,137),
 (156,104,74),(218,155,108),(252,201,151),
 (153,138,111),(204,190,156),(246,233,204),
 (100,30,32),(176,55,46),(221,95,72),
 (52,63,35),(96,113,53),(142,153,77),
 (60,66,74),(103,108,115),(3,75,123),(0,139,191),(32,216,231),(178,252,250)]
palette=Image.new('P',(1,1));palette.putpalette([n for c in swatches for n in c]+list(swatches[0])*(256-len(swatches)))
masters={};compat={};registrations=[]
scale=57/160
for points in components:
    xs,ys=points.T;left,top,right,bottom=int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1
    row=int((top+50)/(height/4));col=int(((left+right)/2)/(width/12))
    if row==1:
        if col==9:continue
        col=col+1 if 3<=col<=8 else col
    assert (row,col) not in masters
    rgb=pixels[ys,xs,:3].astype(float)
    # Register on the hair/face, not on the staff or the healing rays.
    head=(ys<top+72)&(rgb[:,0]>rgb[:,2]*1.25)&(rgb[:,0]>rgb[:,1]*1.05)&(rgb[:,0]>35)&(rgb[:,0]<250)
    head_x=float(np.median(xs[head])) if head.any() else (left+right)/2
    a=np.zeros((bottom-top,right-left,4),dtype=np.uint8);a[ys-top,xs-left]=pixels[ys,xs];a[:,:,3]=np.where(a[:,:,3]>160,255,0)
    sprite=Image.fromarray(a)
    if row==2 and col in (4,5):
        sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT);head_x=left+(right-left)-(head_x-left)
    for n,collection in [(64,masters),(32,compat)]:
        factor=scale*n/64
        w=min(n,round(sprite.width*factor));h=min(n-2 if n==64 else n-1,round(sprite.height*factor))
        image=sprite.resize((w,h),Image.Resampling.BOX)
        alpha=image.getchannel('A').point(lambda value:255 if value>=112 else 0)
        image=image.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');image.putalpha(alpha)
        clean=np.array(image);clean[clean[:,:,3]==0]=0;image=Image.fromarray(clean)
        dx=max(0,min(round(n/2-(head_x-left)*w/sprite.width),n-w))
        tile=Image.new('RGBA',(n,n));tile.paste(image,(dx,(62 if n==64 else 31)-h))
        bbox=tile.getbbox();baseline=62 if n==64 else 31
        if bbox[3]!=baseline:
            fixed=Image.new('RGBA',(n,n));fixed.paste(tile,(0,baseline-bbox[3]));tile=fixed
        collection[row,col]=tile
    registrations.append({'row':row,'column':col,'sourceBounds':[left,top,right,bottom],'bodyCenterX':head_x})
# Add the individually authored fourth down step. It is sampled from its own
# source rather than duplicating an idle pose or inventing pixels in the exporter.
walk_source=Image.open(OUT/'source-walk-down.png').convert('RGBA')
walk_alpha=walk_source.getchannel('A').point(lambda value:255 if value>160 else 0)
bounds=walk_alpha.getbbox();walk_source=walk_source.crop(bounds);walk_source.putalpha(walk_alpha.crop(bounds))
walk_pixels=np.array(walk_source);ys,xs=np.where(walk_pixels[:,:,3]>0);rgb=walk_pixels[ys,xs,:3]
glasses=(ys>walk_source.height*.30)&(ys<walk_source.height*.51)&(xs>walk_source.width*.30)&(rgb[:,0]<85)&(rgb[:,1]<85)&(rgb[:,2]<95)
center_x=float(np.median(xs[glasses])) if glasses.any() else walk_source.width*.55
for n,collection in [(64,masters),(32,compat)]:
    h=57 if n==64 else 29;w=round(walk_source.width*h/walk_source.height)
    image=walk_source.resize((w,h),Image.Resampling.BOX)
    alpha=image.getchannel('A').point(lambda value:255 if value>=112 else 0)
    image=image.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');image.putalpha(alpha)
    a=np.array(image);a[a[:,:,3]==0]=0;image=Image.fromarray(a)
    dx=max(0,min(round(n/2-center_x*w/walk_source.width),n-w));baseline=62 if n==64 else 31
    tile=Image.new('RGBA',(n,n));tile.paste(image,(dx,baseline-h));collection[1,3]=tile
registrations.append({'row':1,'column':3,'source':'source-walk-down.png','sourceBounds':list(bounds),'bodyCenterX':center_x})
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
 'healing-pulse-down':[24,25,26],'healing-pulse-up':[27,28,29],'healing-pulse-right':[30,31,32],
 'hurt-down':[36],'hurt-up':[37],'hurt-right':[38]}
def tile_at(i):return masters[i//12,i%12]
ability_order=[0,1,2,1,0];ability_durations=[200,240,1000,180,180]
for name,ids in sequences.items():
    order=ability_order if name.startswith('healing-pulse') else range(len(ids))
    frames=[tile_at(ids[i]) for i in order]
    durations=ability_durations if name.startswith('healing-pulse') else [260 if name.startswith('idle') else 120]*len(frames)
    frames[0].save(OUT/(name+'.webp'),save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True)
# The animated deliverable shows the complete raise, hologram hold and lower in all three views.
frames=[]
for step in ability_order:
    canvas=Image.new('RGBA',(64*3,64))
    for col,start in enumerate([24,27,30]):canvas.paste(tile_at(start+step),(col*64,0))
    frames.append(canvas.resize((768,256),Image.Resampling.NEAREST))
frames[0].save(OUT/'healing-pulse-preview.webp',save_all=True,append_images=frames[1:],duration=ability_durations,loop=0,lossless=True)
shutil.copy2(OUT/'healing-pulse-preview.webp',OUT/'preview.webp')
masters[0,0].save(OUT/'poster.png');masters[0,0].save(OUT/'poster.webp',lossless=True)
masters[0,0].crop((14,3,50,34)).save(OUT/'head.webp',lossless=True)
contact=Image.new('RGB',(1536,608),'#111d30');draw=ImageDraw.Draw(contact)
for row,title in enumerate(['IDLE - DOWN / UP / RIGHT','WALK - DOWN / UP / RIGHT','LIFT CROSIER + HEALING PULSE - DOWN / UP / RIGHT','HURT - DOWN / UP / RIGHT']):
    draw.text((8,row*152+5),title,fill='#f0d49e')
    for col in range(12):
        if (row,col) in masters:
            t=masters[row,col].resize((128,128),Image.Resampling.NEAREST);contact.paste(t,(col*128,row*152+24),t)
contact.save(OUT/'contact-sheet.png')
metadata={'characterId':'healer','gameSlot':'healer','animationId':'snes-rpg','version':'v001','frameWidth':64,'frameHeight':64,'sheetWidth':768,'sheetHeight':256,'columns':12,'rows':4,'occupiedFrames':33,'paletteColors':26,'footBaseline':61,'runtimeFootOrigin':[32,62],'runtimeDisplayScale':1.2,'sequences':sequences,'abilityTimeline':[{'pose':p,'duration':d} for p,d in zip(ability_order,ability_durations)],'idleAbilityIntervalMs':10000,'abilityOnFocus':True,'leftFacing':'Mirror right; presentation hand is mirrored on left-facing sprites','compatibility':{'frameWidth':32,'frameHeight':32,'sheetWidth':384,'sheetHeight':128,'footBaseline':30,'spritesheet':'spritesheet.png'},'technique':'Healer identity-preserving built-in imagegen artwork, registered area-coverage export with shared material palette and binary alpha','registrations':registrations}
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert all(r['binaryAlpha'] and r['alignedBaselines'] and r['paletteColors']<=26 for r in reports)
(OUT/'asset-validation.json').write_text(json.dumps({'passed':True,'exports':reports},indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/healer/snes-rpg/v001';target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet.png','spritesheet-runtime.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp','healing-pulse-preview.webp']:
    shutil.copy2(OUT/name,target/name)
prefix='assets/characters/healer/snes-rpg/v001/'
entry={k:v for k,v in metadata.items() if k!='registrations'}
entry.update({'source':prefix+'source-generated.png','spritesheet':prefix+'spritesheet-runtime.png','compatibilitySpritesheet':prefix+'spritesheet.png','animation':prefix+'healing-pulse-down.webp','poster':prefix+'poster.webp','head':prefix+'head.webp','gameIntegration':'Healer castle board slot only; Office crosier-victory/v002 and all original assets preserved'})
for character in ['healer']:
    path=ROOT/'characters'/character/'manifest.json';manifest=json.loads(path.read_text());manifest['animations']['snes-rpg']=entry;path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Healer: 33 poses, 64px runtime + 32px compatibility, cyan healing pulse, manifests and runtime exports complete.')
