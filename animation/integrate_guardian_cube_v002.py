from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
base=root/'assets/characters/cube-wanderer/cube-wind/v002'
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
text=registry.read_text()
start=text.index('\n  "guardian": ')
end=text.index('\n  "commander"',start)
entry={'characterId':'cube-wanderer','animationId':'cube-wind','version':'v002','animation':'assets/characters/cube-wanderer/cube-wind/v002/web/idle.webp?v=2','poster':'assets/characters/cube-wanderer/cube-wind/v002/web/poster.webp?v=2','head':'assets/characters/cube-wanderer/cube-wind/v002/web/head.webp?v=2','width':384,'height':576}
text=text[:start]+'\n  "guardian": '+json.dumps(entry,indent=2).replace('\n','\n  ')+','+text[end:]
registry.write_text(text)
manifestpath=root/'characters/cube-wanderer/manifest.json'
manifest=json.loads(manifestpath.read_text());art=manifest['animations']['cube-wind'];art['gameIntegration']='Active in Guardian roster slot (guardian), replacing previous artwork by user request';art['gameAssets']=entry
manifest['gameSlot']='guardian';manifestpath.write_text(json.dumps(manifest,indent=2)+'\n')
p=root/'characters/guardian/manifest.json'
guardian=json.loads(p.read_text());old=guardian['animations']['cube-wind']
entry['previousVersions']={**old.get('previousVersions',{}),old['version']:{k:v for k,v in old.items() if k!='previousVersions'}}
guardian['animations']['cube-wind']=entry
p.write_text(json.dumps(guardian,indent=2)+'\n')
p=root/'index.html';p.write_text(p.read_text().replace('registry.js?v=4','registry.js?v=5'))
print('Guardian v002 ready')
