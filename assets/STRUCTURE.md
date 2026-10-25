# Asset structure

New assets follow these locations. Existing legacy files remain in place so approved game mappings do not break.

- `assets/characters/<character-id>/<animation-id>/<version>/` — character-owned versioned animation, poster, portrait/head, sources, metadata, validation, and web exports.
- `assets/thumbnails/characters/` — small roster/card thumbnails.
- `assets/thumbnails/comments/` — square dialogue and comment portraits.
- `assets/worlds/` — backgrounds and realm artwork.
- `assets/other/` — shared effects, UI decoration, and uncategorized imports awaiting review.
- `frontend/public/assets/game-board/` — runtime castle environments, board manifests, and shared/static board sprites.
- `frontend/public/assets/characters/<character-id>/...` — copies of explicitly integrated character-owned Game View runtime assets only.

`assets/catalog.json` indexes legacy/application assets. `characters/<id>/manifest.json` remains authoritative for identity, ownership, approved versions, source files, and rollback history. `frontend/src/app/features/game/engine/board-character-assets.ts` is the active Game View board mapping; `characters/registry.js` is the Office View animation mapping. They are separate and must not silently point to another character's files.

Use a new `vNNN` directory for every approved revision. Never overwrite source illustrations, Blender files, previous exports, validation reports, or animation versions. Read `AGENTS.md`, `PROJECT_WORKFLOW.md`, and the target manifest before changing character assets; use `BOARD_CHARACTER_WORKFLOW.md` for board sprites.
