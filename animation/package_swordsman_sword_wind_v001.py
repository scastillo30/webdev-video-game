"""Package rendered Swordsman frames without changing game integration."""
from PIL import Image
from pathlib import Path
import json, shutil
root=Path(__file__).resolve().parent.parent
out=root/'assets/characters/swordsman/sword-wind/v001'
paths=sorted((out/'frames').glob('frame_*.png'))
assert len(paths)==192, f'Expected 192 frames, got {len(paths)}'
frames=[Image.open(p).convert('RGBA') for p in paths]
dur=[round((i+1)*1000/24)-round(i*1000/24) for i in range(192)]
frames[0].save(out/'idle.webp',save_all=True,append_images=frames[1:],duration=dur,loop=0,quality=90,method=5,minimize_size=False)
frames[96].save(out/'poster.webp',quality=95)
shutil.copy2(root/'assets/swordsman_head.webp',out/'head.webp')
check=Image.open(out/'idle.webp'); elapsed=0
for i in range(check.n_frames):
    check.seek(i); check.load(); elapsed+=check.info.get('duration',0)
assert elapsed==8000,elapsed
base='assets/characters/swordsman/sword-wind/v001/'
meta=dict(characterId='swordsman',animationId='sword-wind',version='v001',fps=24,sourceFrames=192,durationMs=elapsed,width=frames[0].width,height=frames[0].height,source=base+'swordsman_sword_wind.blend',animation=base+'idle.webp',poster=base+'poster.webp',head=base+'head.webp',technique='Layered 2.5D illustrated puppet; reconstructed hidden artwork',gameIntegrated=False)
(out/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
manifest=root/'characters/swordsman/manifest.json'
data=json.loads(manifest.read_text()) if manifest.exists() else dict(id='swordsman',name='Swordsman',defaultAnimation='sword-wind',animations={},legacyAssetsPreserved=['assets/swordsman_full.webp','assets/swordsman_body.webp','assets/swordsman_head.webp'])
data['animations']['sword-wind']=meta
manifest.write_text(json.dumps(data,indent=2)+'\n')
(out/'README.md').write_text('# Swordsman — Sword Wind v001\n\nEight seconds at 24 fps. Sword begins raised, lowers to the reference pose, holds, then returns for the loop. Cape is pinned at the waist with two wind waves.\n\nOpen `swordsman_sword_wind.blend`: separate body, upper arm, forearm/sword, and cape objects; armature controls the elbow. All texture artwork is packed. Hidden artwork was reconstructed with image generation, so this is an adapted illustration rather than an exact pixel cutout.\n\n`idle.webp` is the transparent animated preview; `poster.webp` is the lowered pose. Prior assets and game mappings remain preserved. Build and packaging scripts are in `animation/`.\n')
print(json.dumps(meta,indent=2))
