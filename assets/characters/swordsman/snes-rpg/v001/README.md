# Swordsman board sprites

Swordsman retains swept black hair, clear rectangular glasses, charcoal jacket/trousers, brown straps and boots, red scarf, black gloves and one silver sword. Distinct from Commander. Original sword-wind/v004, earlier exports and Blender sources are preserved.

Built-in imagegen artwork; exact prompts and source images retained. Export with animation/package_swordsman_snes_rpg_v001.py using Pillow/numpy. Runtime 64px tiles, independent 32px compatibility, 24 shared colors, binary alpha, foot baseline61 and scale1.2. Layout: 12 columns/four rows, 33 occupied poses; left mirrors right.

Idle breathing/scarf, directional walking with alternating legs, chest-level sword guard and hurt reaction. Guard timeline poses0/1/2/1/0 lasting180/220/1300/180/140ms. Triggered by focus, work/review and occasional idle. Walking follows distance and respects pause/reduced motion. Original Office mapping remains unchanged.

Source sheet initially supplied three up-walk and five right-walk poses. The exporter discards the extra right pose and inserts the separately authored fourth up-walk source. Per-frame registration and a shared palette keep it consistent with the sheet. See contact-sheet.png, sword-guard-preview.webp, asset-validation.json and browser-validation.json.
