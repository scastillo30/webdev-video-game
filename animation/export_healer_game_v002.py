"""Add game-sized assets without replacing the production exports."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
production=root/'assets/characters/healer/crosier-victory/v002'
out=production/'web'
out.mkdir(exist_ok=True)
paths=sorted((production/'frames').glob('frame_*.png'))
assert len(paths)==192
frames=[]
for path in paths:
    with Image.open(path) as im:
        frames.append(im.convert('RGBA').resize((384,576),Image.Resampling.LANCZOS))
durations=[round((i+1)*1000/24)-round(i*1000/24) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=85,method=4,allow_mixed=True)
poster=frames[0]
poster.save(out/'poster.webp',quality=92,method=6)
# Match the full-canvas portrait registration of prior game integrations.
head=poster.copy()
alpha=head.getchannel('A')
for y in range(head.height):
    factor=max(0,min(1,(148-y)/35))
    if factor<1:
        alpha.paste(alpha.crop((0,y,head.width,y+1)).point(lambda a:round(a*factor)),(0,y))
head.putalpha(alpha)
head.save(out/'head.webp',quality=92,method=6)
check=Image.open(out/'idle.webp')
elapsed=0
for i in range(check.n_frames):
    check.seek(i);check.load();elapsed+=check.info['duration']
    a=check.convert('RGBA').getchannel('A')
    assert a.getpixel((0,0))==a.getpixel((383,575))==0
assert check.size==(384,576) and elapsed==8000 and check.n_frames>1
metadata={'characterId':'healer','animationId':'crosier-victory','version':'v002','width':384,'height':576,'fps':24,'durationMs':elapsed,'encodedFrames':check.n_frames,'alpha':True,'loop':True,'image':'idle.webp','poster':'poster.webp','head':'head.webp','portraitRegistration':'full canvas, feathered at shoulders','productionSource':'../healer_crosier_victory.blend'}
(out/'animation.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(dict(metadata,bytes=(out/'idle.webp').stat().st_size),indent=2))
