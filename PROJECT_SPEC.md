# WEBDEV MMORPG — current product specification

**Status:** Current product baseline

**Audience:** Product, design, engineering, QA, and operations

**Supersedes:** The current-runtime portions of the historical [GAME_SPEC.md](GAME_SPEC.md)

## Product purpose

WEBDEV MMORPG makes software-team activity visible as a continuously running fantasy workplace. Real Jira actions activate the explicitly mapped character, drive a readable activity presentation, and influence the character's behavior in a shared castle office. The same data is available in a cinematic Office View and a top-down Game View.

The product is a team-awareness display, not a replacement for Jira and not an employee-ranking system. It must represent recorded activity accurately, preserve user/character identity, and make connection freshness obvious.

## Experience model

| Experience | Primary use |
| --- | --- |
| Office View | Cinematic character focus, dialogue, personal activity history, and original fantasy presentation |
| Game View | Ambient TV display with board movement, work/social interactions, ticket focus, and automatic spectator rotation |
| Character maintenance | Add, edit, or remove editable character metadata in SQLite |
| Game settings | Configure display behavior, anchors, stable Jira mappings, scope filters, and status mappings |
| Operations | Inspect build identity, health, freshness, poller diagnostics, and safe audit history |

## Functional requirements

### Shared Jira activity

- The backend performs one Jira poll for the application.
- Credentials remain server-side.
- Issue snapshots and activity events are normalized and persisted separately.
- Event author and ticket assignee remain separate.
- Stable event IDs prevent duplicate persistence and announcements.
- Initial synchronization does not replay old Jira history as new activity.
- Both views consume the same Angular store and report truthful live, reconnecting, stale, or disconnected state.

### Character identity

- The canonical roster contains eight distinct IDs: Commander, Guardian, Rogue, Tech Mage, Healer, Moon Courier, Swordsman, and Shadow Bard.
- Stable Jira account IDs map explicitly to at most one character.
- Unmapped users remain unmapped; their work is never assigned to another character.
- Office and board artwork may differ, but both link through the canonical character ID.
- Commander and Rogue remain separate regardless of visual similarity or legacy filenames.
- Approved animation and sprite versions remain available for rollback.

### Office View

- Preserve the original character designs, full-size animations/stills, backgrounds, navigation, dialogue, overview, history, party selection, and controls.
- A Jira event focuses the correct character and updates dialogue/history consistently.
- Manual selection pauses automatic presentation until resumed without stopping collection.
- Pause and reduced motion use the selected character's own poster/fallback.

### Game View

- Render the castle office, all enabled board characters, environmental emphasis, and an accessible Angular activity panel.
- Characters walk only through mapped walkable space and route around furniture/walls.
- Feet align with shadows; characters remain visually solid and readable.
- Characters can use configured workstations, home positions, and shared work/social anchors.
- Jira status and activity drive bounded working, discussing, reviewing, blocked, and celebrating behavior.
- Spectator mode rotates fairly at a configurable interval, groups same-user activity, and avoids repeated events.
- Manual focus, Pause/Resume, Next, effects, movement, sound, fullscreen, target FPS, TV scale, and reduced motion behave consistently.

### Administration and persistence

- Character metadata and Game configuration persist in SQLite.
- Configuration updates validate every character, unique Jira mappings, safe asset paths, anchors, ranges, and behavior values before an atomic save.
- Embedded migrations are ordered and forward-only.
- Backup is live-safe; restore and destructive retention require explicit confirmations.
- Mutating API operations produce privacy-bounded audit metadata.

## Visual requirements

- Preserve dark navy panels, refined gold ornamentation, cyan magical accents, ivory readable text, and fantasy serif headings.
- Game board characters use linked late-16-bit/SNES-style equivalents, separate from Office artwork.
- Ticket key, concise summary, action/status, relative time, character identity, pending state, and connection freshness remain readable at television distance.
- Text wraps without overlapping portraits, badges, or controls.
- State is communicated with text/icons as well as color.

## Non-functional requirements

- Angular owns accessible application UI; Phaser owns only simulation rendering.
- One Phaser instance exists per mounted Game View and is destroyed on exit.
- Rendering sleeps or reduces work when hidden, paused, or reduced motion is requested.
- Ambient effects and autonomous decisions are bounded for long-running displays.
- Production uses a single Go process/origin and a local SQLite file.
- API inputs are bounded and validated; cross-origin access is opt-in.
- Release artifacts are checksummed and exclude credentials and production source art.
- A four-hour target-host soak with manual CPU/GPU/thermal observations is required for release certification.

## Out of scope for the current baseline

- Multiplayer gameplay, accounts, combat, inventory, leveling, or a persistent RPG world.
- Browser-side Jira authentication.
- Automatic character assignment from names, emails, appearance, or ticket assignment.
- Replacing Jira workflows or providing full Jira administration.
- Editing Blender/source animation assets from the web maintenance UI.
- Treating demo fixture activity as live.

## Acceptance baseline

The current product is acceptable when:

1. Office and Game load from their documented routes and share one Jira state.
2. New activity activates only the mapped author character and is not repeated.
3. Dialogue/panel, history, character focus, and issue data agree.
4. Multiple users rotate fairly; manual focus, Pause/Resume, and Next are coherent.
5. Board characters stay grounded, route around obstacles, and reach valid interaction anchors.
6. All eight identities and both presentation asset sets remain intact.
7. Reduced motion, keyboard controls, hidden-tab lifecycle, and long text are usable.
8. SQLite configuration survives restart and invalid configuration is rejected atomically.
9. Health, readiness, operations, backup, restore safeguards, retention preview, and release verification work.
10. `npm run quality:check` passes and the release host passes the documented soak gate.

Implementation details live in [ARCHITECTURE.md](ARCHITECTURE.md), [OFFICE_VIEW.md](OFFICE_VIEW.md), [GAME_VIEW.md](GAME_VIEW.md), [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md), and [DATABASE.md](DATABASE.md).
