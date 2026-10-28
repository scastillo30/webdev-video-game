# Game View guide

Game View is the Angular `/game` route. It uses Phaser for the castle simulation and Angular for accessible controls, connection state, activity details, and navigation. It is a presentation of shared Jira state, not a second Jira client.

## Runtime responsibilities

| Area | Owner |
| --- | --- |
| Canvas, board, characters, movement, effects | Phaser scene and controllers |
| Toolbar, bottom activity panel, buttons, text | Angular component |
| Jira snapshots/events | Root-scoped Angular Jira store |
| Character/status decisions | Game behavior service |
| Fair 15-second focus rotation | Spectator director |
| Persisted settings and mappings | Go + SQLite |

The Phaser instance is created once when the route mounts, runs outside Angular change detection, sleeps with a hidden document, and is destroyed on route exit.

## Board environment

The current scene is `castle-command-center`. Its environment image is:

`frontend/public/assets/game-board/castle-office-v001.png`

The image supplies appearance; code supplies movement rules. `castle-navigation.ts` defines a walkable grid, blocked furniture/walls, named interaction targets, and anchor positions. A* routes only through walkable cells. Destination reservations prevent characters from stacking on the same interaction location.

Characters can use workstations and shared targets such as the planning table, library/archive areas, QA board, consoles, and idle/home locations. The autonomous scheduler chooses low-frequency movement and social/work interactions; Jira directives can override ambient intent. Characters must not cross desks, walls, the fountain, the central table, or other mapped obstacles.

Only the active spectator character shows a Jira bubble; other characters keep their Jira-driven movement and state without opening competing bubbles. The active bubble presents the recorded action, ticket title, bold compact relative time (`10m ago`, `10h ago`, or `10d ago`), and status. Location labels and ambient conversation copy are not shown. When Jira or a character mapping cannot be read, the presentation shows `Cannot access JIRA Status`.

The board accepts both the shared Jira snapshot and the employee Jira Activity URL feed already used by the Jira Profile drawer. A linked, readable employee feed therefore drives the bubbles even when the optional shared snapshot reports `not configured`.

## Character presentation

Game View and Office View intentionally use separate but linked artwork:

- Canonical identity comes from the same character ID and profile.
- Office View keeps full-size animation, poster, and portrait mappings.
- Game View maps board-only sprites in `board-character-assets.ts`.
- Static board sprites live under `frontend/public/assets/game-board/characters/v001/`.
- Character-owned animated board versions live under `frontend/public/assets/characters/<id>/snes-rpg/vNNN/` when integrated.
- A custom character without an explicit board mapping falls back to its own approved profile miniature.

Feet are anchored to the ground position and the elliptical shadow is drawn beneath that anchor. Alpha, focus styling, and speech placement are controlled independently so sprites remain solid and grounded.

Commander currently demonstrates the animated directional runtime path. The shared integration must be generalized per character before adding another animated atlas; do not point a new character at Commander configuration. Follow [BOARD_CHARACTER_WORKFLOW.md](BOARD_CHARACTER_WORKFLOW.md).

## Character states

```text
IDLE → WALKING → WORKING / DISCUSSING / REVIEWING
                    ↘ BLOCKED / CELEBRATING
```

- `WALKING` is temporary while following a path.
- Persisted Jira status mappings use the other six states.
- Reactions are bounded and return to the state supported by current issue data.
- Movement speed and animation clocks use the same pause and speed controls.
- Reduced motion uses stable poses and instant/limited transitions instead of continuous walking animation.

## Jira-driven behavior

The behavior service joins three explicit inputs: normalized Jira data, Game configuration, and character profiles. It never infers a character from a name or from visual similarity.

For a mapped event author it:

1. Builds the character directive and selects the featured issue.
2. Groups pending activity from the same author.
3. Gives the spectator director a fair per-user item.
4. Moves/focuses the correct character and updates the Angular activity panel atomically.

