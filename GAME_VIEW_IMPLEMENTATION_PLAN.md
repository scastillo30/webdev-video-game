# WEBDEV MMORPG — Game View Implementation Plan

> **Implemented historical plan.** This document records the migration decisions and phased intent. For current behavior and operating instructions, use [`ARCHITECTURE.md`](ARCHITECTURE.md), [`GAME_VIEW.md`](GAME_VIEW.md), and [`docs/README.md`](docs/README.md).

Status: **Phases 0–17 implemented; target-hardware soak sign-off remains an operational release gate**
Branch: `codex/game-view-proposal`  
Scope rule: **Do not modify, regenerate, overwrite, or remap existing character animations or character-owned assets.**

## 1. Executive decision

Implement Office View and Game View as independent Angular presentation layers over one normalized Jira event stream:

```text
Jira
  -> Go Jira adapter and poller
  -> normalization + change detection + SQLite cache
  -> SSE event stream and REST snapshots
  -> singleton Angular Jira store
      -> Office View bridge/presentation
      -> Game View behavior engine/presentation
```

This is the recommended architecture. It creates one Jira integration, avoids duplicate polling, keeps both views synchronized, and allows later presentation modes without changing Jira ingestion.

The first release will prioritize character movement, workstation interactions, ticket-driven state changes, the bottom activity panel, and automatic spectator mode. Elaborate RPG behaviors remain a later increment.

## 2. Current-state findings

### Angular

- The Angular 18 application is currently a single standalone root component.
- It has no Angular Router and switches between the embedded legacy game and character maintenance with a boolean.
- The existing main presentation is loaded through an iframe at `/game/index.html`.
- Character maintenance calls the Go `/api/characters` endpoints.
- There is no shared Jira state service in Angular today.

### Go and SQLite

- Go currently serves character CRUD, the Angular production build, and the legacy static game.
- SQLite currently contains only the `characters` table.
- There is no Go Jira client, Jira poller, normalized issue store, change detector, event history, SSE endpoint, or settings API.
- Jira credentials are not currently present in browser or server code.

### Existing Jira presentation

- `jira/activity.js` already provides useful browser-side normalization, deduplication, per-author grouping, and fair rotation behavior.
- `jira/config.js` separates real mappings from demo-only mappings.
- The current legacy presentation can consume a browser adapter, but it does not share a durable server-side stream.
- Demo fixtures are clearly labeled and must remain opt-in and excluded from live production state.

### Character and asset constraints

- The roster contains eight distinct characters.
- Commander and Rogue are separate identities and retain separate animation ownership.
- Existing animations, posters, portraits, manifests, registry mappings, Blender sources, and prior exports are protected.
- Not every character has a four-direction pixel sprite atlas.

The new engine will therefore use a `CharacterVisualProfile` adapter that references existing approved assets without changing them. Movement can initially translate the existing miniature/thumbnail representation around the map, with horizontal facing where safe. The renderer will support directional atlases later, but will not fabricate, regenerate, or substitute character artwork.

## 3. Route and hosting decision

The proposed Angular `/game` route conflicts with Go's current `/game/` static-file mount. Resolve this before feature work:

- `/` becomes the unchanged Office View route.
- `/game` becomes the new Angular Game View route.
- `/characters` becomes character maintenance.
- `/settings/game` becomes Game View settings.
- Move the legacy static mount to `/legacy-game/` and update only the iframe source used by Office View.
- Keep a narrow compatibility redirect for old `/game/index.html` bookmarks during migration, while allowing `/game` and `/game/` to fall through to the Angular SPA.

This changes hosting paths but does not redesign Office View.

## 4. Proposed frontend architecture

Use Angular Router and lazy-loaded feature routes. Keep Phaser outside Angular change detection and create exactly one engine instance per mounted Game View.

```text
frontend/src/app/
  core/
    jira/
      jira-event.service.ts
      jira-store.service.ts
      jira.models.ts
    characters/
      character.service.ts
      character.models.ts
  features/
    office/
      office-view.component.*
      office-event-bridge.service.ts
    game/
      game-view.component.*
      engine/
        game-engine.service.ts
        castle-scene.ts
        character-controller.ts
        character-state-machine.ts
        character-pathfinding.ts
        spectator-director.ts
      components/
        game-toolbar/
        activity-panel/
        connection-indicator/
    characters/
      character-maintenance.component.*
    settings/game/
      game-settings.component.*
```

