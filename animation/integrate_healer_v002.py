"""Activate the verified stronger Healer export; retain v001 in the manifest."""
from pathlib import Path
import copy, json, re
root=Path(__file__).resolve().parents[1]
web=root/'assets/characters/healer/crosier-victory/v002/web'
for name in ('idle.webp','poster.webp','head.webp','animation.json'):
    assert (web/name).is_file(), f'Missing export: {name}'
metadata=json.loads((web/'animation.json').read_text())
assert metadata['durationMs']==8000 and metadata['version']=='v002'
registry_path=root/'characters/registry.js'
text=registry_path.read_text()
match=re.search(r'Object.freeze\((\{.*\})\);',text,re.S)
registry=json.loads(match.group(1))
before=copy.deepcopy(registry)
assert registry['healer']['animationId']=='crosier-victory'
assert registry['healer']['version']=='v001'
for key in ('animation','poster','head'):
    registry['healer'][key]=registry['healer'][key].replace('/v001/','/v002/')
registry['healer']['version']='v002'
for id in before:
    if id!='healer': assert registry[id]==before[id]
registry_path.write_text(text[:match.start(1)]+json.dumps(registry,indent=2)+text[match.end(1):])
manifest_path=root/'characters/healer/manifest.json'
manifest=json.loads(manifest_path.read_text())
old=copy.deepcopy(manifest['animations']['crosier-victory'])
new={key:(value.replace('/v001/','/v002/') if isinstance(value,str) else value) for key,value in old.items()}
new['version']='v002'
new['changes']=['Bright cyan crosier center with broader outward blue radiance','Approximately five times the wrist rotation, with intact V fingers','Stronger anchored vest and loose-fabric sway']
new['previousVersions']={'v001':old}
manifest['animations']['crosier-victory']=new
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
index=root/'index.html'
index.write_text(index.read_text().replace('characters/registry.js?v=2','characters/registry.js?v=3'))
readme=root/'README.md'
readme.write_text(readme.read_text().replace('assets/characters/healer/crosier-victory/v001/web/','assets/characters/healer/crosier-victory/v002/web/'))
workflow=root/'PROJECT_WORKFLOW.md'
workflow.write_text(workflow.read_text().replace('| healer | 5 | crosier-victory / v001 / 8 seconds | assets/characters/healer/crosier-victory/v001/healer_crosier_victory.blend |','| healer | 5 | crosier-victory / v002 / 8 seconds | assets/characters/healer/crosier-victory/v002/healer_crosier_victory.blend |'))
print('Activated Healer v002; v001 retained in previousVersions. Other mappings preserved.')
