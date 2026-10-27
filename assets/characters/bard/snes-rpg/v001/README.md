# Shadow Bard board sprites

Identity: bard / Shadow Bard. Short black hair, rectangular glasses, curled moustache and goatee, charcoal robes, burgundy cape/sash, gold trim, spellbook, crescent ornament and one purple-orb staff. Original Office artwork is preserved.

Built-in imagegen artwork exported with animation/package_bard_snes_rpg_v001.py. Requires Pillow and numpy. Source uses a 12-column, four-row layout with 33 occupied poses. Runtime uses 64px tiles at 1.2 scale and foot origin 62/64; independent 32px compatibility export included. Shared 24-color palette, binary alpha, registered foot baseline. Left movement mirrors right.

Shadow cast: lower hand, raise hand, violet pulse, lower hand, return. Durations 180/220/1300/180/140ms. Triggered by focus, work/review states and occasional idle; walking is driven by distance, pauses with the board, and respects reduced motion. Office mappings and all other roster assets remain separate.

Validation: asset-validation.json and browser-validation.json. Review contact-sheet.png, shadow-cast-preview.webp and board-preview.png at actual board size.
