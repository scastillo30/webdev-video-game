# Webdev MMORPG architecture

## Runtime

```text
Browser
  └─ Angular application (:4200 in development)
      ├─ Office View → / (legacy presentation bridged at /legacy-game/)
      ├─ Game View → /game
      │   ├─ Phaser castle scene (outside Angular change detection)
      │   ├─ character controllers + A* collision grid
      │   └─ Jira behavior mapper + fair spectator director
      ├─ Character maintenance → /characters
      ├─ Game settings → /settings/game
      │   └─ validated Game View, spectator, Jira mapping, and status behavior controls
      └─ Shared Jira store → /api/jira/snapshot + /api/jira/events (SSE)
                                  └─ Go HTTP API (:8080)
                                      ├─ one Jira adapter/poller
                                      ├─ normalized issue/event stream
                                      └─ SQLite backend/data/game.db
```

The existing Office View remains intact at the repository root during migration. The Go server exposes it under `/legacy-game/`; Angular owns `/game`. A compatibility redirect keeps old `/game/index.html` bookmarks working.

Office View and Game View consume one root-scoped Angular Jira store. The store opens one SSE connection to Go and survives route changes. While Office View remains in the legacy iframe, Angular passes the normalized stream through a same-origin, versioned `postMessage` bridge; the iframe disables its own Jira adapter polling in this mode.

Game View creates exactly one Phaser instance while `/game` is mounted and destroys it on route exit. The canvas pauses when the document is hidden. Angular retains responsibility for the accessible toolbar and activity panel; Phaser owns only the castle simulation. The scene uses a collision grid, named anchors, A* paths, per-character state machines, destination reservations, and bounded effects.

The castle simulation uses `frontend/public/assets/game-board/castle-office-v001.png` as its environment layer. The illustrated furniture is represented in the navigation mesh so characters route around the crystal fountain, workstations, planning table, archive/map wall, fireplace, and lower landings. Phaser overlays bounded hologram, crystal, fire, lamp, and station effects; they honor the existing effects setting and reduced-motion preference.

Characters remain separate runtime objects, but Game View does not reuse Office animations. Canonical roster IDs are mapped to board-specific SNES-style assets in `board-character-assets.ts`; custom/unmapped board profiles fall back to that same character's approved miniature. Character-owned animated board atlases can override a static board sprite through per-character runtime configuration. Office animation, poster, portrait, and registry mappings remain independent and untouched by board presentation changes.

The navigation layer distinguishes walkable corridors from walls and furniture, exposes named work/social interaction targets, and reserves destinations to avoid character overlap. Ground positions represent each sprite's feet; the controller aligns the shadow, pointer target, focus halo, and speech offset from that anchor. Autonomous behavior is low frequency and bounded so the scene remains useful as a continuous display.

The spectator director accepts only events whose author has an explicit stable Jira-account mapping. Assignee state can position a mapped character at a workstation, but it never changes event authorship. Event IDs are deduplicated, pending events from one author are grouped into one appearance, and characters rotate fairly at a configurable interval (15 seconds by default). Manual focus pauses rotation without stopping the shared Jira store.

Game View configuration is read from `GET /api/game/config` and saved atomically with `PUT /api/game/config`. The API validates the supported scene, animation speed, frame-rate cap, spectator and Jira refresh intervals, TV text scale, Jira project and issue-type filters, featured-ticket rule, all eight character profiles, unique stable Jira account mappings, named castle anchors, and Jira-status behavior mappings before committing the transaction. The settings page never writes character-owned asset paths; it only displays the approved profile visuals while editing placement, enablement, and Jira identity mapping.

The Game View applies project and issue-type scope after the shared normalized Jira stream, so Office View and Game View still use one backend poller. When a mapped character has multiple tickets, the configured deterministic rule selects the most recently updated, highest-priority, or nearest-due ticket. The Go Jira service reads its refresh cadence from SQLite and accepts validated live interval updates without restarting the server.

## Character ownership

SQLite stores editable application metadata. `characters/<id>/manifest.json` and `PROJECT_WORKFLOW.md` remain authoritative for animation ownership and approved versions. A database edit must not silently reassign Commander, Rogue, or any other character to another character's assets.

There are therefore three linked but distinct layers:

1. Canonical identity and editable metadata in SQLite plus character manifests.
2. Office View animation configuration in `characters/registry.js` and character-owned Office assets.
3. Game View board presentation in `board-character-assets.ts` and character-owned board animation metadata.

The stable character ID joins those layers. Asset paths are never inferred from appearance.

## API

