# Asset structure

New assets follow these locations. Existing legacy files remain in place so approved game mappings do not break.

- `assets/characters/<character-id>/<animation-id>/<version>/` — versioned animation, poster, head, sources, and web exports.
- `assets/thumbnails/characters/` — small roster/card thumbnails.
- `assets/thumbnails/comments/` — square dialogue and comment portraits.
- `assets/worlds/` — backgrounds and realm artwork.
- `assets/other/` — shared effects, UI decoration, and uncategorized imports awaiting review.

`assets/catalog.json` is the application-facing index. Character manifests remain authoritative for ownership and approved animation versions.
