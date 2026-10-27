"""Export Swordsman board sprites without modifying Office assets.
Requires Pillow and numpy. Run from any directory using workspace Python.
"""
from pathlib import Path
import json, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/swordsman/snes-rpg/v001'
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
assert len(components)==33, f'Expected 33 complete Swordsman poses, got {len(components)}'
swatches=[(10,15,23),(28,31,38),(48,51,57),(74,75,79),
 (106,108,109),(155,162,164),(207,220,221),(246,249,240),
 (58,18,25),(105,29,36),(165,43,45),(220,75,57),
 (53,33,23),(93,57,31),(145,92,41),(200,145,66),(241,194,104),
 (143,85,54),(203,135,85),(247,188,126),(255,220,166),
 (76,58,45),(117,89,62),(168,133,88)]
palette=Image.new('P',(1,1));palette.putpalette([n for c in swatches for n in c]+list(swatches[0])*(256-len(swatches)))
masters={};compat={};registrations=[]
scale=57/180
components.sort(key=lambda p:(int(p[:,1].min()/(height/4)),p[:,0].mean()))
row_counts=[9,12,9,3];ordered=[]
for r,count in enumerate(row_counts):
    group=[p for p in components if int(p[:,1].min()/(height/4))==r]
    assert len(group)==count,(r,len(group))
    ordered.extend((r,c,p) for c,p in enumerate(sorted(group,key=lambda p:p[:,0].mean())))
for row,col,points in ordered:
    if row==1:
        if col==11:continue
        if col>=7:col+=1
    xs,ys=points.T;left,top,right,bottom=int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1
    assert (row,col) not in masters
    rgb=pixels[ys,xs,:3].astype(float)
    # Face/hair, rather than the raised hand or cyan cube, define horizontal body registration.
    head=(ys<top+55)&(rgb[:,0]<100)&(rgb[:,1]<100)&(rgb[:,2]<100)
    head_x=float(np.median(xs[head])) if head.any() else (left+right)/2
    a=np.zeros((bottom-top,right-left,4),dtype=np.uint8);a[ys-top,xs-left]=pixels[ys,xs];a[:,:,3]=np.where(a[:,:,3]>160,255,0)
    sprite=Image.fromarray(a)
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
# Individually authored fourth up-walk pose replaces the source sheet's excess side pose.
step=Image.open(OUT/'source-walk-up.png').convert('RGBA')
a=np.array(step);a[:,:,3]=np.where(a[:,:,3]>160,255,0);step=Image.fromarray(a);step=step.crop(step.getbbox())
for n,collection in [(64,masters),(32,compat)]:
    h=57 if n==64 else 29;w=round(step.width*h/step.height)
    image=step.resize((w,h),Image.Resampling.BOX);alpha=image.getchannel('A').point(lambda v:255 if v>=112 else 0)
    image=image.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA');image.putalpha(alpha)
    a=np.array(image);a[a[:,:,3]==0]=0;image=Image.fromarray(a)
    tile=Image.new('RGBA',(n,n));tile.paste(image,(round(n/2-w*.45),(62 if n==64 else 31)-h))
    baseline=62 if n==64 else 31
    if tile.getbbox()[3]!=baseline:
        fixed=Image.new('RGBA',(n,n));fixed.paste(tile,(0,baseline-tile.getbbox()[3]));tile=fixed
    collection[1,7]=tile
registrations.append({'row':1,'column':7,'source':'source-walk-up.png'})
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
 'sword-guard-down':[24,25,26],'sword-guard-up':[27,28,29],'sword-guard-right':[30,31,32],
 'hurt-down':[36],'hurt-up':[37],'hurt-right':[38]}
