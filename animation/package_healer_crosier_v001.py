"""Package and inspect Blender's master PNG sequence using Pillow / NumPy."""
from pathlib import Path
from PIL import Image
import numpy as np
import json, shutil, zipfile
root=Path(__file__).resolve().parents[1]
out=root/'assets/characters/healer/crosier-victory/v001'
paths=sorted((out/'frames').glob('frame_*.png'))
assert len(paths)==192, f'Expected 192 frames, got {len(paths)}'
for p in paths:
    with Image.open(p) as im:
        assert im.size==(1024,1536) and im.mode=='RGBA', (p, im.size, im.mode)
        alpha=im.getchannel('A')
        bounds=alpha.getbbox()
        assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<1024 and bounds[3]<1536, (p,bounds)
        assert alpha.getpixel((0,0))==0 and alpha.getpixel((1023,1535))==0
shutil.copyfile(paths[0],out/'poster.png')
shutil.copyfile(paths[96],out/'preview.png')
frames=[]
for p in paths:
    with Image.open(p) as im:
        frames.append(im.resize((512,768),Image.Resampling.LANCZOS))
durations=[round((i+1)*8000/192)-round(i*8000/192) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=90,method=4)
with Image.open(paths[0]) as im:
    im.crop((365,15,700,325)).resize((256,256),Image.Resampling.LANCZOS).save(out/'head.webp',quality=95)
    # Two neutral backgrounds expose alpha fringing and glow behavior for QA.
    bright=Image.new('RGBA',im.size,'#e1e5eb'); bright.alpha_composite(im)
with Image.open(paths[96]) as im:
    dark=Image.new('RGBA',im.size,'#182537'); dark.alpha_composite(im)
contact=Image.new('RGB',(1024,768))
contact.paste(bright.resize((512,768)),(0,0)); contact.paste(dark.resize((512,768)),(512,0))
contact.save(out/'alpha_review.jpg',quality=95)
first=np.array(Image.open(paths[0])).astype(float)
last=np.array(Image.open(paths[-1])).astype(float)
metadata={'characterId':'healer','animation':'crosier-victory','version':'v001','fps':24,'frames':192,'durationSeconds':8,'width':1024,'height':1536,'format':'PNG RGBA 8-bit','filmTransparent':True,'previewDurationMs':sum(durations),'lastToFirstMeanAbsoluteDifference':float(np.abs(first-last).mean()),'closureKeyFrame':193,'closureKeyMatchesFrame':1,'technique':'2.5D illustration mesh','originalsPreserved':True}
(out/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
with zipfile.ZipFile(out/'png_sequence.zip','w',compression=zipfile.ZIP_STORED) as archive:
    for p in paths: archive.write(p,'frames/'+p.name)
    for name in ('metadata.json','loop_validation.json','README.md'): archive.write(out/name,name)
print(json.dumps(metadata,indent=2))
