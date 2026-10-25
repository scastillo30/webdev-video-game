# Commander visual refinement · v002

This version is active on the castle board. Commander keeps the reduced board
footprint from v001: a 76.8px square frame with the same foot anchor, shadow,
selection target, speech offset and nameplate. No other character artwork changed.

## Review and approach

A separate visual-review agent inspected the original board capture, source art,
32px tiles and export code. Its diagnosis was that detailed source shading was
being sampled down into scattered 32px pixels, losing glasses and material edges.
Nearest-neighbor texture filtering was already enabled. Enlarging the character or
changing the whole board's rendering settings would not restore missing detail.

The refined artwork uses larger flat color groups, stronger navy/gold/ivory coat
separation, a clearly defined face and glasses, a red cape, and simpler hair shading.
The built-in imagegen tool created the new artwork using Commander's original
illustration and the previous pose sheet as references. `generation-prompt.txt`
contains the exact prompt; `source-generated.png` preserves the returned image.

The review of its 32px export showed that this resolution still lost useful facial
detail. The agent recommended a 64px runtime master at 1.2× display scale, retaining
the same physical size as the prior 32px sheet at 2.4×. The 33-pose 32×32 export is
also retained for compatibility. **Runtime resolution is now 64×64 per frame; the
compatibility export remains 32×32 per frame.**

## Assets

- `spritesheet-runtime.png`: 768×256 RGBA, 12 columns × 4 rows, 64px runtime cells.
- `spritesheet.png`: 384×128 RGBA, identical layout, 32px compatibility cells.
- `runtime-sheet-2x.png`, `spritesheet-4x.png`: nearest-neighbor inspection images.
- `preview.webp`: animated idle/walk/attack comparison, with down/up/right columns.
- Separate animated WebP sequences and character-specific poster/head exports.
- `metadata.json`: all 33 pose indices, palette and both export dimensions.
- `board-before.png`, `board-preview.png`: matched actual-board captures at the
  same camera, pose and displayed frame size.
- `board-comparison.png`: unscaled side-by-side crops from those captures.
- `browser-validation.json`, `asset-validation.json`: validation results.

Both sheets use 24 shared material colors, binary transparency, 33 unique occupied
poses and 15 empty transparent cells. Runtime feet align to row61 with the anchor
at (32,62); compatibility feet align to row30 with anchor (16,31). These anchors
produce exactly the same screen position. The runtime master is exported directly
from the refined source with area-coverage sampling, not enlarged from 32px data.

## Integration and validation

The active texture and display parameters are in `directional-walk.ts`; the existing
Commander controller consumes them. Per-texture nearest filtering is retained.
Idle, distance-driven walking, task-completed sword flourish and blocked-task hurt
reactions keep their existing timings. Left-facing actions mirror right-facing ones.

The production build and all 11 engine tests passed. The browser verifier exercised
all four directions, idle recovery, attack/hurt events, movement settings, pause and
resume, reduced motion, Commander/Rogue switching, and missing-texture fallback.
It also asserted that before/after displayed frame sizes match. The second agent's
final inspection found a clear readability improvement and no blocking defect in
the supplied board captures; temporal behavior was checked separately in-browser.

Reproduce export with `animation/package_commander_snes_rpg_v002.py` (Pillow/numpy),
and browser checks with `animation/verify_commander_snes_rpg_v002.mjs` (workspace
Playwright and installed Chrome). The previous v001 and Blender assets are preserved,
with v001 retained in Commander's manifest under `previousVersions`.
