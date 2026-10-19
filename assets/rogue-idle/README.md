# Rogue: smile and sword grasp

An eight-second, 24 fps looping RGBA WebP, rendered from `animation/character_smile_grasp_transparent.blend`. The illustration has no parchment or floor shadow.

- `idle.webp`: 384 × 576 animation; 192 source frames.
- `poster.webp` / `poster.png`: smiling closed-grip still for pause, reduced motion, hidden tabs, and modals.
- `head.webp`: registered portrait with a feathered lower edge.
- `animation.json`: verified duration, dimensions, frame count, and source.

To rebuild: run `animation/export_smile_grasp_web.py` in Blender, then run `animation/package_smile_grasp_web.py` with a Python environment containing Pillow.

The material retains the original illustration colors and uses only the generated cutout alpha for the silhouette. Smile and glove are localized painted keypose blends; body and cape use deformation shape keys. Both original art and alpha matte are packed into the Blender source.

Background extraction used the built-in imagegen tool. Prompt: Remove all parchment and floor/cast shadow; return a genuine RGBA cutout at the same 1024 × 1536 registration, preserving the original character, sword, full cape, boots, fine hair, and outfit. Remove exterior and between-leg gaps, preserve cream clothing and skin, with no redesign or baked checkerboard.
