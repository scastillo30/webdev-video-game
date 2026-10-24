# Game View Phases 3–4 — Delivery Report

Date: 2026-10-24
Branch: `codex/game-view-proposal`

## Phase 3 — Castle, movement, and workstations

Delivered:

- Phaser 3.90 renderer, lazy-loaded only on `/game` and run outside Angular change detection.
- A top-down castle command center with a 30×15 collision grid, room furniture, named anchors, workstations, review/quest points, gates, restrained lighting, and eight visible roster characters.
- Deterministic A* routing around blocked tiles and occupied destinations.
- Per-character controllers and state machines for idle, walking, working, discussing, reviewing, blocked, and celebrating states.
- Low-frequency ambient motion, bounded celebration particles, and character focus/dimming.
- Hidden-tab loop suspension and complete renderer teardown when leaving `/game`.
- Reduced-motion mode disables ambient tweens and uses instant travel.
- SQLite `character_game_profiles` with separate, approved miniature and portrait references for all eight characters.

No animation, manifest, Blender, registry, or character-owned asset was changed. Commander and Rogue remain separate profiles with separate visual references.

## Phase 4 — Jira behavior and spectator mode

Delivered:

- Shared Jira snapshots translated into persistent character states by explicit assignee mapping.
- Activity reactions translated by event-author mapping only; an assignee is never substituted for the author.
- Stable event-ID deduplication and grouped pending events per mapped character.
- Fair round-robin selection across authors and a 15-second presentation interval.
- Manual character focus, Pause/Resume, and Next controls. Manual focus pauses automatic rotation while Jira collection continues.
- One-time bounded completion reactions and signature guards preventing unchanged snapshots from restarting movement.
- Truthful speech labels: workflow transitions mention previous/new status only when both are available; absent current status remains `PENDING SYNC` in the activity panel.
- Explicit live, reconnecting, stale, disconnected, and not-configured display states.
- Keyboard-accessible focus buttons for all eight roster characters.

## Configuration boundary

Migration `003_game_profiles.sql` seeds every `jira_account_id` as `NULL`. This intentionally prevents invented people-to-character associations. Phase 5 will add the validated settings UI/API for maintaining stable Jira-account mappings. Until then, the simulation renders and manual focus works, but live events will not activate a character unless mappings are populated through an approved database migration or administrative workflow.

## Verification completed

- Go test suite and production server build.
- Strict TypeScript type check and Angular production build.
- Browser verification that `/game` renders one Phaser canvas and eight character controls.
- Browser verification of manual Commander focus, paused spectator state, Resume, and return to overview.
- Route-change verification that the renderer tears down and remounts as exactly one canvas.
- Browser verification that the existing Office View still renders all eight roster characters.
- Client-console verification after the final build with no Game View bundle errors.
- Character ownership/asset guard.

## Deferred to later phases

- Phase 5: persistent Game View settings, Jira mapping editor/API, and expanded TV activity-panel controls.
- Phase 6: automated engine/E2E coverage, long-duration CPU/memory soak tests, and final bundle/performance tuning.
