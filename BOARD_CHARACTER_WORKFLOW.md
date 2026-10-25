# Board character artwork and animation workflow

Use this guide when converting the remaining roster or adding new characters to
the castle board. The approved visual reference is **Commander / snes-rpg / v002**.
Read `PROJECT_WORKFLOW.md`, `AGENTS.md`, and the target character's manifest first.
This guide records the approved approach; it does not authorize changing other
characters or automatically adding combat behavior.

## 1. Establish identity and scope

- Confirm the canonical character ID, original illustration, active board slot,
  clothing, face, palette, and signature equipment from files and manifests.
- Commander and Rogue are distinct. Guardian currently displays Cube Wanderer
  artwork; preserve that source-character/slot relationship.
- For a new character, establish a unique ID, name, source artwork and intended
  slot/profile before adding mappings. Never replace a roster character by inference.
- Create a new version under `assets/characters/<id>/snes-rpg/vNNN/`. Keep originals,
  approved exports, Blender sources and previous manifest entries intact.
- Asset production and game integration are separate scopes. Only integrate when
  requested. Board artwork is separate from Office/legacy animation presentation.

## 2. Design for readability at the real board size

Use original 2D SNES-inspired RPG pixel artwork with a consistent elevated overworld
camera. Preserve identity rather than copying Commander's costume onto everyone.

Prefer broad connected pixel clusters, a continuous dark outline, a clearly defined
face, distinctive hair and equipment, and strong separation between clothing
materials. Use roughly 24 shared colors and two or three shades per material as a
starting point. Remove noisy single-pixel shading and excessive dithering. Keep
lighting, head/body proportions and costume details consistent across poses.

Do not judge quality only from an enlarged source image. Fine illustrated detail
can disappear into scattered pixels on export. Nearest-neighbor filtering cannot
recover facial information that was discarded while shrinking the artwork.

The approved pipeline uses a **64×64 runtime master**, exported directly from the
refined source, and a separate **32×32 compatibility sheet**. Do not generate the
runtime master by enlarging the compatibility export. Use imagegen for new raster
artwork or creative edits; retain the generated source and exact prompt. Use export
tools for frame extraction, registration, palette encoding and technical validation.

## 3. Keep the 33-pose layout

Use 12 columns and 4 rows. Empty cells are fully transparent, without grid lines,
labels, checkerboard pixels, scenery, floor shadows or interface elements.

| Row | Columns | Pose IDs (one-based) | Action | Texture indices (zero-based) |
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

There are 33 occupied poses and 15 empty cells. Keep limbs, cape and weapon inside
each tile. Idle has subtle breathing/hair motion; walk alternates legs and opposite
arms, with restrained hair/cape follow-through. Attack has anticipation, action and
recovery. Hurt is a short recoil. Keep body landmarks and foot position registered.

Mirror right-facing frames for left-facing actions only when acceptable for that
character. If equipment asymmetry must remain anatomically correct, explicitly
author additional left-facing frames and update metadata/runtime mappings instead
of silently changing the meaning of the 33-pose layout.

## 4. Export and register

| Setting | Runtime master | Compatibility export |
| --- | --- | --- |
| Frame size | 64×64 | 32×32 |
| Sheet size | 768×256 | 384×128 |
| Last occupied foot row | 61 | 30 |
| Foot anchor | (32,62) | (16,31) |
| Normalized origin | (0.5,62/64) | (0.5,31/32) |

Standing figures should occupy about 90% of the frame height. Recoil may lower the
head; a raised weapon may extend higher. Anchor feet, not the visual bounding-box
center, and ensure weapon motion does not shift the body's horizontal registration.

Generated layouts may not be exact grids. Extract complete poses without importing
adjacent sprites, then register them on exact export cells. Use area-coverage
sampling when reducing refined source art, a shared material palette without
per-frame palette drift, and binary alpha. Inspect the result after sampling and
palette conversion; automated export alone is not artistic approval.

Deliver source artwork, generation prompt, both sprite sheets, metadata, a poster,
portrait/head, animated per-action previews, an overall preview and validation
reports. Copy only runtime assets into
`frontend/public/assets/characters/<id>/snes-rpg/vNNN/`; keep source/production files
in the versioned production folder. Update only the target character's manifest,
retaining previous versions for rollback.

## 5. Match the board footprint

Commander v002 uses 64px cells at **1.2×**, a 76.8px displayed square frame. This is
the same footprint as the previously reduced 32px cells at 2.4×. It retains the
requested 40% reduction from the original 32px-at-4× integration. It increases
available detail without enlarging the character on the board.