- `GET /api/health`
- `GET /api/characters`
- `GET /api/characters/{id}`
- `POST /api/characters`
- `PUT /api/characters/{id}`
- `DELETE /api/characters/{id}`
- `GET /api/jira/snapshot`
- `GET /api/jira/events` (Server-Sent Events)
- `POST /api/jira/refresh` (serialized operator-triggered refresh)
- `GET /api/game/profiles`
- `GET /api/game/config`
- `PUT /api/game/config`
- `GET /api/operations/status` (credential-safe readiness telemetry)
- `GET /api/operations/audit` (credential-safe administrative mutation history)

The Go service applies ordered, embedded, forward-only migrations at startup and records them in `schema_migrations`. All writes use parameterized SQL. Jira issue state and deduplicated activity events are stored separately. `character_game_profiles` stores Game View placement, approved visual references, enablement, and an optional unique Jira account ID. `game_settings` stores runtime and display preferences, while `jira_status_behavior_mappings` stores exact status-to-behavior overrides. Seeded Jira mappings are deliberately null.

## Jira configuration

The server is explicitly disconnected when these variables are absent; demo fixtures are never loaded by the backend.

- `JIRA_BASE_URL` — for example `https://company.atlassian.net`
- `JIRA_EMAIL` — Jira Cloud account email
- `JIRA_API_TOKEN` — server-side token; never exposed to Angular
- `JIRA_JQL` — issue scope used by the single poller

The poll cadence is persisted in SQLite and managed from **Settings → Game → Jira Scope & Selection**. It defaults to 60 seconds, accepts 10–3600 seconds, and updates the existing poller without starting a second one. Project and issue-type filters on that screen affect Game View presentation only; `JIRA_JQL` remains the backend ingestion boundary shared by both views.

The initial synchronization caches current issue state without replaying old changelog transitions. Later polls produce stable event IDs from the Jira issue key, changelog history ID, and changed-field index.

## Continuous-display profile

- Phaser is lazy-loaded, runs outside Angular change detection, and is capped at a configurable 24, 30, or 60 FPS; the balanced default is 30 FPS.
- The renderer sleeps while the document is hidden and is destroyed when Game View unmounts.
- Texture keys are stable, ambient effects are bounded, and celebration particles are short-lived.
- A failed Jira refresh preserves cached issue state but marks it `stale`; cached data is never presented as live.
- Fullscreen is an explicit user control because browsers require a user gesture.
- `/operations` reports poller/SSE health without exposing Jira credentials. `/diagnostics/soak.html` runs an unattended Game View or Game/Office lifecycle soak and exports JSON evidence.
- `scripts/build-release.mjs` creates a single-port, platform-specific deployment folder from a clean tree. Runtime assets are discovered from committed UI/config references instead of copying the 1.8 GB production-art directory, and `scripts/verify-release.mjs` validates every packaged file against its SHA-256 manifest.
- The Go runtime exposes separate liveness and SQLite-aware readiness probes, uses bounded request timeouts without interrupting SSE, handles termination signals gracefully, and applies an explicit CORS allowlist plus browser security headers.
- `scripts/quality-gate.mjs` is the shared local/CI verification path. `scripts/verify-release-candidate.mjs` additionally requires signed soak evidence and adds its SHA-256 certificate to the verified release manifest.
- Packaged servers expose version, commit, build time, and target at `/api/version`; these values are compiled from the same metadata written to `release-manifest.json`.
- `webdev-admin` creates consistent SQLite snapshots with `VACUUM INTO`, verifies them read-only with `PRAGMA quick_check`, and performs confirmation-gated restores while preserving a timestamped rollback database.
- Mutating API requests receive an `X-Request-ID` and produce a bounded operational audit record containing only action, normalized path, method, status, duration, and timestamp. Bodies, queries, Jira credentials, email addresses, and client addresses are excluded.
- `webdev-admin prune` previews retention candidates by default. Applying deletion requires an exact confirmation token and a new verified pre-prune backup; only historical Jira events and audit rows are eligible.

## Development

1. Use Node 22.23.1 and Go 1.27.1. Verified project-local runtimes are installed under the ignored `.tools/` directory on this workstation; `.node-version` and `.go-version` record the expected versions.
2. Run `npm run frontend:install` once when dependencies change.
3. Run `npm run local:backend:start` (or `npm run backend:start` when Go is globally available).
4. In another terminal run `npm run local:frontend:start` (or `npm run frontend:start` when Node is globally available).
5. Open `http://localhost:4200`. Office View is `/`; the Phaser Game View is `/game`.

For production, run `npm run frontend:build`, then start the Go server. It serves the Angular build, API, and legacy game from one process.

Verified local builds can also use `npm run local:frontend:build` and `npm run local:backend:build` without globally installing Node or Go.

See `DEVELOPMENT.md` for environment variables and troubleshooting, `API.md` for payload contracts, and `GAME_VIEW.md` for the board runtime in detail.
