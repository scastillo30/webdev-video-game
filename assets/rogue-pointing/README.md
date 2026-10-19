# Transparent pointing character

- `pointing.webp`: six-second looping animation with subtle breathing, glowing glasses, and the pointing gesture; 384 × 576, rendered at 24 fps with alpha. Held frames may be merged by the encoder without changing timing.
- `poster.webp` / `poster.png`: transparent still at the pointing pose.
- `head.webp`: registered transparent portrait layer for the existing dialogue framing.
- `animation.json`: dimensions, timing, and source metadata.

Use as a standard image, for example:

```html
<img src="assets/rogue-pointing/pointing.webp" width="384" height="576" alt="Rogue pointing toward you">
```

The game mounts the animation as a single image in the Rogue slot, preventing separate head/body drift. The still replaces it for Pause, reduced motion, hidden pages, open modals, and idle economy mode. Resuming restarts the animation; animated WebP does not expose a seekable playback clock. Custom character artwork overrides retain their existing behavior.

Editable source: `animation/character_pointing_breathing.blend`, with packed body, arm, shoulder seam, and glasses glow layers. Previous versions are retained separately. Rebuild with Blender's `animation/export_latest_web.py`, then run `animation/package_web.py` with Python and Pillow. The website uses versioned asset URLs to refresh previously cached exports.

Background extraction used the built-in imagegen tool. Final extraction prompt: remove only parchment and ground shadow from the armless body plate; preserve the registered 1024 × 1536 character, beige coat, scarf, boots, face and glasses; output actual transparency, leave the missing right arm missing. The separate pointing arm and shoulder seam are composited in Blender.