def tile_at(i):return masters[i//12,i%12]
ability_order=[0,1,2,1,0];ability_durations=[180,220,1300,180,140]
for name,ids in sequences.items():
    order=ability_order if name.startswith('sword-guard') else range(len(ids))
    frames=[tile_at(ids[i]) for i in order]
    durations=ability_durations if name.startswith('sword-guard') else [260 if name.startswith('idle') else 120]*len(frames)
    frames[0].save(OUT/(name+'.webp'),save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True)
# The animated deliverable shows the complete raise, hologram hold and lower in all three views.
frames=[]
for step in ability_order:
    canvas=Image.new('RGBA',(64*3,64))
    for col,start in enumerate([24,27,30]):canvas.paste(tile_at(start+step),(col*64,0))
    frames.append(canvas.resize((768,256),Image.Resampling.NEAREST))
frames[0].save(OUT/'sword-guard-preview.webp',save_all=True,append_images=frames[1:],duration=ability_durations,loop=0,lossless=True)
shutil.copy2(OUT/'sword-guard-preview.webp',OUT/'preview.webp')
masters[0,0].save(OUT/'poster.png');masters[0,0].save(OUT/'poster.webp',lossless=True)
masters[0,0].crop((14,3,50,34)).save(OUT/'head.webp',lossless=True)
contact=Image.new('RGB',(1536,608),'#111d30');draw=ImageDraw.Draw(contact)
for row,title in enumerate(['IDLE - DOWN / UP / RIGHT','WALK - DOWN / UP / RIGHT','SWORD READY GUARD - DOWN / UP / RIGHT','HURT - DOWN / UP / RIGHT']):
    draw.text((8,row*152+5),title,fill='#f0d49e')
    for col in range(12):
        if (row,col) in masters:
            t=masters[row,col].resize((128,128),Image.Resampling.NEAREST);contact.paste(t,(col*128,row*152+24),t)
contact.save(OUT/'contact-sheet.png')
metadata={'characterId':'swordsman','gameSlot':'swordsman','animationId':'snes-rpg','version':'v001','frameWidth':64,'frameHeight':64,'sheetWidth':768,'sheetHeight':256,'columns':12,'rows':4,'occupiedFrames':33,'paletteColors':24,'footBaseline':61,'runtimeFootOrigin':[32,62],'runtimeDisplayScale':1.2,'sequences':sequences,'abilityTimeline':[{'pose':p,'duration':d} for p,d in zip(ability_order,ability_durations)],'idleAbilityIntervalMs':9000,'abilityOnFocus':True,'leftFacing':'Mirror right; presentation hand is mirrored on left-facing sprites','compatibility':{'frameWidth':32,'frameHeight':32,'sheetWidth':384,'sheetHeight':128,'footBaseline':30,'spritesheet':'spritesheet.png'},'technique':'Swordsman identity-preserving built-in imagegen artwork, registered area-coverage export with shared material palette and binary alpha','registrations':registrations}
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
assert all(r['binaryAlpha'] and r['alignedBaselines'] and r['paletteColors']<=24 for r in reports)
(OUT/'asset-validation.json').write_text(json.dumps({'passed':True,'exports':reports},indent=2)+'\n')
target=ROOT/'frontend/public/assets/characters/swordsman/snes-rpg/v001';target.mkdir(parents=True,exist_ok=True)
for name in ['spritesheet.png','spritesheet-runtime.png','poster.png','poster.webp','head.webp','metadata.json','preview.webp','sword-guard-preview.webp']:
    shutil.copy2(OUT/name,target/name)
prefix='assets/characters/swordsman/snes-rpg/v001/'
entry={k:v for k,v in metadata.items() if k!='registrations'}
entry.update({'source':prefix+'source-generated.png','spritesheet':prefix+'spritesheet-runtime.png','compatibilitySpritesheet':prefix+'spritesheet.png','animation':prefix+'sword-guard-down.webp','poster':prefix+'poster.webp','head':prefix+'head.webp','gameIntegration':'Swordsman castle board slot only; Office sword-wind/v004 and all original assets preserved'})
for character in ['swordsman']:
    path=ROOT/'characters'/character/'manifest.json';manifest=json.loads(path.read_text());manifest['animations']['snes-rpg']=entry;path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Swordsman: 33 poses, 64px runtime + 32px compatibility, sword guard, manifests and runtime exports complete.')