Featured ticket rules are `recently-updated`, `highest-priority`, and `nearest-due-date`. Manual character selection pauses automatic rotation until Resume; Next advances presentation. Jira collection continues in all presentation pause states.

**Party Overview** clears the selected speaker and returns the lower panel and camera to the whole-party presentation. It pauses spectator rotation so the overview remains stable until Resume or another character is selected.

## Controls and preferences

Game View exposes controls for spectator pause/resume, next focus, effects, movement, sound, fullscreen, and view/settings navigation. Persistent values are edited at `/settings/game`.

Defaults:

- Spectator rotation: 15 seconds
- Jira refresh: 60 seconds
- Target rendering: 30 FPS
- TV mode: enabled
- Sound: disabled until user choice

`prefers-reduced-motion` is respected. Fullscreen must follow a direct user gesture. Keyboard focus stays in Angular controls rather than being trapped in the canvas.

## Adding or changing board visuals

1. Read [AGENTS.md](AGENTS.md), [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md), and the target manifest.
2. Preserve the Office mapping and every prior asset version.
3. Produce a new character-owned version when the change is character-specific.
4. Change only the target entry in `board-character-assets.ts` and any necessary per-character runtime metadata.
5. Keep the canonical ID and Jira profile unchanged.
6. Verify the target plus Commander and Rogue, including character switching.

Environment changes use a new versioned board filename and corresponding navigation update. Never paint runtime characters, labels, or UI into the background image.

## Acceptance checklist

- All eight roster identities render and switch correctly.
- Figures are opaque enough to read, feet touch their shadows, and shadows remain below sprites.
- Routes avoid walls, desks, table, fountain, bookcases, and other obstacles.
- Characters can reach their configured home, workstation, and shared interaction targets.
- Pause freezes movement and sprite animation; Resume continues coherently.
- Reduced motion uses still/directional fallbacks.
- Manual focus pauses only spectator rotation.
- Event author, focused character, ticket, and activity panel stay consistent.
- Leaving and returning to `/game` produces exactly one canvas.
- Office View artwork and animation mappings remain unchanged.

Run `npm run test:engine`, `npm run frontend:build`, and the relevant manual checks in [TESTING.md](TESTING.md).

## Holiday environment decorations

At `/settings/game`, choose **Holiday Decorations → Holiday Mode**: Standard, Halloween, or Christmas. Select individual item checkboxes, then **Save Configuration**. Halloween offers jack-o’-lanterns, bats, and cobwebs; Christmas offers trees, wrapped gifts, and garlands. Each season retains its item selections when switching modes. Standard hides all seasonal decorations. Preferences are validated and persisted in SQLite by migration `007_holiday_decorations.sql`.

The original background is preserved. Transparent, editable SVG decorations live in `frontend/public/assets/game-board/decorations/v001/`; placement is defined in `holiday-decorations.ts`. Floor items occupy existing blocked footprints, so navigation needs no changes. Wall items sit above the environment. These assets are independent of all roster artwork.

The fireplace has layered animated flames and rising embers. Its animation follows animation speed and runtime pause/resume, and uses a stable flame pose when environment effects are disabled or reduced motion is requested.


### Holiday backgrounds

Game settings → Holiday Backgrounds selects Standard, Christmas, or Halloween using the persisted `holidayMode`. The old item checkboxes are replaced; legacy `holidayItems` remains in the API for compatibility and no longer controls scene decorations.

Christmas uses the approved tree revision and adds twinkling tree lights plus gentle snow clipped to the three outside window openings. Halloween uses the approved background and adds a broomstick witch passing through those windows, fading away with a gap before returning. Both respect Environment Effects, animation speed, pause/resume, and reduced motion. Background changes preserve scene dimensions, navigation, and all character mappings.

Runtime images: `frontend/public/assets/game-board/backgrounds/v001/`. Source artwork remains under `assets/backgrounds/seasonal/`. Browser integration verification: `node animation/verify_holiday_backgrounds.mjs`.
