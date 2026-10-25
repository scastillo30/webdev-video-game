"""Package Swordsman v003 while retaining v001 and all runtime mappings."""
from PIL import Image
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parent.parent
base=root/'assets/characters/swordsman/sword-wind'; out=base/'v003'
files=sorted((out/'frames').glob('frame_*.png'))
assert len(files)==192,len(files)
frames=[Image.open(p).convert('RGBA') for p in files]
duration=[round((i+1)*1000/24)-round(i*1000/24) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=duration,loop=0,quality=93,method=5,minimize_size=False)
frames[0].save(out/'poster.webp',quality=95)
shutil.copy2(base/'v001/head.webp',out/'head.webp')
assert (out/'reference_original.png').exists()
shutil.copy2(out/'raised.png',out/'start.png')
im=Image.open(out/'idle.webp'); total=0
for i in range(im.n_frames):
    im.seek(i); im.load(); total+=im.info.get('duration',0)
assert total==8000,total
validation=json.loads((out/'rig_validation.json').read_text())
validation['exportDurationMs']=total
validation['webpFrames']=im.n_frames
validation['visualReviewFrames']=[1,49,97,149]
(out/'rig_validation.json').write_text(json.dumps(validation,indent=2)+'\n')
prefix='assets/characters/swordsman/sword-wind/v003/'
meta=dict(characterId='swordsman',animationId='sword-wind',version='v003',fps=24,sourceFrames=192,durationMs=8000,width=frames[0].width,height=frames[0].height,source=prefix+'swordsman_sword_wind.blend',animation=prefix+'idle.webp',poster=prefix+'poster.webp',head=prefix+'head.webp',technique='Articulated 2.5D illustration: separate upper arm, forearm, closed hand and rigid sword',gameIntegrated=False,changes=['Opening frame revised to supplied inward chest-guard reference','Forearm crosses chest and blade points 27 degrees up-right','Inward elbow bend maintained through entire lowering and return','Opening poster matches the first animation frame','Rigid sword and fixed grip retained; v001 and v002 preserved'],validation=prefix+'rig_validation.json',limitations='Illustrated movement in the image plane; no volumetric hand articulation or simulated sword mass.')
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
manifest=root/'characters/swordsman/manifest.json'; data=json.loads(manifest.read_text())
previous=data['animations']['sword-wind']
if previous.get('version')!='v003':meta['previousVersions']={previous['version']:previous}
else:meta['previousVersions']=previous.get('previousVersions',{})
data['animations']['sword-wind']=meta
manifest.write_text(json.dumps(data,indent=2)+'\n')
(out/'README.md').write_text("""# Swordsman — Sword Wind v003

Eight seconds at 24 fps. The opening pose follows the supplied `reference_original.png`: elbow out to the viewer's left, forearm across the chest, closed hand near the chest and blade pointing about 27 degrees up-right. This corrects v002's outward raised guard.

The first 25 frames hold this chest guard while the cape moves. The sword then lowers, holds low guard, and returns to the same chest guard for a continuous loop. `poster.webp` uses frame 1, so loading and reduced-motion views use the requested opening pose as well.

The inward elbow bend is retained throughout: roughly 14 to 142 degrees of flexion. The hand and rigid sword remain attached to the wrist. `rig_validation.json` verifies the first-frame blade direction, inward forearm direction, fixed grip, arm lengths, closing pose and eight-second export.

Files: `start.png` is the reviewed opening still; `idle.webp` is the transparent animation; `swordsman_sword_wind.blend` is the editable packed source. The separate body, upper arm, forearm, closed hand and sword remain editable. Existing v002 textures are reused with revised joint poses and sword scale.

This is a 2.5D pose adaptation, not a pixel-identical reconstruction of the full reference or volumetric swordplay. Prior v001 and v002 files and game mappings are preserved. Activate v003 separately through game integration.
""")
print(json.dumps(meta,indent=2))
