# Tech Mage board sprites

Identity: mage / Tech Mage. Smiling clean-shaven man, dark gray-templed hair, clear glasses, navy/gold coat, ivory/red tunic, red scarf, olive trousers, brown boots/straps, cyan vials and brass gadgets. Signature equipment is a cyan orb in brass gyroscope rings, separate from Guardian's cube.

Built-in imagegen artwork and exact prompt retained. Reproduce with animation/package_mage_snes_rpg_v001.py using Pillow/numpy. Explicit source boundaries accommodate uneven generated spacing and omit the fifth excess right-walk pose. Export33 poses on12x4 grid, 64px runtime at scale1.2 with foot origin62/64 and independent32px compatibility. Shared24-color palette, binary alpha and aligned baseline.

Idle and distance-driven directional walking; palm raises, orb forms, brass-ring orb appears, then hand lowers. Timeline poses0/1/2/1/0 lasting180/220/1300/180/140ms. Focus, work/review and occasional idle trigger summon. Left mirrors right. Pause/resume, reduced motion and missing-texture fallback use the shared renderer. Original Office artwork and other roster mappings remain separate.

Review contact-sheet.png, orb-summon-preview.webp, board-preview.png, asset-validation.json and browser-validation.json.
