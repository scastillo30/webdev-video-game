"""Package rendered RGBA frames as a portable animated WebP and PNG poster."""
from PIL import Image
import os,json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frames_dir=os.path.join(ROOT,'animation','web_frames')
out=os.path.join(ROOT,'assets','rogue-pointing')
os.makedirs(out,exist_ok=True)
frames=[Image.open(os.path.join(frames_dir,f'frame_{i:04d}.png')).convert('RGBA') for i in range(1,145)]
durations=[round((i+1)*1000/24)-round(i*1000/24) for i in range(144)]
temporary=os.path.join(out,'pointing-export.tmp')
frames[0].save(temporary,format='WEBP',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=80,method=4,allow_mixed=True)
os.replace(temporary,os.path.join(out,'pointing.webp'))
poster=frames[51]
poster.save(os.path.join(out,'poster.png'))
poster.save(os.path.join(out,'poster.webp'),quality=90,method=6)
# Head retains full canvas registration for existing portrait framing.
head=poster.copy()
alpha=head.getchannel('A')
for y in range(head.height):
    factor=max(0,min(1,(148-y)/35))
    if factor<1:
        alpha.paste(alpha.crop((0,y,head.width,y+1)).point(lambda a:round(a*factor)),(0,y))
head.putalpha(alpha)
head.save(os.path.join(out,'head.webp'),quality=90,method=6)
check=Image.open(os.path.join(out,'pointing.webp'))
# WebP merges identical held frames while preserving their display duration.
assert 1<check.n_frames<=144
assert check.size==(384,576)
encoded_duration=0
for index in range(check.n_frames):
    check.seek(index)
    check.load()
    encoded_duration+=check.info['duration']
assert encoded_duration==6000
for index in (0,29,51,111,check.n_frames-1):
    check.seek(index)
    alpha=check.convert('RGBA').getchannel('A')
    assert alpha.getpixel((0,0))==0
    assert alpha.getextrema()==(0,255)
    assert alpha.getpixel((190,280))>240, 'Opaque clothing must be preserved'
with open(os.path.join(out,'animation.json'),'w') as f:
    json.dump({'image':'pointing.webp','poster':'poster.webp','width':384,'height':576,'sourceFrames':144,'encodedFrames':check.n_frames,'fps':24,'durationMs':encoded_duration,'loop':True,'alpha':True,'source':'animation/character_pointing_breathing.blend','features':['pointing gesture','subtle breathing','glasses glow']},f,indent=2)
print(json.dumps({'path':out,'frames':check.n_frames,'durationMs':sum(durations),'bytes':os.path.getsize(os.path.join(out,'pointing.webp'))}))
