"""Package Swordsman v004 while retaining v001 and all runtime mappings."""
from PIL import Image
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parent.parent
base=root/'assets/characters/swordsman/sword-wind'; out=base/'v004'
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
prefix='assets/characters/swordsman/sword-wind/v004/'
meta=dict(characterId='swordsman',animationId='sword-wind',version='v004',fps=24,sourceFrames=192,durationMs=8000,width=frames[0].width,height=frames[0].height,source=prefix+'swordsman_sword_wind.blend',animation=prefix+'idle.webp',poster=prefix+'poster.webp',head=prefix+'head.webp',technique='Articulated 2.5D illustration with connected sleeve fold, turning cuff and authored wrapped-hilt grip',gameIntegrated=False,changes=['New hand-and-hilt artwork with curled fingers and opposing thumb','Hilt and hand share authored contact; rigid blade shares wrist control','Elbow pivot registered at actual visible sleeve mouth','Continuous cloth fold and cuff turn with the forearm','Bare forearm root underlaps cuff without old glove fragments','Eight-second reference-start loop retained; earlier versions preserved'],validation=prefix+'rig_validation.json',limitations='Illustrated movement in the image plane; no volumetric hand articulation or simulated sword mass.')
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
manifest=root/'characters/swordsman/manifest.json'; data=json.loads(manifest.read_text())
previous=data['animations']['sword-wind']
if previous.get('version')!='v004':meta['previousVersions']={previous['version']:previous}
else:meta['previousVersions']=previous.get('previousVersions',{})
data['animations']['sword-wind']=meta
manifest.write_text(json.dumps(data,indent=2)+'\n')
(out/'README.md').write_text("""# Swordsman — Sword Wind v004

Eight seconds at 24 fps. Fixes two visual defects from v003:

- The new authored hand closes its exposed fingers and thumb around the brown leather hilt. Hand, hilt and guard are painted together; the straight blade is a separately editable mesh registered to the same texture and rigid wrist control. There is no floating hand overlay or independent hilt movement.
- The forearm is anchored at the actual sleeve mouth (source upper-sleeve artwork x210/y760). The cuff turns with the forearm, and a continuous textured elbow fold connects it to the shoulder sleeve. The skin root extends beneath the cuff lip. Old glove fragments were removed from the bare-forearm mesh.

The reference chest-guard opening and eight-second lowering/return loop are retained. `poster.webp` uses frame 1. `connection_review_001.png`, `connection_review_049.png`, `connection_review_097.png`, and `connection_review_149.png` provide close-up checks of the grip and cuff through the motion.

`rig_validation.json` records sleeve-mouth attachment and visible cuff-center registration for all 193 verification frames, fixed grip, rigid arm lengths, exact loop closure and 8,000 ms export duration. The authored grip and cloth silhouette also received visual review; transform checks alone are not evidence of correct anatomy.

Open `swordsman_sword_wind.blend` for packed, editable sources. Separate shoulder sleeve, elbow fold, turning cuff, forearm, hand/hilt/guard and blade objects are named in the scene. The `wrapped_grip_sword.png` texture is preserved. This is illustrated 2.5D animation, not volumetric swordplay or cloth simulation.

All earlier versions, original references and other character assets remain preserved. Runtime game mappings were not edited; activate v004 through the integration chat.
""")
print(json.dumps(meta,indent=2))
