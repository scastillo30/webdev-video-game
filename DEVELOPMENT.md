# Development guide

## Prerequisites

- Node.js 22 and npm; `.node-version` records the verified version.
- Go; `.go-version` records the verified version.
- Git.

The project uses Angular 18, Phaser 3, Go, and a pure-Go SQLite driver. A separate SQLite service is not required.

## First-time setup

```sh
npm install
npm run frontend:install
cd backend && go mod download && cd ..
```

Do not commit `node_modules`, `.tools`, generated databases, release bundles, or secrets.

## Development servers

The simplest command starts both processes:

```sh
npm run dev
```

For separate logs, use two terminals:

```sh
npm run backend:start
npm run frontend:start
```

- Angular: `http://localhost:4200`
- Go API: `http://localhost:8080`
- Angular proxies `/api` and `/legacy-game` to Go through `frontend/proxy.conf.json`.

The workstation-specific `local:*` commands use ignored runtimes under `.tools/`:

```sh
npm run local:backend:start
npm run local:frontend:start
```

They are conveniences, not portable project requirements. Windows uses the standard commands in [WINDOWS_SETUP.md](WINDOWS_SETUP.md).

## Production-like local run

```sh
npm run frontend:build
npm run backend:start
```

Open `http://localhost:8080`. Go serves the compiled Angular application, API, diagnostics, and legacy Office runtime from one origin.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADDR` | `:8080` | Go listen address |
| `DB_PATH` | `backend/data/game.db` when started from `backend/` | SQLite file |
| `ANGULAR_DIST` | auto-detected development/build location | Compiled Angular files for Go serving |
| `LEGACY_GAME_DIR` | auto-detected repository root/runtime location | Office View static files |
| `JIRA_BASE_URL` | empty | Jira Cloud base URL |
| `JIRA_CREDENTIAL_KEYS` | required | Comma-separated URL-safe base64 32-byte encryption keys, newest first |
| `CONFLUENCE_BASE_URL` | empty | Optional second trusted Activity Stream origin |
| `JIRA_EMAIL` | empty | Jira Cloud login email |
| `JIRA_API_TOKEN` | empty | Server-side token |
| `JIRA_JQL` | empty | Backend ingestion boundary |
| `CORS_ALLOWED_ORIGINS` | empty | Comma-separated trusted cross-origin frontend allowlist |
| `ACTIVITY_DIR` | `backend/data/jira-activity` when started from `backend/` | Per-viewer parsed Activity Stream cache |
| `APP_ENV` | `development` | Set to `production` to require Secure cookies |
| `COOKIE_SECURE` | `false` | Explicit Secure-cookie override |

Generate the required credential key before starting Go:

```sh
export JIRA_CREDENTIAL_KEYS="$(openssl rand -base64 32 | tr '+/' '-_')"
export JIRA_BASE_URL="https://company.atlassian.net"
```

The first key encrypts new per-viewer credentials and all listed keys can decrypt, allowing rotation. Never commit the generated value. `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_JQL` are required only for the optional shared event-stream poller. Never put a Jira password or token in Angular code, JSON fixtures, logs, or release folders.

## Local data

SQLite is created automatically and forward-only embedded migrations run at server startup. The normal source-tree location is `backend/data/game.db`; WAL sidecars may appear while the server runs. These files are local state and are ignored by Git.

To start with a separate development database without deleting existing work:

```sh
DB_PATH=/tmp/webdev-mmorpg-dev.db npm run backend:start
```

Use [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) before restoring or replacing a database.

## Important source areas

```text
frontend/src/app/                  Angular routes, stores, views, and Phaser integration
frontend/public/assets/game-board/ Runtime board background and board sprites
backend/cmd/server/                HTTP server and route wiring
backend/internal/jira/             Jira adapter, poller, broker, normalization
backend/internal/userjira/         Session-bound viewer credentials and per-character activity feeds
backend/internal/store/            SQLite access and embedded migrations
characters/                        Character-owned manifests
assets/characters/                 Versioned character production/runtime assets
characters/registry.js             Office View animation mapping
index.html                         Preserved Office View runtime
scripts/                            Quality, release, and verification tools
```

## Troubleshooting

### Blank page on port 4200

Confirm both servers are running, use `http://localhost:4200` rather than opening `index.html` directly, and inspect Angular and Go logs. A hard refresh may be required after switching between old and new development servers.

### API requests fail in development

The proxy expects Go at `127.0.0.1:8080`. If `ADDR` changes, update `frontend/proxy.conf.json` or use the production-like single-origin run.

### Jira says disconnected

For the shared stream, verify `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_JQL`, then check `/api/operations/status`. For an individual character profile, reconnect in **Settings → Jira Integration** and confirm that character has a Jira Activity URL under **Characters**. Do not diagnose passwords from browser code.

### Port already in use

Stop the previous server or choose another `ADDR`. Angular defaults to `4200`; pass Angular CLI options after the npm separator when a different frontend port is needed.

### Frontend dependency problems

Remove only `frontend/node_modules`, reinstall with `npm run frontend:install`, and keep the lockfile. Do not delete the database as a dependency-repair step.

## Before handing off a change

Run the checks appropriate to the edit. For any runtime change, the default is:

```sh
npm run quality:check
```

See [TESTING.md](TESTING.md) for targeted checks and manual Game/Office acceptance.


### Restart the Go API after backend changes

`go run ./cmd/server` does not watch source files. Restart the backend after pulling or editing Go settings/schema code. An older process may accept a settings save while silently omitting new fields from its response. For holiday backgrounds, `/api/game/config` must include `settings.holidayMode` and `settings.holidayItems`. The frontend reports an error if the returned background does not match the selected value.

Run `node animation/verify_holiday_settings.mjs` against the running local app to check the settings save, persistence, route navigation, and reload flow for all three backgrounds. It restores the original configuration afterward; screenshots are written to `/tmp/settings-*.png` for visual review.
