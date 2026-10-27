# Deployment and operations

## Supported shape

The production deployment is a single Go process serving:

- the compiled Angular SPA;
- REST and SSE APIs;
- the legacy Office View runtime;
- the diagnostics harness;
- one local SQLite database.

This keeps browser traffic same-origin and avoids putting Jira credentials in frontend code.

## Build a release

Start from a clean checkout and run the quality gate:

```sh
npm run quality:check
npm run release:build -- --target windows-amd64
```

Supported target names include `windows-amd64`, `linux-amd64`, and `darwin-arm64`. Output is written under `release/` and includes:

- `webdev-server` or `webdev-server.exe`;
- `webdev-admin` or `webdev-admin.exe`;
- compiled Angular files;
- preserved Office runtime files;
- only referenced runtime assets;
- a platform launcher;
- `release-manifest.json` with SHA-256 digests.

The large character production-art tree and Jira credentials are not copied into the release.

Verify an existing bundle:

```sh
npm run release:verify -- release/webdev-mmorpg-windows-amd64
```

## Certified candidate

A release candidate requires reviewed target-host soak evidence:

```sh
npm run release:candidate -- --soak-report /path/to/webdev-tv-soak-report.json --target windows-amd64
```

The certificate stores the report filename and digest, not its content. See [TV_SOAK_RUNBOOK.md](TV_SOAK_RUNBOOK.md).

## Runtime configuration

The launcher sets packaged paths for Angular, legacy files, and the default `data/game.db`. Configure Jira and any address override in the host process environment before starting:

```text
ADDR=:8080
DB_PATH=/durable/path/game.db
JIRA_BASE_URL=https://company.atlassian.net
JIRA_CREDENTIAL_KEYS=<newest-key,older-rotation-keys>
JIRA_EMAIL=...
JIRA_API_TOKEN=...
JIRA_JQL=...
APP_ENV=production
ACTIVITY_DIR=/durable/path/jira-activity
```

Use `CORS_ALLOWED_ORIGINS` only for a trusted separate frontend. Leave it empty for the normal single-origin deployment.

`JIRA_CREDENTIAL_KEYS` must contain at least one URL-safe base64 32-byte key or the server refuses to start. The newest key encrypts; older listed keys remain available only for cookie rotation. Treat `data/`, the activity-cache directory, and `backups/` as mutable host storage. Do not replace them during an application-binary upgrade.

## Startup and checks

Use `start.sh` on macOS/Linux or `start.ps1` on Windows, then verify:

1. `GET /api/health` returns `200`.
2. `GET /api/ready` reports database ready.
3. `GET /api/version` matches the intended release.
4. `/operations` reports the expected build, FPS/TV settings, and Jira state.
5. `/`, `/game`, and `/settings/game` load from the deployment origin.

Jira may be intentionally unconfigured, but that state must be visible as disconnected. A configured deployment should not be accepted while stale or reconnecting without an understood reason.

## Database safety

Create and verify a backup before configuration migrations, retention maintenance, or host moves:

```sh
./webdev-admin backup --db ./data/game.db --out ./backups/game-YYYY-MM-DD.db
./webdev-admin verify --file ./backups/game-YYYY-MM-DD.db
```

Backups are safe while the server runs. Restore requires the server to be stopped and the exact `STOPPED` confirmation. Read [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) before attempting it.

Retention is preview-only by default and affects only historical Jira events and operational audit rows. Read [DATA_RETENTION.md](DATA_RETENTION.md) before using `--apply`.

## Upgrade procedure

1. Record `/api/version` and `/api/operations/status` from the current deployment.
2. Create and verify a database backup outside the application folder.
3. Stop the old server.
4. Replace immutable release files, preserving `data/` and backups.
5. Start the new server; embedded forward-only migrations run automatically.
6. Verify readiness, version, routes, settings, mappings, Jira freshness, and Game/Office presentation.
7. Keep the previous release folder and pre-upgrade backup until acceptance is complete.

Database migrations are not rolled backward automatically. Application rollback may also require the documented database restore workflow when a new migration is incompatible with an older binary.

## Observability and privacy

The Operations view and API expose poller diagnostics, freshness, counts, database health, build identity, display configuration, and bounded mutation audit history. Audit records exclude bodies, query strings, credentials, email addresses, IP addresses, and dynamic character IDs.

Do not publish database files, soak reports, screenshots, or logs until they have been checked for organization-specific ticket content.
