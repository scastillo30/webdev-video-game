# Character production and game integration

For future board sprite work, follow [BOARD_CHARACTER_WORKFLOW.md](BOARD_CHARACTER_WORKFLOW.md).
It records the approved Commander v002 visual approach, 33-pose layout, 64px runtime
master, 32px compatibility export, reduced board scale, integration and review steps.

Commander and Rogue are different characters. Commander has the smile/sword-grasp idle; Rogue has the earlier pointing/breathing/glasses-glow loop. Keep both selectable in the eight-character roster.

## Current ownership

| Character ID | Game shortcut | Default animation | Editable Blender source |
|---|---|---|---|
| commander | 1 | sword-ready / v001 / 8 seconds | animation/character_smile_grasp_transparent.blend |
| guardian (cube-wanderer artwork) | 2 | cube-wind / v002 / 8 seconds | assets/characters/cube-wanderer/cube-wind/v002/cube_wanderer_cube_wind.blend |
| rogue | 3 | pointing / v001 / 6 seconds | animation/character_pointing_breathing.blend |
| healer | 5 | crosier-victory / v002 / 8 seconds | assets/characters/healer/crosier-victory/v002/healer_crosier_victory.blend |
| swordsman | 7 | sword-wind / v004 / 8 seconds | assets/characters/swordsman/sword-wind/v004/swordsman_sword_wind.blend |

`characters/<id>/manifest.json` records character identity, animation versions and preserved original assets. `characters/registry.js` is the runtime mapping owned by the integration chat. The two are intentionally separate: production can add an animation to a manifest before integration makes it active.

## Separate chats

1. Give each production chat a fixed character ID and named animation, for example: "Commander / sword-ready" or "Rogue / pointing".
2. Scope that chat to its character folder and assigned Blender/export scripts. New work writes a new version such as `assets/characters/commander/sword-ready/v002/`.
3. Deliver a transparent animated WebP, a transparent still poster, a registered portrait, animation metadata, an editable packed Blender source, and a preview. Update only that character's manifest.
4. Use one game-integration chat to activate approved versions in the registry and test switching among all affected characters. Keep the prior version's entry in the manifest for rollback.
5. Keep shared project instructions in AGENTS.md so separate chats read the same ownership rules.

Prompt for production chats:

> Work on character `<id>` and animation `<animation>` only. Read AGENTS.md and its manifest. Create the next version without overwriting approved assets. Preserve all other characters. Export and preview the result, update this character's manifest, and leave shared game integration unchanged.

Prompt for the integration chat:

> Integrate approved animation `<animation/version>` for `<character-id>`. Change only that character's active registry mapping. Preserve all other roster characters and animations. Verify character switching, transparent rendering, pause/resume, and reduced-motion fallbacks.

## Version control

This workflow document does not enable Git. Before parallel development, initialize a Git repository and save a baseline. Use a separate branch/worktree for each production chat and merge approved work through the integration chat. Separate chats in the same local directory can edit the same files; chat separation alone is not isolation. Keep renders reproducible and retain source files and exported approved assets in backups. Large Blender files may warrant Git LFS or a separate versioned asset backup.

## Legacy files

`assets/rogue-pointing/` remains the approved Rogue export. `assets/rogue-idle/` was incorrectly named during earlier integration; its artwork belongs to Commander. Its content was copied non-destructively to `assets/characters/commander/sword-ready/v001/`. Original asset files and all existing Blender projects remain available. The Commander packaging script now targets the Commander folder.
