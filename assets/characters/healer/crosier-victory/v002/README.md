# Healer — crosier victory v002

Stronger Blender revision of v001: a bright cyan center and broader pulsing blue radiance, approximately five times the wrist rotation, and substantially stronger vest and loose-fabric movement. The painted V fingers, crosier shape, character colors, and overall pose are preserved.

The animation remains an eight-second 2.5D illustration loop: 192 RGBA PNGs at 24 fps, 1024 × 1536, Film Transparent, fixed camera. Frame 193 is the closure key matching frame 1 and is excluded from playback. All textures are packed into `healer_crosier_victory.blend`.

`reference_original.png` supplies the original painted colors and details. `character_cutout.png` supplies only the transparency mask. Version v001 and all other roster characters are preserved. Game-sized exports and a full-canvas registered portrait are in `web/`.

Rebuild from the project root:

```
blender -b -t 8 --python animation/create_healer_crosier_v002.py
```

`idle.webp` previews the transparent loop. `png_sequence.zip` contains the master PNG sequence and its metadata.
