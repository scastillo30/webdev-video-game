# Moon Courier board sprites

Identity: courier / Moon Courier. Red hood and cape, cheerful gray-chinned beard, dark cropped trousers, brown boots/gloves/satchel, woven backpack carrying a gray cratered moon, and one crescent lantern. Original Office and board artwork are preserved.

Built-in imagegen source, exact prompts and exporter are retained. Reproduce using animation/package_courier_snes_rpg_v001.py with Pillow/numpy. Explicit source crop boundaries accommodate the generated layout; the fifth excess right-walk pose is omitted. Low-lantern anticipation reuses the same-facing idle pose. Last back-facing lantern pose mirrors the source to keep the lantern on the same screen side. All runtime frames use 64px tiles at scale1.2 and foot origin62/64; independent32px export, 24-color palette and binary alpha.

Idle, directional walking, lantern lift and hurt. Left mirrors right. Lantern sequence poses0/1/2/1/0 lasts180/220/1300/180/140ms and triggers on focus, work/review and occasional idle. Distance-driven walking, pause/resume and reduced-motion support are inherited from the shared board renderer. Other roster mappings remain separate.

Review contact-sheet.png, lantern-lift-preview.webp, board-preview.png, asset-validation.json and browser-validation.json.
