# Commander · SNES RPG · v001

Active in the Angular/Phaser castle board. This version replaces the board's
Commander walk prototype with a 2D pixel sprite sheet. All original illustrations,
the previous Blender prototype, sword-ready/v001, and the other seven characters
are preserved. The legacy landing-page registry remains unchanged by this version.

## Deliverables

- `spritesheet.png`: exact 384×128 RGBA, a 12-column × 4-row grid of 32×32 cells.
- 33 occupied cells and 15 completely transparent unused cells.
- `spritesheet-4x.png`: nearest-neighbor 1536×512 inspection enlargement.
- `contact-sheet.png`: labeled inspection sheet; not loaded by the game.
- `preview.webp`: animated idle/walk/attack comparison; directions down/up/right.
- Separate idle, walk, attack, and hurt WebP previews for each direction.
- `poster.png`, `poster.webp`, `head.webp`, and `metadata.json`.
- `source-generated.png` and `generation-prompt.txt`: preserved artwork source
  and exact prompt, generated with the built-in imagegen tool using the user's
  attached sprite sheet as a style reference and Commander's illustration for identity.
- `board-preview.png` and `browser-validation.json`: actual Phaser integration check.

## Layout

Pose numbers are one-based identifiers from the requested specification. Texture
indices are zero-based indices in the rectangular 12-column Phaser sheet.

| Row | Columns | Pose IDs | Action | Phaser texture indices |
| --- | --- | --- | --- | --- |
| 1 | 1–3 | 1–3 | Idle down | 0–2 |
| 1 | 4–6 | 4–6 | Idle up | 3–5 |
| 1 | 7–9 | 7–9 | Idle right | 6–8 |
| 2 | 1–4 | 10–13 | Walk down | 12–15 |
| 2 | 5–8 | 14–17 | Walk up | 16–19 |
| 2 | 9–12 | 18–21 | Walk right | 20–23 |
| 3 | 1–3 | 22–24 | Attack down | 24–26 |
| 3 | 4–6 | 25–27 | Attack up | 27–29 |
| 3 | 7–9 | 28–30 | Attack right | 30–32 |
| 4 | 1–3 | 31–33 | Hurt down/up/right | 36–38 |

Left-facing actions mirror the right-facing sequence, as only three drawn facings
were requested. Sprite feet register to pixel row30, with runtime origin (16,31).
Standing bodies are about 28–29px high; hurt is shorter because of recoil and the
raised sword extends above the head in attack poses. Every exported pixel stays
within its 32×32 tile. A common 32-color palette, binary alpha, and nearest-neighbor
sampling keep the native pixel structure crisp. The runtime draws at 2.4× scale,
40% smaller in width and height than the initial 4× integration, to fit the other
board characters and furniture. The shadow, focus halo, pointer target and speech
bubble offset follow the smaller figure; the foot anchor and nameplate remain
unchanged. Focus uses the halo without enlarging the character.

## Board behavior

Idle uses three frames at 260ms per pose. Walk uses four frames, advancing every
12 board pixels; pause and stopping cannot leave the feet running in place. Attack
is a one-shot three-frame sword flourish, 120ms per pose, triggered by the existing
CELEBRATING/task-completed event. Hurt is a 420ms reaction on entering BLOCKED.
Both return to idle. These are board-event reactions; this change does not add a
combat system. Movement cancels reactions. Idle/reaction clocks run in Phaser's
update loop, so the global game pause freezes them. Reduced motion holds a neutral
directional pose. Missing sprite sheets fall back to Commander's prior board still.

## Reproduction

`animation/package_commander_snes_rpg_v001.py` exports the preserved generated
source using Pillow and numpy. It separates the 33 whole sprites, registers them,
samples an exact native pixel grid, and applies one shared palette. It also updates
only Commander's manifest and copies runtime files into
`frontend/public/assets/characters/commander/snes-rpg/v001/`.

`animation/verify_commander_snes_rpg_v001.mjs` runs the real CastleScene in Chrome
and checks the runtime sequences, all four directions, idle recovery, motion
settings, pause/resume, reduced motion, missing-sheet fallback, and preservation
of Rogue. It uses the local workspace's Playwright dependency path.

Runtime definitions live in `directional-walk.ts`, Commander's board opt-in lives
in `board-character-assets.ts`, and the controller connects actions to board events.
No new Blender file is needed: this version uses 2D artwork rather than 3D renders.
