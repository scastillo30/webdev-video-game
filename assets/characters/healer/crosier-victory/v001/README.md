# Healer — crosier victory v001

192 RGBA PNG frames at 1024 × 1536, 24 fps, 8 seconds. Film Transparent enabled. Fixed orthographic camera. All textures packed into `healer_crosier_victory.blend`.

This is a 2.5D animated illustration: localized mesh deformation preserves the painted anatomy and V fingers. It is not a volumetric 3D character or simulated cloth. Breathing, anchored fabric sway, and wrist motion are deliberately subtle. The blue aura and reflected light use transparent emission layers, preserving visible crosier details.

Frames 1–192 are the playback sequence. Frame 193 is an authoring closure key matching frame 1 and is intentionally excluded from playback. Blue intensity rises gradually and returns to its initial value, with gentle additional pulses.

`reference_original.png` preserves the supplied illustration and supplies all painted colors and details. `character_cutout.png` supplies only the transparency mask. Existing roster assets are preserved. The game uses the separate 384 × 576 exports in `web/`, activated through Healer's entry in `characters/registry.js`. The other character mappings are preserved.

Rebuild from the project root with Blender:

```
blender -b -t 6 --python animation/create_healer_crosier_v001.py
```

Or open the packed blend and Render → Render Animation. `idle.webp` is a compact transparent playback preview; the PNG sequence is the master output.