### Rendering choice

Use Phaser 3 after a small compatibility spike. It provides the camera, tilemap, collisions, animation lifecycle, texture caching, and scale modes needed for a continuous TV display without driving Angular change detection every frame.

Fallback decision: if the spike exposes unacceptable bundle, lifecycle, or performance problems, retain the same engine interfaces and implement the scene with Canvas 2D. Jira and UI architecture will not depend on Phaser.

### Character visual contract

```typescript
interface CharacterVisualProfile {
  characterId: string;
  portraitAsset: string;
  miniatureAsset: string;
  directionalAtlas?: string;
  directionalFrames?: Record<'up' | 'down' | 'left' | 'right', string[]>;
  scale: number;
  anchorX: number;
  anchorY: number;
}
```

No character registry entry or animation file will be changed by this feature. A separate Game View visual-profile configuration will reference approved assets.

## 5. Shared Jira stream

### Normalized model

Keep issue state and activity events separate.

```typescript
interface JiraIssueSnapshot {
  issueKey: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: string;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: string | null;
  projectKey: string;
  updatedAt: string;
  dueDate: string | null;
  issueUrl: string;
}

interface JiraActivityEvent {
  eventId: string;
  issueKey: string;
  authorId: string | null;
  assigneeId: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  occurredAt: string;
}
```

### Go responsibilities

- Define a Jira adapter interface so Jira Cloud/deployment details remain isolated.
- Read credentials from environment variables or an approved secret provider only.
- Poll once for the application, normalize responses, and upsert current issue snapshots.
- Generate a stable event ID from Jira changelog identifiers when available; otherwise derive a deterministic fingerprint from issue, change, and timestamp.
- Persist events with a unique constraint so transitions are not replayed.
- Keep event author and ticket assignee separate.
- Publish new normalized events to an in-process broker.
- Expose snapshots with REST and incremental events with SSE.
- Apply retry with backoff and honor Jira rate-limit responses.
- Retain last successful synchronization time and explicit connection freshness.

SSE is preferred because updates are one-way. WebSockets are unnecessary unless future controls require server-bound realtime commands.

### Angular responsibilities

- Open one SSE connection in a root-scoped service.
- Load an initial snapshot once, reduce subsequent events into shared state, and reconnect with backoff.
- Expose readonly observables/signals for issues, events, connection state, and freshness.
- Feed Office View and Game View from the same state without either view querying Jira.
- Keep the service alive while routes change so Jira state and user settings are preserved.

### Office View compatibility bridge

During migration, the existing iframe receives normalized snapshots/events from the Angular store through a versioned, origin-checked `postMessage` contract. Its internal polling is disabled when the parent bridge is present. This preserves the Office View design while guaranteeing one integration and one stream.

## 6. SQLite changes

Add forward-only migrations; do not edit migration `001`.

- `002_jira_stream.sql`
  - `jira_issue_snapshots`
  - `jira_activity_events` with unique `event_id`
  - synchronization cursor and freshness metadata
- `003_game_configuration.sql`
  - `game_settings`
  - `jira_status_behavior_mappings`
  - `character_jira_mappings`
  - `character_game_profiles`

Character-to-Jira mapping uses a stable Jira account ID. Unmapped users remain unassigned to characters and never inherit another person's character.

## 7. Game behavior model

```typescript
type CharacterState =
  | 'IDLE'
  | 'WALKING'
  | 'WORKING'
  | 'DISCUSSING'
  | 'REVIEWING'
  | 'BLOCKED'
  | 'CELEBRATING';
```

- A configurable status-to-behavior table translates project workflows into game states.
- State transitions are driven by deduplicated events; unchanged polling snapshots do not restart reactions.
- Each controller owns its current state, target, path, featured issue, and cooldown.
- A* pathfinding operates on a collision grid generated from the castle map.
- Workstations, quest board, planning table, review point, entrances, and idle zones are named map anchors.
- Reservations prevent multiple characters occupying the same destination tile.
- Celebration and blocked reactions have bounded durations and return to the state supported by the current issue snapshot.
- Random idle behavior uses seeded, low-frequency choices and respects a global motion budget.

