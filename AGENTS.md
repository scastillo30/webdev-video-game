# Preserve character ownership and prior work

- Read PROJECT_WORKFLOW.md and characters/<id>/manifest.json before changing character assets.
- Commander (`commander`) and Rogue (`rogue`) are TWO DIFFERENT characters. Never infer identity from visual similarity.
- Commander owns the smiling sword-grasp loop. Rogue owns the pointing, breathing, and glasses-glow loop.
- The other six roster characters and their assets must also be preserved.
- New animation work adds an animation/version under assets/characters/<id>/<animation>/vNNN/. Never overwrite an approved version unless the user explicitly requests replacement.
- Preserve original illustrations, Blender sources, and prior exports. Legacy assets/rogue-idle is a misnamed Commander export; preserve it as a legacy copy, not a Rogue animation.
- Character-production chats edit only that character's assets, manifest, and explicitly assigned Blender/export scripts. They must not change index.html or characters/registry.js unless the user authorizes game integration in that chat.
- Game-integration work updates characters/registry.js and shared game code, preserving all other character mappings. Verify both Commander and Rogue after integration, including pause/resume and character switching.
- Do not point one character's animation at another character's poster or head. Runtime animation/poster configuration belongs to each character separately.
- Source of truth is files and manifests, not remembered chat context. If identity is missing, ask before altering a roster mapping; asset preparation may continue.
