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
      ├─ Game settings shell → /settings/game
      └─ Shared Jira store → /api/jira/snapshot + /api/jira/events (SSE)
                                  └─ Go HTTP API (:8080)
                                      ├─ one Jira adapter/poller
                                      ├─ normalized issue/event stream
                                      └─ SQLite backend/data/game.db
```

The existing Office View remains intact at the repository root during migration. The Go server exposes it under `/legacy-game/`; Angular owns `/game`. A compatibility redirect keeps old `/game/index.html` bookmarks working.

Office View and Game View consume one root-scoped Angular Jira store. The store opens one SSE connection to Go and survives route changes. While Office View remains in the legacy iframe, Angular passes the normalized stream through a same-origin, versioned `postMessage` bridge; the iframe disables its own Jira adapter polling in this mode.

Game View creates exactly one Phaser instance while `/game` is mounted and destroys it on route exit. The canvas pauses when the document is hidden. Angular retains responsibility for the accessible toolbar and activity panel; Phaser owns only the castle simulation. The scene uses a collision grid, named anchors, A* paths, per-character state machines, destination reservations, and bounded effects.

The spectator director accepts only events whose author has an explicit stable Jira-account mapping. Assignee state can position a mapped character at a workstation, but it never changes event authorship. Event IDs are deduplicated, pending events from one author are grouped into one appearance, and characters rotate fairly at a 15-second interval. Manual focus pauses rotation without stopping the shared Jira store.

## Character ownership

SQLite stores editable application metadata. `characters/<id>/manifest.json` and `PROJECT_WORKFLOW.md` remain authoritative for animation ownership and approved versions. A database edit must not silently reassign Commander, Rogue, or any other character to another character's assets.

## API

- `GET /api/health`
- `GET /api/characters`
- `GET /api/characters/{id}`
- `POST /api/characters`
- `PUT /api/characters/{id}`
- `DELETE /api/characters/{id}`
- `GET /api/jira/snapshot`
- `GET /api/jira/events` (Server-Sent Events)
- `GET /api/game/profiles`

The Go service applies ordered, embedded, forward-only migrations at startup and records them in `schema_migrations`. All writes use parameterized SQL. Jira issue state and deduplicated activity events are stored separately. `character_game_profiles` stores Game View placement, approved visual references, enablement, and an optional unique Jira account ID. Seeded Jira mappings are deliberately null.

## Jira configuration

The server is explicitly disconnected when these variables are absent; demo fixtures are never loaded by the backend.

- `JIRA_BASE_URL` — for example `https://company.atlassian.net`
- `JIRA_EMAIL` — Jira Cloud account email
- `JIRA_API_TOKEN` — server-side token; never exposed to Angular
- `JIRA_JQL` — issue scope used by the single poller
- `JIRA_POLL_INTERVAL` — optional Go duration, default `60s`, minimum `10s`

The initial synchronization caches current issue state without replaying old changelog transitions. Later polls produce stable event IDs from the Jira issue key, changelog history ID, and changed-field index.

## Development

1. Use Node 22.23.1 and Go 1.27.1. Verified project-local runtimes are installed under the ignored `.tools/` directory on this workstation; `.node-version` and `.go-version` record the expected versions.
2. Run `npm run frontend:install` once when dependencies change.
3. Run `npm run local:backend:start` (or `npm run backend:start` when Go is globally available).
4. In another terminal run `npm run local:frontend:start` (or `npm run frontend:start` when Node is globally available).
5. Open `http://localhost:4200`. Office View is `/`; the Phaser Game View is `/game`.

For production, run `npm run frontend:build`, then start the Go server. It serves the Angular build, API, and legacy game from one process.

Verified local builds can also use `npm run local:frontend:build` and `npm run local:backend:build` without globally installing Node or Go.