## 8. Automatic spectator mode

- Default rotation interval: 15 seconds, configurable.
- The director chooses fairly among mapped characters with relevant activity.
- A new meaningful event can raise priority but cannot interrupt an active camera/dialogue transition.
- Camera focus, dialogue panel, and highlighted character update atomically.
- Manual focus pauses automatic rotation until resumed.
- Pausing presentation does not stop Jira collection.
- When no new activity exists, the camera returns to a quiet overview and characters continue low-frequency ambient behavior.

## 9. TV-oriented scene and activity panel

- Target 1920×1080 first; verify 3840×2160 using resolution-independent scaling.
- Reserve approximately 85% height for the castle and 15% for the bottom panel.
- Use a top-down castle tilemap with restrained torch and workstation effects.
- Preserve dark navy panels, gold ornament, cyan accents, and existing typography hierarchy.
- Bottom panel shows portrait, character/class, complete ticket key, two-line summary, action/status, and relative time.
- Connection state must explicitly distinguish live, reconnecting, stale, disconnected, and demo.
- Ticket links open in a new tab and never interrupt rendering.
- No horizontal scrolling; text sizing is configurable for TV mode.

## 10. Configuration

Extend the existing Angular maintenance experience without altering its current character CRUD behavior.

- Scene: selected map, movement, environmental effects, animation speed.
- Character game profile: enabled, Jira account, class, home, workstation, visual profile reference.
- Jira behavior: projects, issue types, status mappings, featured-ticket rule, refresh cadence.
- Display: spectator mode, interval, TV typography, sound, fullscreen.

Server validation will reject unknown character IDs, unsafe asset paths, duplicate Jira mappings, invalid intervals, and unsupported behavior states.

## 11. Delivery phases and approval gates

### Phase 0 — Baseline protection and architecture tests

- Record current routes, APIs, character registry hashes, and Office View screenshots.
- Add tests proving all eight mappings and owned assets remain unchanged.
- Add migration runner/version tracking before introducing new tables.

Approval output: route/API inventory, asset-preservation test, migration strategy.

### Phase 1 — Shared Jira backend and Angular store

- Implement Go adapter interface, normalized models, SQLite cache/event log, REST snapshot, and SSE stream.
- Implement root Angular store, reconnection, freshness, and Office View bridge.
- Provide a disconnected adapter when live Jira configuration is absent; do not enable demo data in production.

Acceptance: one poller, deduplicated events, separate author/assignee, both presentation consumers synchronized.

### Phase 2 — Routes and Game View shell

- Add Angular Router and the Office, Game, Characters, and Game Settings routes.
- Resolve the current `/game` static-mount conflict.
- Add the Game View navigation control without visually redesigning Office View.
- Prove route teardown stops rendering while shared Jira state remains alive.

Acceptance: navigation works, Office View is visually unchanged, `/game` mounts and destroys cleanly.

### Phase 3 — Castle, movement, and workstations

- Complete the Phaser compatibility spike and commit the selected renderer.
- Add castle map, collisions, anchors, A* pathfinding, character controllers, and state machines.
- Render all enabled characters using separate Game View visual profiles that reference existing approved assets.
- Implement idle, walking, working, reviewing, blocked, and celebrating behaviors without touching animation assets.

Acceptance: characters avoid obstacles and each other, remain recognizable, and rendering pauses when hidden.

### Phase 4 — Ticket-driven behaviors and spectator mode

- Connect shared Jira state to mapped characters.
- Implement one-time reactions, featured-ticket policy, bounded celebrations, focus queue, and 15-second rotation.
- Add truthful presentation labels and compact speech bubbles.

Acceptance: no repeated transitions, no invented mappings, fair rotation, manual pause/resume, stale state visible.

### Phase 5 — Bottom panel and Game View settings

- Build the TV-readable activity panel and connection indicator.
- Add persistent scene, character mapping, behavior mapping, and display settings.
- Validate configuration in both Angular and Go.

Acceptance: panel and settings meet the proposal at 1080p and 4K.

### Phase 6 — Performance, resilience, and release validation

- Profile long-running idle, active transition, hidden tab, disconnected Jira, and route-change scenarios.
- Limit particles, cache textures, reuse game objects, and keep frame work outside Angular change detection.
- Add backend, Angular, and engine tests plus an end-to-end smoke suite.

