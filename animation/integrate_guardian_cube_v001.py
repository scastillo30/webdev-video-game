from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
base=root/'assets/characters/cube-wanderer/cube-wind/v001'
web=base/'web';web.mkdir(exist_ok=True)
frames=[Image.open(p).convert('RGBA').resize((384,576),Image.Resampling.LANCZOS) for p in sorted((base/'frames').glob('frame_*.png'))]
assert len(frames)==192
ms=[round((i+1)*8000/192)-round(i*8000/192) for i in range(192)]
frames[0].save(web/'idle.webp',save_all=True,append_images=frames[1:],duration=ms,loop=0,quality=88,method=4)
frames[0].save(web/'poster.webp',quality=95)
head=frames[0].copy()
alpha=head.getchannel('A')
for y in range(head.height):
 factor=max(0,min(1,(148-y)/35))
 if factor<1:alpha.paste(alpha.crop((0,y,head.width,y+1)).point(lambda a:round(a*factor)),(0,y))
head.putalpha(alpha);head.save(web/'head.webp',quality=95)
registry=root/'characters/registry.js'
text=registry.read_text();pos=text.index('\n  "commander"')
entry={'characterId':'cube-wanderer','animationId':'cube-wind','version':'v001','animation':'assets/characters/cube-wanderer/cube-wind/v001/web/idle.webp?v=1','poster':'assets/characters/cube-wanderer/cube-wind/v001/web/poster.webp?v=1','head':'assets/characters/cube-wanderer/cube-wind/v001/web/head.webp?v=1','width':384,'height':576}
if '\n  "guardian"' not in text:
 text=text[:pos]+'\n  "guardian": '+json.dumps(entry,indent=2).replace('\n','\n  ')+','+text[pos:]
 registry.write_text(text)
manifestpath=root/'characters/cube-wanderer/manifest.json'
manifest=json.loads(manifestpath.read_text());art=manifest['animations']['cube-wind'];art['gameIntegration']='Active in Guardian roster slot (guardian), replacing previous artwork by user request';art['gameAssets']=entry
manifest['gameSlot']='guardian';manifestpath.write_text(json.dumps(manifest,indent=2)+'\n')
guardian={'id':'guardian','name':'Guardian','activeCharacterId':'cube-wanderer','replacementAuthorizedByUser':True,'animations':{'cube-wind':entry},'legacyAssetsPreserved':['assets/guardian_full.webp','assets/guardian_body.webp','assets/guardian_head.webp'],'notes':'Guardian roster slot retains its name, DevOps role, dialogue, and shortcut 2. The cube-wanderer source character owns this animation, poster, and registered head.'}
p=root/'characters/guardian';p.mkdir(exist_ok=True);(p/'manifest.json').write_text(json.dumps(guardian,indent=2)+'\n')
print('Guardian game bundle ready')
