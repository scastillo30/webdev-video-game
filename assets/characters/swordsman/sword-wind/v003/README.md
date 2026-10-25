# Swordsman — Sword Wind v003

Eight seconds at 24 fps. The opening pose follows the supplied `reference_original.png`: elbow out to the viewer's left, forearm across the chest, closed hand near the chest and blade pointing about 27 degrees up-right. This corrects v002's outward raised guard.

The first 25 frames hold this chest guard while the cape moves. The sword then lowers, holds low guard, and returns to the same chest guard for a continuous loop. `poster.webp` uses frame 1, so loading and reduced-motion views use the requested opening pose as well.

The inward elbow bend is retained throughout: roughly 14 to 142 degrees of flexion. The hand and rigid sword remain attached to the wrist. `rig_validation.json` verifies the first-frame blade direction, inward forearm direction, fixed grip, arm lengths, closing pose and eight-second export.

Files: `start.png` is the reviewed opening still; `idle.webp` is the transparent animation; `swordsman_sword_wind.blend` is the editable packed source. The separate body, upper arm, forearm, closed hand and sword remain editable. Existing v002 textures are reused with revised joint poses and sword scale.

This is a 2.5D pose adaptation, not a pixel-identical reconstruction of the full reference or volumetric swordplay. Prior v001 and v002 files and game mappings are preserved. Activate v003 separately through game integration.
