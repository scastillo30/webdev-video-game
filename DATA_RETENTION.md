# Operational Data Retention

Retention maintenance applies only to historical rows in `jira_activity_events` and `operational_audit`. It never deletes current Jira issue snapshots, Jira connection state, characters, character/game mappings, profiles, or game configuration.

Allowed retention windows are 7–3650 days. Recommended starting values are 180 days for Jira activity events and 365 days for administrative audit entries.

## Preview

Preview is the default and does not delete data:

```sh
./webdev-admin prune --db ./data/game.db --event-days 180 --audit-days 365
```

Windows PowerShell:

```powershell
.\webdev-admin.exe prune --db .\data\game.db --event-days 180 --audit-days 365
```

Review `eventCandidates` and `auditCandidates`. `eventsDeleted` and `auditsDeleted` remain zero in preview output. Passing `--dry-run=false` alone is deliberately rejected and never enables deletion.

## Apply

Choose a new backup filename that does not already exist. Applying retention requires all three safeguards: `--apply`, `--confirm PRUNE`, and `--backup`.

```sh
./webdev-admin prune --db ./data/game.db --event-days 180 --audit-days 365 \
  --apply --confirm PRUNE --backup ./backups/before-prune-2026-10-25.db
```

Windows PowerShell:

```powershell
.\webdev-admin.exe prune --db .\data\game.db --event-days 180 --audit-days 365 --apply --confirm PRUNE --backup .\backups\before-prune-2026-10-25.db
```

The tool creates and verifies the SQLite snapshot before it begins deletion. If backup creation fails, no rows are pruned. Keep the backup until the Operations console, `/api/ready`, Jira history, character mappings, and Game View have been checked.

## Audit privacy boundary

Audit entries contain a server-generated request ID, action name, HTTP method, normalized API route, response status, elapsed milliseconds, and UTC timestamp. Request/response bodies, query strings, credentials, email addresses, IP addresses, and dynamic character IDs are not stored.