Acceptance: no duplicate renderer/SSE instances, resources release on Office View return, builds/tests pass, and a multi-hour soak test shows stable memory and CPU.

### Phase 7 — Persistent display and Jira selection controls

- Persist Jira scope, featured-ticket policy, refresh cadence, TV mode, fullscreen visibility, and frame-rate cap.
- Apply Game View filters after the shared normalized Jira stream.
- Preserve cached data as explicitly stale when Jira refreshes fail.

Acceptance: validated settings survive restart, one poller accepts cadence changes, and production builds plus deterministic engine tests pass.

### Phase 8 — Operational readiness console

- Expose credential-safe service, poller, SSE subscriber, issue, event, and display telemetry.
- Add a protected-method manual Jira refresh endpoint without creating another poller.
- Add an Operations route for readiness checks and operator handoff.

Acceptance: operators can distinguish healthy, degraded, disconnected, and unconfigured states without reading credentials or server internals.

### Phase 9 — Repeatable TV soak and release evidence

- Add a standalone browser soak runner with steady Game View and route-cycle modes.
- Check canvas mount/teardown invariants, API availability, event-loop lag, and browser heap when supported.
- Export a timestamped JSON report and document the target-hardware CPU/GPU observation procedure.

Acceptance: the runner can execute unattended and produce reviewable evidence; the release gate closes only after a multi-hour run on the actual television host.

### Phase 10 — Reproducible production packaging

- Make Angular production builds deterministic without build-time font downloads.
- Package the Go server, Angular application, preserved Office View, and only runtime-referenced assets for Windows, macOS, or Linux.
- Generate platform startup scripts and a SHA-256 manifest without storing Jira credentials.
- Refuse clean release creation from a dirty tree unless explicitly creating a non-release test bundle.
- Verify bundle integrity and require a signed-off soak report before release approval.

Acceptance: a clean checkout produces a self-contained verified bundle that starts on one port and exposes Game View, Office View, Operations, and the soak runner.

### Phase 11 — Production runtime hardening

- Add database-aware liveness/readiness endpoints and expose SQLite readiness in the Operations console.
- Bound HTTP header/body reads while preserving the intentionally long-lived Jira SSE response.
- Shut down gracefully on operating-system termination signals so active requests and SQLite can close cleanly.
- Add browser security headers and an explicit configurable cross-origin allowlist.

Acceptance: the packaged server reports database readiness, rejects unapproved cross-origin preflights, stops cleanly, and preserves the shared event stream.

### Phase 12 — Automated quality and release-candidate gates

- Run character preservation, backend, TypeScript, engine, release-tool, whitespace, and production-build checks through one cross-platform command.
- Execute the same quality gate for every push and pull request in GitHub Actions.
- Require a clean tree and a signed four-hour soak report before producing a certified release candidate.
- Bind the soak evidence to the release with a SHA-256 certificate recorded in the bundle manifest.

Acceptance: a release candidate can be produced only after source checks and signed soak evidence pass, and its certificate remains covered by bundle integrity verification.

### Phase 13 — Runtime identity and build provenance

- Give the application an explicit version and inject version, Git commit, build time, and platform target into packaged Go binaries.
- Expose credential-safe provenance through `/api/version` and the Operations console.
- Record the same identity in the release manifest and certified release evidence.
- Keep development builds visibly distinct from packaged releases.

Acceptance: an operator can match a running process to its exact release manifest and source commit without reading the filesystem or exposing secrets.

### Phase 14 — SQLite backup and recovery

- Add consistent online backups using SQLite `VACUUM INTO`, followed by integrity verification and SHA-256 reporting.
- Package a cross-platform `webdev-admin` tool for backup, verification, and explicit restore.
- Require the server to be stopped and an exact confirmation token before restore.
- Preserve the replaced database and SQLite sidecars as timestamped rollback files.

Acceptance: operators can create and verify a live-safe backup, restore it only through an explicit stopped-server workflow, and return to the automatically preserved pre-restore database if needed.

### Phase 15 — Credential-safe administrative auditing