Use that footprint as the comparison reference for future characters, with modest
identity/proportion adjustments supported by actual board screenshots. Judge them
against furniture, nearby heroes, head size, silhouette width and walkway clearance.
Do not force every differently shaped character to have identical apparent height.

Keep the foot anchor fixed when changing scale. Match the ground shadow, focus halo,
pointer target and speech offset to the figure. Keep nameplates readable and avoid
focus-driven enlargement. Retain per-texture nearest filtering; do not change global
antialiasing or unrelated characters as a substitute for improving the target art.

## 6. Integrate per character

The current implementation is **Commander-specific**. Generalize its sprite
configuration/animation clock before opting another character into this pipeline;
changing a texture filename alone is insufficient. Each character must own its
texture key, paths, frame dimensions, sequences, display scale, anchor and fallbacks.

Relevant files:

- `frontend/src/app/features/game/engine/board-character-assets.ts`: board mapping.
- `frontend/src/app/features/game/engine/directional-walk.ts`: Commander configuration
  and animation clock, currently the reference for a future per-character API.
- `frontend/src/app/features/game/engine/character-controller.ts`: texture loading
  decisions, drawing, movement, reactions, focus and speech positioning.
- `frontend/src/app/features/game/engine/castle-scene.ts`: preload and scene updates.
- `characters/<id>/manifest.json`: production identity and version history.

Positive screen Y uses the front view; negative Y uses the back; horizontal motion
uses the appropriate side. Walking frames follow distance traveled (Commander:
one frame every 12 board pixels), preserving phase through turns and stopping when
movement stops. Idle uses three poses at 260ms each. Commander's attack is a 360ms
one-shot task-completion flourish; hurt is a 420ms reaction when a task becomes
blocked. Choose equivalent character-appropriate reactions deliberately.

Pause must freeze movement and animation clocks together. Reduced motion uses a
neutral directional pose and instant travel. Missing sprite sheets use that same
character's existing board poster. Preserve all other roster mappings, selection,
settings, canonical IDs, profile behavior and Office/legacy animations. Touch
`characters/registry.js` only when the authorized integration actually affects it.

## 7. Review and verify before calling the result finished

1. Validate dimensions, all 33 pose mappings, empty-cell transparency, binary alpha,
   shared palette, baselines and absence of clipped equipment/frame bleed.
2. Check the character on the real castle board at the actual viewport size. Capture
   before/after at the same position, facing, camera, pose and physical footprint.
   Inspect face, hair, hands, torso, outline and contrast against both rugs and floor.
3. Check front/back/both sides, walking/idle transitions, attack/hurt recovery, speed
   settings, pause/resume, reduced motion, focus and missing-texture fallback.
4. Verify Commander and Rogue remain separate and switch correctly, plus the target
   character and remaining roster. Run relevant engine tests and the production build.
5. When using a review agent, give it the actual board captures, exported sheets and
   exporter/runtime configuration. Ask for concrete defects and a final visual review;
   static review complements, but does not replace, runtime animation checks.

Document any resolution/layout change clearly. Preserve earlier versions so visual
comparison and rollback remain possible. Complete authorized integration rather than
delivering only a polished concept sheet.

## Approved reference files

- `assets/characters/commander/snes-rpg/v002/README.md`
- `assets/characters/commander/snes-rpg/v002/board-comparison.png`
- `assets/characters/commander/snes-rpg/v002/generation-prompt.txt`
- `animation/package_commander_snes_rpg_v002.py`
- `animation/verify_commander_snes_rpg_v002.mjs`

Adapt these examples to the target ID. Do not run a Commander packaging script
unchanged for another character: its identity, paths and manifest writes are specific.

## Reusable task brief

> Read BOARD_CHARACTER_WORKFLOW.md, PROJECT_WORKFLOW.md, AGENTS.md and the manifest
> for character `<id>`. Use Commander snes-rpg/v002 as the quality reference while
> preserving this character's own identity. Create the next version with 33 poses,
> a 64×64 runtime master and 32×32 compatibility sheet. Match the approved reduced
> board footprint, register feet, and keep a clear shared palette. Preserve originals
> and all other characters. [If integration is authorized: integrate only this
> character through per-character configuration and verify the board, pause/resume,
> reduced motion, fallback and Commander/Rogue switching.] Capture a matched
> before/after comparison, run relevant checks and document the resulting paths.
