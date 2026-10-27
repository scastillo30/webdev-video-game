# WEBDEV MMORPG

WEBDEV MMORPG turns a shared Jira activity stream into two synchronized visual experiences:

- **Office View** (`/`) preserves the cinematic HTML game and its character animations.
- **Game View** (`/game`) places linked SNES-style board characters in an interactive Phaser castle office.

Both views use the same Angular Jira store and the same Go-backed normalized Jira stream. The backend also owns SQLite persistence, character CRUD, Game View configuration, operational telemetry, and release serving.

## Quick start

Requirements: Node.js 22, npm, and Go. Exact project versions are recorded in `.node-version` and `.go-version`.

```sh
npm install
npm run frontend:install
export JIRA_BASE_URL="https://company.atlassian.net"
export JIRA_CREDENTIAL_KEYS="$(openssl rand -base64 32 | tr '+/' '-_')"
npm run dev
```

Open [http://localhost:4200](http://localhost:4200). The Angular development server proxies API and legacy-runtime requests to Go on port `8080`.

On this repository's configured macOS workstation, the verified local runtimes can be used instead:

```sh
npm run local:backend:start
npm run local:frontend:start
```

Run those two commands in separate terminals. Windows users should follow [WINDOWS_SETUP.md](WINDOWS_SETUP.md).

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Office View, hosted in a same-origin legacy iframe |
| `/game` | Phaser Game View and automatic spectator presentation |
| `/characters` | Character metadata maintenance |
| `/settings/game` | Game, display, Jira mapping, and behavior settings |
| `/operations` | Health, build, Jira, and audit status |
| `/diagnostics/soak.html` | Long-running Game/Office stability harness |

## Main commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Go and Angular together |
| `npm run frontend:build` | Production Angular build |
| `npm run test:backend` | Go test suite |
| `npm run test:engine` | Game-engine tests |
| `npm run verify:characters` | Character ownership and asset validation |
| `npm run quality:check` | Complete source quality gate |
| `npm run release:build -- --target windows-amd64` | Verified platform release bundle |

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, environment variables, local data, and troubleshooting.

## Jira integration

The app supports two Jira credential scopes:

- The optional shared event-stream service account belongs in the Go process environment.
- Each viewer connects their own Jira account in **Settings → Jira Integration**. That password is stored only in an encrypted, HttpOnly, session-bound cookie and is never written to SQLite.

Server configuration:

```sh
export JIRA_BASE_URL="https://company.atlassian.net"
export JIRA_CREDENTIAL_KEYS="$(openssl rand -base64 32 | tr '+/' '-_')"
export JIRA_EMAIL="jira-user@example.com"
export JIRA_API_TOKEN="..."
export JIRA_JQL='project in (TEAM) ORDER BY updated DESC'
```

`JIRA_CREDENTIAL_KEYS` and `JIRA_BASE_URL` are required at startup. `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_JQL` are optional as a group; without them the shared stream is disconnected, while viewer-specific character activity can still work. Stable Jira account IDs are mapped to character IDs in `/settings/game`; event author and ticket assignee remain separate. See [JIRA_INTEGRATION.md](JIRA_INTEGRATION.md).

## Character and asset boundary

Office and Game use linked but independent presentation assets:

- Office animation ownership and version history live in `characters/<id>/manifest.json`, `characters/registry.js`, and `assets/characters/`.
- Game board mappings live in `frontend/src/app/features/game/engine/board-character-assets.ts` and use board-specific assets under `frontend/public/assets/game-board/`.
- Commander and Rogue are distinct characters and must never share ownership or fallbacks.
- Approved versions are additive and are not overwritten.

Read [AGENTS.md](AGENTS.md), [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md), and the target character manifest before changing character assets. Board production is documented in [BOARD_CHARACTER_WORKFLOW.md](BOARD_CHARACTER_WORKFLOW.md).

## Documentation map

Start with [docs/README.md](docs/README.md) for the complete documentation index. The most useful current guides are:

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — product requirements and acceptance baseline
- [ARCHITECTURE.md](ARCHITECTURE.md) — system boundaries and runtime design
- [OFFICE_VIEW.md](OFFICE_VIEW.md) — preserved cinematic runtime and Jira bridge
- [GAME_VIEW.md](GAME_VIEW.md) — board scene, movement, sprites, and spectator behavior
- [API.md](API.md) — HTTP and SSE API reference
- [TESTING.md](TESTING.md) — validation and release gates
- [DEPLOYMENT.md](DEPLOYMENT.md) — production build and operation
- [CONTRIBUTING.md](CONTRIBUTING.md) — safe change workflow

Historical phase reports and the original V4 specification are retained for design rationale; they are not the source of truth for the current runtime.