- Assign a server-generated request correlation ID to every mutating API request and return it in `X-Request-ID`.
- Record the action, normalized route, method, response status, duration, and UTC timestamp in SQLite.
- Exclude bodies, query strings, Jira credentials, user emails, client addresses, and dynamic character identifiers from audit data.
- Expose bounded recent history through the Operations API and console without making the audit endpoint mutable.

Acceptance: every administrative mutation is traceable to a response request ID, read-only traffic is not recorded, and sensitive request material cannot appear in the persisted audit schema.

### Phase 16 — Controlled operational data retention

- Add a preview-first administration command for historical Jira activity and audit retention.
- Constrain retention windows to 7–3650 days and keep issue snapshots, characters, mappings, and configuration outside deletion scope.
- Require `--apply`, the exact `PRUNE` confirmation, and a new verified backup destination before deletion.
- Package the retention runbook and command in every supported release bundle.

Acceptance: operators can review candidate counts without writes, cannot accidentally enable deletion by disabling preview, and receive a verified pre-prune backup before eligible rows are removed.

### Phase 17 — Illustrated castle-office game board

- Replace the placeholder procedural floor with a dedicated illustrated castle-office environment inspired by the approved visual reference.
- Include skyline arches, banners, fireplace, crystal fountain, developer workstations, planning boards, library storage, plants, statues, rugs, and a central holographic planning table.
- Keep characters as independent runtime objects and preserve every animation, mapping, portrait, and roster identity.
- Align navigation obstacles and named behavior anchors to the illustrated furniture.
- Add bounded, configuration-aware hologram, crystal, fireplace, lantern, and station effects with static reduced-motion fallbacks.
- Present the Jira activity panel as an ornamental overlay without obscuring keyboard-accessible focus and spectator controls.

Acceptance: the illustrated environment fills the Game View across desktop aspect ratios, all eight existing characters remain selectable and mobile, the activity panel remains readable, pause/resume works, and the browser console stays error-free.

## 12. Verification strategy

### Backend

- Unit tests for normalization, stable event IDs, deduplication, author/assignee separation, status changes, retry, and stale state.
- Store tests for migrations, unique events, settings validation, and character mappings.
- Handler tests for snapshots, SSE reconnect cursor, malformed requests, and unavailable Jira.

### Angular

- Store tests for initial snapshot, incremental events, reconnect/backoff, freshness, and route persistence.
- Component tests for navigation, activity panel wrapping, connection labels, and settings validation.
- Lifecycle tests ensuring one SSE subscription and one renderer instance.

### Game engine

- Deterministic tests for state transitions, pathfinding, collision reservations, focus fairness, and cooldowns.
- Visual/browser checks at 1920×1080 and 3840×2160.
- Reduced-motion, hidden-tab, pause/resume, fullscreen, keyboard, and disconnect checks.

### Character preservation

- Snapshot/hash all protected character manifests and animation assets before implementation.
- Fail validation if shared feature work changes `characters/`, `characters/registry.js`, character animation directories, or Blender/export files.
- Verify Commander and Rogue remain distinct and all eight roster entries remain available.

## 13. Known dependencies and risks

1. **Live Jira is not implemented in Go.** Jira base URL, authentication method, project scope, and changelog availability must be configured before live verification.
2. **The `/game` route is currently occupied by static hosting.** Phase 2 includes a compatibility-safe path migration.
3. **Four-direction sprite atlases do not exist for all characters.** The initial release preserves current artwork and supports movement with approved miniatures; true direction-specific animation requires separately approved assets and is not fabricated here.
4. **Phaser is not installed.** Add it only after the compatibility spike confirms lifecycle and performance suitability.
5. **SQLite migration handling is minimal.** A versioned migration runner is required before adding production tables.
6. **The current Angular production build has previously aborted in the local bundled Node runtime.** Resolve or reproduce that environment issue before the release gate; it does not change the architecture.

## 14. Approval scope

Approval of this plan authorizes implementation of Phases 0–2 first:

- protection tests and migration foundation;
- one normalized Go Jira stream plus the Angular shared store;
- Office View compatibility bridge;
- Angular routing and the new Game View shell;
- no character animation, manifest, registry, or owned asset changes.

After the Phase 2 checkpoint, review the running shell and Phaser compatibility result before authorizing the castle/behavior implementation in Phases 3–6.
