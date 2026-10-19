from pathlib import Path
from PIL import Image
import json
root=Path('/Users/scastillo/Documents/ChatGPT/Crawl Website/Webdev Video-Game')
out=root/'assets/characters/cube-wanderer/cube-wind/v002'
files=sorted((out/'frames').glob('frame_*.png'))
assert len(files)==192,len(files)
frames=[Image.open(p).convert('RGBA') for p in files]
durations=[round((i+1)*8000/192)-round(i*8000/192) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,quality=92,method=4)
frames[0].save(out/'poster.png');frames[72].save(out/'preview.png')
frames[0].crop((200,5,325,140)).resize((256,256)).save(out/'head.webp',quality=95)
contact=Image.new('RGB',(512*3,768),'#263544')
for i,k in enumerate([0,64,128]):contact.paste(frames[k],(i*512,0),frames[k])
contact.save(out/'motion_review.jpg',quality=92)
meta=dict(characterId='cube-wanderer',animationId='cube-wind',version='v002',fps=24,frameCount=192,durationSeconds=8,width=512,height=768,technique='2.5D original illustration mesh and 27 animated 3D wireframe cells',rotationDegrees=180,gameIntegration='Not integrated',source='assets/characters/cube-wanderer/cube-wind/v002/cube_wanderer_cube_wind.blend',animation='assets/characters/cube-wanderer/cube-wind/v002/idle.webp',poster='assets/characters/cube-wanderer/cube-wind/v002/poster.png',head='assets/characters/cube-wanderer/cube-wind/v002/head.webp',limitations='Illustration-based mesh with manually traced silhouette; not a volumetric character or physical cloth simulation.')
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
manifestpath=root/'characters/cube-wanderer/manifest.json'
manifest=json.loads(manifestpath.read_text())
old=manifest['animations']['cube-wind']
meta['previousVersions']={**old.get('previousVersions',{}),old['version']:{k:v for k,v in old.items() if k!='previousVersions'}}
meta['changes']=['Wind restricted to lower coat tails; pants and upper body fixed','Cube lowered and centered within palm, smaller, with foreground fingers']
manifest['animations']['cube-wind']=meta
manifestpath.write_text(json.dumps(manifest,indent=2)+'\n')
(out/'README.md').write_text('# Cube Wanderer — cube wind v001\n\n8 seconds, 24 fps, 192 frames. Open cube_wanderer_cube_wind.blend and play frames 1–192. All textures packed. Wind deforms coat fabric; 27 cube cells move independently while their parent rotates 180 degrees. A half-turn closes visually through cube symmetry.\n\nThe character uses a manually traced 2.5D illustration mesh, not a full 3D model. Original uploaded illustration preserved. Transparent WebP, PNG sequence, poster, portrait and motion contact sheet included. v002: lower coat tails only; pants fixed. Cube centered on palm with fingers in front.\n')
print('Packaged',len(frames),'frames;',sum(durations),'ms')
