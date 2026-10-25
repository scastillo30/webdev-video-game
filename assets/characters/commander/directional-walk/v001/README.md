# Commander directional movement · v001

This version adds four-direction walking to the Angular/Phaser castle board. It preserves Commander's original illustration, sword-ready/v001 animation, Blender sources, legacy landing-page registry, and the other seven roster mappings. Guardian and Rogue remain separate characters.

## Recommendation and research

Author a small volumetric character in Blender, animate it once, render each pose from four orientations through an orthographic camera, and play the resulting transparent sprite sheet in Phaser. Blender is an authoring tool, not a new browser runtime dependency. A single front-facing illustration cannot supply a genuine back view merely by flipping it.

Phaser's [animation documentation](https://docs.phaser.io/phaser/concepts/animations) describes frame-based sprite animation, and its [sprite-sheet documentation](https://docs.phaser.io/phaser-editor/scene-editor/working-with-spritesheets) explains packing frames in a regular grid. Blender's [camera documentation](https://docs.blender.org/manual/en/latest/render/cameras.html) describes orthographic projection, which avoids perspective size changes. These sources support the pipeline; the frame counts, cadence and behavior below are design choices for this board, not claims about the original Chrono Trigger implementation.

The board's pathfinder moves in cardinal steps, so four facings match its actual navigation. If diagonal movement is added later, add diagonal views or consistently choose the dominant velocity axis. Do not rotate the flat sprite to simulate facing.

## Movement rules

- Positive screen Y: front view. Negative Y: back view. Negative X: left profile. Positive X: right profile. Left and right are separately rendered so the sword stays on the proper hip.
- Eight walk poses per direction, plus a neutral standing pose. A complete cycle spans 96 board pixels, with a new frame every 12 pixels. At the base speed (48 pixels per 340 ms), this is about 12 pose changes per second. Translation remains smooth and linear.
- Choose facing from the next path segment. Keep gait phase through turns. Stop on a neutral frame in the last facing; no treadmill motion at a desk.
- Alternate legs and swing arms in opposition. Hair tufts and cape have small delayed motion. Pose changes are baked into the sprite sheet.
- Use nearest-neighbor texture sampling and 2× sprite scaling. Focus uses a halo rather than fractional enlargement for Commander. Feet share a registered anchor at (24,57) in a 48×64 frame.
- The distance clock does not advance when the game is paused. Movement settings pause/resume the active movement tween; changing animation speed changes both translation and gait cadence. Reduced motion uses a stationary directional pose and instant repositioning.
- Continue using the existing Y-based board depth and navigation obstacles. The sprite animation does not change collision or pathfinding.

## Files and reproduction

- `commander_directional_walk.blend`: editable volumetric model, named limb/hair/cape pivot hierarchy, keyed poses, camera, materials and render settings.
- `spritesheet.png`: 432×256 RGBA; rows down/left/right/up, nine columns (standing, then eight walk poses).
- `walk-down.webp`, `walk-left.webp`, `walk-right.webp`, `walk-up.webp`: transparent looping direction previews.
- `preview.webp`: all four directions animated together; `contact-sheet.png`: every pose; `board-preview.png`: actual Phaser scene.
- `metadata.json`, `poster.png`, `poster.webp`, `head.webp`: packaging metadata and character-specific fallbacks.
- `browser-validation.json`: browser verification report.

From the project root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python animation/create_commander_directional_walk_v001.py
python3 animation/package_commander_directional_walk_v001.py # Python with Pillow
.tools/node/bin/node animation/verify_commander_directional_walk_v001.mjs
```

The packager copies runtime files to `frontend/public/assets/characters/commander/directional-walk/v001/`. The board asset map opts only Commander into this sprite sheet. If the sheet fails to load, the controller uses Commander's existing board poster. The browser verifier currently uses the installed Chrome and the workspace runtime's Playwright; adjust its import for other machines.

## Prototype limits

This is an original, faceted Blender-to-pixel Commander prototype, not a hand-drawn Chrono Trigger sprite. The silhouettes and directional mechanics are implemented; reaching that game's particular pixel-art finish would need a hand-authored pixel cleanup pass. Limbs use rigid articulated pieces rather than skinned anatomy, and hair/cape follow-through is keyed rather than simulated. Idle holds a neutral pose. No running, attacks, diagonal views, or additional character walk cycles are included in v001.

Rollback: remove Commander's `directional` entry from `board-character-assets.ts` to restore its original board still. The legacy `characters/registry.js` mapping stays unchanged by this work.
