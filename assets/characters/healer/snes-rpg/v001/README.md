# Healer board sprites and healing pulse · v001

Healer's animated castle-board equivalent follows Commander snes-rpg/v002 and
Guardian's board workflow. Her blonde high ponytail, black sunglasses, ivory mantle
with red trim, olive shorts, dark leggings, brown boots and blue-gem wooden crosier
remain her own identity. Office crosier-victory/v002, its Blender source and previous
exports are preserved. No other roster character's assets or profile mapping change.

## Artwork and export

The built-in imagegen tool created `source-generated.png`, with the individual extra
walk-down step in `source-walk-down.png`. `generation-prompt.txt` contains the exact
selected prompts; `reference-walk-down.png` preserves the pose reference used for
the additional step. The exporter selects and reorders generated walking poses so
the final row has four down, four up and four right steps. It registers each body
and foot baseline rather than trusting the generated layout. Back healing poses
two and three are mirrored during registration to keep the staff on the same side
as the neutral/back-walking poses. Left-facing runtime actions mirror right.

- `spritesheet-runtime.png`: 768×256 RGBA, 12×4 cells of 64×64 pixels.
- `spritesheet.png`: 384×128 RGBA, 32×32 compatibility cells, same frame indices.
- 33 unique occupied poses and 15 empty cells; shared 26-color material palette;
  binary alpha; feet at row61 (runtime) / row30 (compatibility).
- Runtime anchor (32,62), scale1.2: same 76.8px square footprint as Commander/Guardian.
- Row1: three idle down, three idle up, three idle right, three empty.
- Row2: four walk down, four walk up, four walk right.
- Row3: three healing down, three healing up, three healing right, three empty.
- Row4: hurt down/up/right, nine empty.

`runtime-sheet-2x.png` and `spritesheet-4x.png` are inspection enlargements;
`contact-sheet.png` labels the action groups. Poster/head assets belong to Healer.
Metadata includes sequence indices and source registration records.

## Crosier lift and healing pulse

The special action lifts the crosier, brightens its blue gem to cyan and presents
a two-finger victory gesture. The final pose emits a compact cyan healing pulse
around the gem. It then reverses back to the neutral position:

| Pose | Meaning | Duration |
| --- | --- | --- |
| 0 | Prepare / begin lifting staff | 200ms |
| 1 | Lift and raise free hand | 240ms |
| 2 | Hold cyan healing pulse and victory gesture | 1000ms |
| 1 | Release / lower | 180ms |
| 0 | Settle to rest | 180ms |

Total1800ms at normal speed. Triggers: selecting Healer while stationary, work/review
states, completion events, and ten stationary seconds. Walking cancels the cast.
Pause freezes animation and travel together; reduced motion holds neutral poses.
Disabled effects suppress stationary animation. The shared `attack` sequence slot
is named `healing-pulse` in Healer's configuration; it adds no combat system.

## Integration and validation

`HEALER_WALK` in `directional-walk.ts` owns the texture, sequence mappings, scale,
anchor and trigger/timing configuration. `board-character-assets.ts` opts only Healer
into it. The existing shared controller loads this configuration independently from
Commander and Guardian. The previous Healer board still remains the fallback.
Runtime exports are copied to `frontend/public/assets/characters/healer/snes-rpg/v001/`.
The legacy/Office `characters/registry.js` entry is not changed.

Reproduce the asset export with `animation/package_healer_snes_rpg_v001.py` using
Python with Pillow/numpy. Browser checks use
`animation/verify_healer_snes_rpg_v001.mjs`, workspace Playwright and installed Chrome.

The production build and all16 engine tests passed. Browser checks cover all facings,
walking/idle, healing/recoil recovery, selection and work/review triggers, paused
casting, motion settings, reduced motion and Healer fallback. Regression checks cover
Commander's sword flourish, Guardian's cube and Rogue's existing movement/texture.
`asset-validation.json` verifies both exported sizes, 33 unique poses, binary alpha,
baselines and shared palette. `browser-validation.json` records runtime checks.

`healing-pulse-preview.webp` shows the complete action in down/up/right views;
individual action WebPs are also supplied. `board-preview.png` and `board-before.png`
show the real castle scene at the same camera and location.
