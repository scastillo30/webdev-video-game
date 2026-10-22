"""Package Swordsman v002 while retaining v001 and all runtime mappings."""
from PIL import Image
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parent.parent
base=root/'assets/characters/swordsman/sword-wind'; out=base/'v002'
files=sorted((out/'frames').glob('frame_*.png'))
assert len(files)==192,len(files)
frames=[Image.open(p).convert('RGBA') for p in files]
duration=[round((i+1)*1000/24)-round(i*1000/24) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=duration,loop=0,quality=93,method=5,minimize_size=False)
frames[96].save(out/'poster.webp',quality=95)
shutil.copy2(base/'v001/head.webp',out/'head.webp')
shutil.copy2(base/'v001/reference_original.png',out/'reference_original.png')
im=Image.open(out/'idle.webp'); total=0
for i in range(im.n_frames):
    im.seek(i); im.load(); total+=im.info.get('duration',0)
assert total==8000,total
validation=json.loads((out/'rig_validation.json').read_text())
validation['exportDurationMs']=total
validation['webpFrames']=im.n_frames
validation['visualReviewFrames']=[1,49,97,149]
(out/'rig_validation.json').write_text(json.dumps(validation,indent=2)+'\n')
prefix='assets/characters/swordsman/sword-wind/v002/'
meta=dict(characterId='swordsman',animationId='sword-wind',version='v002',fps=24,sourceFrames=192,durationMs=8000,width=frames[0].width,height=frames[0].height,source=prefix+'swordsman_sword_wind.blend',animation=prefix+'idle.webp',poster=prefix+'poster.webp',head=prefix+'head.webp',technique='Articulated 2.5D illustration: separate upper arm, forearm, closed hand and rigid sword',gameIntegrated=False,changes=['New arm, closed glove and isolated sword artwork','Fixed shoulder and continuous elbow and wrist hierarchy','Hilt locked behind fingers, rigid blade, no grip sliding','Anatomical elbow stays flexed rather than reversing through straight extension','Controlled easing with low and raised guard holds'],validation=prefix+'rig_validation.json',limitations='Illustrated movement in the image plane; no volumetric hand articulation or simulated sword mass.')
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
manifest=root/'characters/swordsman/manifest.json'; data=json.loads(manifest.read_text())
previous=data['animations']['sword-wind']
if previous.get('version')!='v002':meta['previousVersions']={previous['version']:previous}
else:meta['previousVersions']=previous.get('previousVersions',{})
data['animations']['sword-wind']=meta
manifest.write_text(json.dumps(data,indent=2)+'\n')
(out/'README.md').write_text('''# Swordsman — Sword Wind v002

Eight seconds at 24 fps. This revision fixes v001’s cuff pivot and fixed upper arm. New illustrated upper sleeve, forearm, closed hand and isolated sword parts form an articulated shoulder → elbow → wrist → grip hierarchy. The hilt sits behind the curled fingers, with the guard below the fist. The sword and hand share a wrist transform, so the blade stays rigid and the hilt cannot slide.

The low guard maintains about six degrees of anatomical elbow flexion. The raised guard reaches about 126 degrees. Wrist adjustment stays between two and eight degrees. A controlled lowering, hold, lift and raised hold complete the loop; the cape retains its independent wind motion.

Open `swordsman_sword_wind.blend` and edit the named CTRL objects. All textures are packed. `idle.webp` is the transparent animated preview; `poster.webp` is the low guard. Review poses: `raised.png`, `transition.png`, `lowered.png`, `lifting.png`. `rig_validation.json` records transform, arm length, grip and loop checks across frames 1–193, plus export duration.

This is an illustrated 2.5D puppet, with movement in the image plane. It improves the joint mechanics and grip continuity; it is not a volumetric swordplay simulation. Generated artwork reconstructs the moving parts. All v001 exports and original art are preserved. The runtime registry remains unchanged and still uses its previously integrated version.
''')
print(json.dumps(meta,indent=2))
