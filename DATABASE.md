# SQLite data model and migrations

The Go service owns one SQLite database. It stores editable character metadata, Game View configuration, normalized Jira state/events, synchronization freshness, and bounded operational audit history. Character manifests and versioned source assets remain filesystem-owned source of truth for asset ownership.

## Location and runtime behavior

When started from `backend/`, the default is `data/game.db`. Release launchers default to `<release>/data/game.db`. Set `DB_PATH` to use durable storage elsewhere.

The store enables foreign keys, WAL mode, a five-second busy timeout, and one open connection. Embedded forward-only migrations run in filename order and are recorded in `schema_migrations`.

## Tables

| Table | Purpose | Important rule |
| --- | --- | --- |
| `schema_migrations` | Applied migration filenames | Never rewrite an applied migration |
| `characters` | Editable identity/display metadata and Office asset references | ID is canonical and 1–64 characters |
| `character_game_profiles` | Game mapping, home/workstation, approved profile visuals, Jira account | One row per character; Jira account unique |
| `game_settings` | Singleton movement, effects, spectator, Jira/display settings | Validated ranges and enumerations |
| `jira_status_behavior_mappings` | Exact Jira status → game behavior | Status key is case-insensitive |
| `jira_issue_snapshots` | Latest current state per issue | One row per issue key |
| `jira_activity_events` | Immutable normalized activity history | Stable `event_id` is unique |
| `jira_sync_state` | Singleton connection/freshness state | Separates cached data from live state |
| `operational_audit` | Safe administrative mutation metadata | No bodies, queries, credentials, email, or IP |
| `jira_user_cache` | Per-viewer Jira account-key display-name cache | Keyed by viewer, host, and account key |
| `jira_user_sync` | Per-viewer successful activity synchronization time | Contains no credential material |

## Migration history

| Version | Adds |
| --- | --- |
| `001_characters.sql` | Character table and eight seeded roster identities |
| `002_jira_stream.sql` | Issue snapshots, activity events, indexes, and sync state |
| `003_game_profiles.sql` | One Game View profile for each roster character |
| `004_game_configuration.sql` | Core settings and seeded Jira status behaviors |
| `005_game_runtime_preferences.sql` | Scope filters, featured-ticket rule, refresh, TV/fullscreen, FPS |
| `006_operational_audit.sql` | Bounded credential-safe mutation audit |
| `008_user_jira_profiles.sql` | Character Activity Stream/identity fields and per-viewer Jira name/sync caches |

Migrations exist under `backend/internal/store/migrations/` for embedding. The repository also keeps a mirror under `backend/migrations/`; new schema changes must keep the maintained pair synchronized until that duplication is intentionally removed.

## Ownership boundaries

- Character CRUD can edit paths stored as metadata, but it does not approve or manufacture an asset version.
- `characters/<id>/manifest.json` and [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md) govern character asset ownership.
- Game configuration updates can change mappings, anchors, enablement, and preferences; server validation prevents changing approved profile asset paths through the settings payload.
- Jira event author and assignee have separate database columns.
- Current issue state and historical event state are separate tables.
- Jira passwords are never stored in SQLite. Per-viewer parsed feed files are isolated beneath `ACTIVITY_DIR/users/<viewer>/`.

## Adding a migration

1. Choose the next zero-padded filename in both migration directories.
2. Make it safe for an existing populated database; never edit an earlier file.
3. Update Go store methods and TypeScript/API models together.
4. Add migration and store tests, including invalid data and restart behavior.
5. Update [API.md](API.md), [ARCHITECTURE.md](ARCHITECTURE.md), and this document when the contract changes.
6. Run `npm run test:backend` and `npm run quality:check`.

SQLite migrations are forward-only. A binary rollback may require restoring the pre-upgrade database backup; test that operational path before a risky release.

## Backup, restore, and retention

Use `webdev-admin` rather than copying a live WAL database:

- [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) documents consistent backup, verification, restore, and rollback.
- [DATA_RETENTION.md](DATA_RETENTION.md) documents preview-first pruning of historical Jira events and audits.

Never commit `game.db`, `-wal`, `-shm`, backups, or organization-specific data.
