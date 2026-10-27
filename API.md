# HTTP and event API

The Go server exposes JSON REST endpoints, one Server-Sent Events stream, the Angular application, diagnostics, and the preserved Office View. In development, Angular proxies browser requests to `http://127.0.0.1:8080`.

## Conventions

- JSON is used for request and response bodies unless noted.
- Character and configuration writes accept at most 1 MiB JSON bodies.
- Missing resources return `404`; invalid input returns `400`; unsupported methods return `405`.
- Mutating API responses include an `X-Request-ID` and create a credential-safe audit entry.
- Dynamic data in this document is illustrative; inspect the TypeScript and Go models before changing a contract.

## Health and operations

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Process liveness; returns `{"status":"ok"}` |
| `GET` | `/api/ready` | SQLite readiness and current Jira state |
| `GET` | `/api/version` | Version, commit, build time, and target |
| `GET` | `/api/operations/status` | Combined runtime, poller, connection, counts, display, build, and recent-audit status |
| `GET` | `/api/operations/audit?limit=25` | Recent safe audit records; limit is 1–100 |

Readiness can remain HTTP `200` while unconfigured Jira is disconnected; database failure makes it `503`.

## Characters

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/characters` | List characters by name |
| `POST` | `/api/characters` | Create a character |
| `GET` | `/api/characters/{id}` | Get one character |
| `PUT` | `/api/characters/{id}` | Replace editable character metadata |
| `DELETE` | `/api/characters/{id}` | Delete a character; success is `204` |

Character shape:

```json
{
  "id": "swordsman",
  "name": "Swordsman",
  "role": "QA",
  "epithet": "...",
  "bio": "...",
  "accent": "#64d9ff",
  "animationPath": "assets/characters/.../idle.webp",
  "posterPath": "assets/characters/.../poster.webp",
  "thumbPath": "assets/thumbnails/characters/...",
  "commentThumbPath": "assets/thumbnails/comments/...",
  "jiraActivityUrl": "https://jira.example.com/activity?streams=user+IS+jdoe",
  "workEmail": "jdoe@example.com",
  "linkedLoginUsername": "jdoe"
}
```

`id`, `name`, and `role` are required on creation. Database CRUD does not supersede character asset ownership: manifests and [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md) still control approved animation mappings.

## Game configuration

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/game/profiles` | Read effective character Game View profiles |
| `GET` | `/api/game/config` | Read settings, profiles, and status mappings atomically |
| `PUT` | `/api/game/config` | Validate and save the complete configuration transaction |

The `PUT` body has this top-level shape:

```json
{
  "settings": {},
  "profiles": [],
  "statusMappings": []
}
```

Important validation rules:

- The only current scene is `castle-command-center`.
- Animation speed is `0.5`–`2`; rotation is `5`–`300` seconds.
- Jira refresh is `10`–`3600` seconds; target FPS is `24`, `30`, or `60`.
- TV scale is `0.8`–`1.4`.
- Every known character must appear exactly once.
- Jira account IDs must be unique when present.
- Home/workstation values must be named supported anchors.
- Asset paths are server-owned and must remain safe approved Game View paths.
- Behaviors are `IDLE`, `WORKING`, `DISCUSSING`, `REVIEWING`, `BLOCKED`, or `CELEBRATING`.

Use `/settings/game` instead of constructing requests by hand for normal administration.

## Per-viewer Jira connection

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/jira/test-connection` | Test supplied username/password without saving |
| `PUT` | `/api/jira/credential` | Test and save only in encrypted HttpOnly cookie |
| `GET` | `/api/jira/credential` | Return connected/invalid status; never password |
| `DELETE` | `/api/jira/credential` | Clear credential and rotate the application session |
| `GET` | `/api/jira/connection` | Cookie/configuration state and last sync without calling Jira |
| `POST` | `/api/jira/connection/check` | Live connection check |
| `GET` | `/api/employees/{characterId}/activity?limit=50` | Grouped Jira activity profile, limit 1–500 |
| `POST` | `/api/employees/activity/refresh` | Start bounded stale-profile refresh for the current viewer |

New endpoint errors use `{"detail":"message"}`. Activity unavailability is a successful `200` response with `available:false` and a reason such as `not_configured`, `no_jira_account`, `credentials_invalid`, `auth_failed`, or `fetch_failed`. A failed refresh returns the current viewer's cache with `stale:true` when available.

## Jira snapshot and events

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/jira/snapshot` | Current normalized issues, recent activity, and connection state |
| `GET` | `/api/jira/events` | Long-lived Server-Sent Events connection |
| `POST` | `/api/jira/refresh` | Serialized operator-triggered poll |

Snapshot shape:

```json
{
  "issues": [],
  "events": [],
  "connection": {
    "state": "live",
    "configured": true,
    "lastAttemptAt": "2026-10-25T12:00:00Z",
    "lastSuccessAt": "2026-10-25T12:00:00Z",
    "message": "Jira synchronization is live"
  }
}
```

Issue snapshots contain `issueKey`, `summary`, `issueType`, `status`, `statusCategory`, assignee fields, `priority`, `projectKey`, `updatedAt`, `dueDate`, and `issueUrl`.

Activity events contain `eventId`, `issueKey`, author fields, assignee fields, `action`, `previousStatus`, `newStatus`, `currentStatus`, `occurredAt`, `issueSummary`, and `issueUrl`. Author identity and assignee identity must never be merged.

The Angular `JiraStoreService` loads the snapshot once, consumes SSE events, reconnects with backoff, and exposes one state to both views. Browser clients must not call Jira Cloud directly.

The SSE stream sends:

| Event name | Data |
| --- | --- |
| `snapshot` | Full `JiraSnapshot`, sent immediately after connection |
| `activity` | One newly accepted `JiraActivityEvent`; SSE `id` is the stable event ID |
| `connection` | Updated `JiraConnection` freshness/configuration state |

A comment keep-alive is sent every 20 seconds. Slow subscribers may miss a live envelope rather than blocking ingestion; clients recover from the snapshot on reconnect.

## Static application paths

- `/` and Angular routes fall back to the compiled SPA in production.
- `/legacy-game/` serves the preserved Office View runtime.
- `/game/index.html` is a compatibility redirect, not the current Game View route.
- `/diagnostics/soak.html` serves the stability harness.

## Security boundary

The API has no browser-side Jira credentials. Cross-origin access is disabled unless `CORS_ALLOWED_ORIGINS` explicitly lists trusted origins. Production is designed for a single origin. Security headers and bounded server timeouts are applied centrally; SSE is kept compatible with long-lived streaming.
