# Game View Phases 0–2 — Delivery Report

Date: 2026-10-24  
Branch: `codex/game-view-proposal`

## Phase 0 — Baseline protection

Delivered:

- Versioned SQLite migration runner with `schema_migrations`.
- Character ownership verification command: `npm run verify:characters`.
- SHA-256 guards for the active registry and approved Commander, Rogue, Guardian, Healer, and Swordsman runtime assets.
- Eight-roster identity check.
- Go tests for migrations, event uniqueness, Jira normalization, and author/assignee separation.

Character animations, manifests, registry mappings, Blender sources, and exports were not changed by Phases 0–2.

## Phase 1 — Shared Jira stream

Delivered:

- Go Jira source interface with explicit disabled and Jira Cloud implementations.
- Server-only Jira credentials and configurable JQL/poll interval.
- Current issue snapshots stored separately from activity events.
- Stable transition IDs and SQLite uniqueness prevent duplicate announcements.
- Event author and current assignee remain separate.
- First sync caches state without replaying historical transitions.
- REST snapshot at `/api/jira/snapshot`.
- SSE updates at `/api/jira/events` with connection and activity event types.
- Root-scoped Angular Jira store with snapshot hydration, event reduction, deduplication, and reconnect state.
- Same-origin Office View bridge; the embedded view does not start a second Jira integration.
- Explicit disconnected state when live Jira variables are absent. No backend demo fixtures.

## Phase 2 — Routes and Game View shell

Delivered:

- Angular Router with lazy routes:
  - `/` — Office View
  - `/game` — Game View foundation
  - `/characters` — existing character maintenance
  - `/settings/game` — configuration foundation
- Office View static hosting moved to `/legacy-game/` without changing its presentation.
- Compatibility redirect from `/game/index.html` to `/legacy-game/index.html`.
- New Game View navigation control and shared connection indicator.
- Game View Phase 2 shell with scene lifecycle start/stop and shared-stream status.
- Route teardown removes the Game View component and stops its animation-frame lifecycle while the Jira store stays alive.

## Verification completed

- `go test ./...`
- Go production build
- strict TypeScript type check
- Angular development build
- Angular production build
- character asset/identity guard
- browser verification of all four routes
- browser verification of Office View and all eight maintenance records
- browser verification of `/game/index.html` compatibility redirect
- browser verification of disconnected Jira snapshot truthfulness

## Required for live Jira

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_JQL` on the Go process. Until then, both views intentionally show Jira as disconnected/not configured.

## Deferred by the approved phase boundary

Phaser selection, castle rendering, pathfinding, character movement, behavior state machines, spectator rotation, and complete Game View settings remain in Phases 3–6.
