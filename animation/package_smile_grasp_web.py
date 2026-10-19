"""Package 192 transparent Blender frames as an eight-second web asset."""
from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets'/'characters'/'commander'/'sword-ready'/'v001';OUT.mkdir(parents=True,exist_ok=True)
frames=[Image.open(ROOT/'animation'/'smile_grasp_web_frames'/f'frame_{i:04d}.png').convert('RGBA') for i in range(1,193)]
durations=[round((i+1)*1000/24)-round(i*1000/24) for i in range(192)]
frames[0].save(OUT/'idle.webp',format='WEBP',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=85,method=4,allow_mixed=True)
poster=frames[79]
poster.save(OUT/'poster.png');poster.save(OUT/'poster.webp',quality=92,method=6)
head=poster.copy();alpha=head.getchannel('A')
for y in range(head.height):
    factor=max(0,min(1,(148-y)/35))
    if factor<1:alpha.paste(alpha.crop((0,y,head.width,y+1)).point(lambda a:round(a*factor)),(0,y))
head.putalpha(alpha);head.save(OUT/'head.webp',quality=92,method=6)
check=Image.open(OUT/'idle.webp');assert check.size==(384,576);assert 1<check.n_frames<=192
elapsed=0
for i in range(check.n_frames):
    check.seek(i);check.load();elapsed+=check.info['duration']
    alpha=check.convert('RGBA').getchannel('A')
    assert alpha.getextrema()==(0,255)
    assert all(alpha.getpixel(p)==0 for p in [(0,0),(383,0),(0,575),(383,575),(192,540)]),('background alpha',i)
    assert alpha.getpixel((192,260))>240,('clothing opacity',i)
assert elapsed==8000,elapsed
meta={'characterId':'commander','animationId':'sword-ready','version':'v001','image':'idle.webp','poster':'poster.webp','width':384,'height':576,'sourceFrames':192,'encodedFrames':check.n_frames,'fps':24,'durationMs':elapsed,'loop':True,'alpha':True,'source':'animation/character_smile_grasp_transparent.blend','features':['confident smile with upper teeth','left hand grasps sword hilt','breathing','cape breeze']}
(OUT/'animation.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(dict(meta,bytes=(OUT/'idle.webp').stat().st_size)))
