# Guardian board sprites and holographic cube reveal · v001

The **Guardian** roster slot uses the canonical **Cube Wanderer** character artwork.
This asset belongs to `cube-wanderer`, not Commander or the preserved legacy Guardian
illustration. Both manifests record this relationship. Office `cube-wind/v002`, its
Blender sources, all original artwork and the other seven board characters remain intact.

## Artwork and layout

Guardian keeps his short dark hair, black sunglasses, beard, brown coat with red lining,
charcoal shirt, olive trousers and brown boots. The shared quality reference is Commander
`snes-rpg/v002`, with Guardian's own material palette and silhouette.

The built-in imagegen tool generated `source-generated.png`; its exact prompt is saved
in `generation-prompt.txt`. `package_guardian_snes_rpg_v001.py` extracts complete poses,
registers their feet/body centers, exports direct source coverage into a shared material
palette and copies runtime files into the frontend public asset tree.

- `spritesheet-runtime.png`: 64×64 cells, 768×256 RGBA, 12 columns × 4 rows.
- `spritesheet.png`: 32×32 compatibility cells, 384×128 RGBA, identical sequence layout.
- Row1: three idle down, three idle up, three idle right; remaining three cells empty.
- Row2: four walk down, four walk up, four walk right.
- Row3: three cube-reveal down, three cube-reveal up, three cube-reveal right; three empty.
- Row4: hurt down/up/right, followed by nine empty cells.

There are 33 unique occupied poses and 15 transparent cells. The third row is a cube
ability, replacing Commander's sword action. Left uses mirrored right-facing poses;
the presentation hand consequently mirrors rather than preserving anatomical handedness.
Runtime foot baseline is row61 and anchor (32,62). Compatibility baseline is row30 and
anchor (16,31). A 1.2× runtime scale matches Commander's reduced 76.8px square frame.
Ground shadow, focus halo and nameplate follow that shared board presentation.

## Hand raise and reveal

The three special poses show the elbow beginning to bend, the palm rising with a small
cyan formation, and the raised palm presenting a cyan wireframe holographic cube.
The animation plays forward, holds, and reverses to put the hand back down:

| Step | Pose in directional group | Duration |
| --- | --- | --- |
| Begin lifting | 0 | 180ms |
| Raise / form hologram | 1 | 220ms |
| Reveal and hold full cube | 2 | 1300ms |
| Lower hand / fade formation | 1 | 180ms |
| Return to rest | 0 | 140ms |

Total: 2020ms at normal animation speed. Triggers: selecting Guardian while stationary,
entering work/review states, completion events, and after nine stationary idle seconds.
Walking immediately replaces the reveal with the walk cycle. Whole-game pause freezes
both motion and the reveal. Reduced motion uses neutral directional poses; disabled
effects suppress idle/reaction animation. Commander retains his independent sword
flourish and does not inherit Guardian's cube or periodic ability.

The shared `attack` action key is retained for sequence compatibility; Guardian's
`abilityName` is `cube-reveal`, and its timeline/triggers live in its own configuration.
This change adds no combat system or changes to board navigation or roster profiles.

## Previews, validation and reproduction

- `cube-reveal-preview.webp`: complete raise/hold/lower cycle in down/up/right views.
- `cube-reveal-down.webp`, `cube-reveal-up.webp`, `cube-reveal-right.webp`: individual loops.
- `runtime-sheet-2x.png`, `spritesheet-4x.png`, `contact-sheet.png`: inspection assets.
- `poster.png`, `poster.webp`, `head.webp`: Guardian-specific still/portrait exports.
- `board-preview.png`, `board-before.png`: actual castle scene after/before integration.
- `asset-validation.json`, `browser-validation.json`: automated verification reports.

Run the exporter with a Python containing Pillow/numpy:

```sh
python3 animation/package_guardian_snes_rpg_v001.py
.tools/node/bin/node animation/verify_guardian_snes_rpg_v001.mjs
```

The browser verifier uses the workspace Playwright path and installed Chrome. It checks
all Guardian movement directions, cube/recoil recovery, selection and work/review
triggers, movement settings, paused cube hold, reduced motion, same-character fallback,
Commander sword/movement regression and Rogue switching/movement. Both exported sheets
are checked for registered baselines, unique poses, shared palette and binary alpha.

Runtime mappings are in `board-character-assets.ts` and `directional-walk.ts`. Each
controller owns its own configuration and animation clock. The original Guardian board
still remains its fallback. `characters/registry.js` continues to own Office animations
and is unchanged. Use `BOARD_CHARACTER_WORKFLOW.md` for future character conversions.
